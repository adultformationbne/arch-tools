# Supabase Migration Plan for AHWGP Editor

## Overview
Migrate from static JSON file (`AHWGP_master.json`) to Supabase database with minimal complexity. The design separates structure (book table) from content (blocks table) for efficient versioning.

## Database Schema

### 1. Books Table
Stores the document structure - which blocks appear in what order and their visibility state.

```sql
CREATE TABLE books (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'At Home with God''s People',
    blocks JSONB NOT NULL, -- Array of {id: "block_id", hidden: boolean}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT, -- Optional: email or identifier
    notes TEXT -- Optional: what changed in this version
);

-- Index for efficient querying of latest version
CREATE INDEX idx_books_created_at ON books(created_at DESC);
```

### 2. Blocks Table
Stores the actual content of each block with automatic versioning.

```sql
CREATE TABLE blocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    block_id TEXT NOT NULL, -- The existing unique ID (e.g., "a7fa4680-a30f-45e0-b120-442efd761d5c")
    content TEXT NOT NULL, -- The actual text content (with inline HTML formatting)
    tag TEXT NOT NULL, -- paragraph, h1, h2, chapter, etc.
    metadata JSONB DEFAULT '{}', -- Any additional properties
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT -- Optional: who made this change
);

-- Index for finding all versions of a block
CREATE INDEX idx_blocks_block_id ON blocks(block_id, created_at DESC);

-- Index for finding latest blocks
CREATE INDEX idx_blocks_latest ON blocks(block_id, created_at DESC);
```

## How It Works

### Version Management

1. **Structure Changes** (order, hide/show):
   - Create new row in `books` table
   - Same block content, just different arrangement

2. **Content Changes** (text edits, tag changes):
   - Create new row in `blocks` table
   - Book structure remains unchanged

3. **Combined Changes**:
   - New row in `blocks` for content changes
   - New row in `books` referencing the same block_id

### Example Flow

```javascript
// Initial state
books: [{
  id: "book-uuid-1",
  blocks: [
    {id: "blk-1", hidden: false},
    {id: "blk-2", hidden: false}
  ],
  created_at: "2025-01-01"
}]

blocks: [
  {id: "uuid-1", block_id: "blk-1", content: "Chapter 1", tag: "chapter"},
  {id: "uuid-2", block_id: "blk-2", content: "Paragraph text", tag: "paragraph"}
]

// User hides block 2 → New book row only
books: [{
  id: "book-uuid-2",
  blocks: [
    {id: "blk-1", hidden: false},
    {id: "blk-2", hidden: true}  // Changed
  ],
  created_at: "2025-01-02"
}]

// User edits block 1 content → New block row only
blocks: [
  {id: "uuid-3", block_id: "blk-1", content: "Chapter One", tag: "chapter", created_at: "2025-01-03"}
]

// To display current state:
// 1. Get latest book row
// 2. For each block_id, get latest block content
// 3. Apply hidden state from book structure
```

## API Design

### Get Current Book State
```javascript
// Supabase query
async function getCurrentBook() {
  // Get latest book structure
  const { data: book } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get all unique block IDs
  const blockIds = book.blocks.map(b => b.id);

  // Get latest version of each block
  const { data: blocks } = await supabase
    .from('blocks')
    .select('*')
    .in('block_id', blockIds)
    .order('created_at', { ascending: false });

  // Group by block_id and take first (latest) of each
  const latestBlocks = Object.values(
    blocks.reduce((acc, block) => {
      if (!acc[block.block_id] || block.created_at > acc[block.block_id].created_at) {
        acc[block.block_id] = block;
      }
      return acc;
    }, {})
  );

  return { book, blocks: latestBlocks };
}
```

### Update Book Structure (hide/show, reorder)
```javascript
async function updateBookStructure(blocks, notes) {
  const { data, error } = await supabase
    .from('books')
    .insert({
      blocks: blocks, // Array with hidden states
      notes: notes,
      created_by: userEmail
    })
    .select()
    .single();

  return data;
}
```

### Update Block Content
```javascript
async function updateBlockContent(blockId, content, tag, metadata) {
  const { data, error } = await supabase
    .from('blocks')
    .insert({
      block_id: blockId,
      content: content,
      tag: tag,
      metadata: metadata,
      created_by: userEmail
    })
    .select()
    .single();

  return data;
}
```

### Get Block History
```javascript
async function getBlockHistory(blockId) {
  const { data: versions } = await supabase
    .from('blocks')
    .select('*')
    .eq('block_id', blockId)
    .order('created_at', { ascending: false });

  return versions;
}
```

## Migration Steps

### 1. Initial Data Migration Script
```javascript
// One-time migration from AHWGP_master.json to Supabase
async function migrateToSupabase() {
  // Read current JSON
  const masterData = JSON.parse(fs.readFileSync('AHWGP_master.json'));
  
  // Insert all blocks
  const blockInserts = masterData.blocks.map(block => ({
    block_id: block.id,
    content: block.content,
    tag: block.tag,
    metadata: {
      createdAt: block.createdAt,
      isVisible: block.isVisible
    }
  }));
  
  await supabase.from('blocks').insert(blockInserts);
  
  // Create initial book structure
  const bookStructure = masterData.blocks.map(block => ({
    id: block.id,
    hidden: !block.isVisible
  }));
  
  await supabase.from('books').insert({
    title: masterData.documentTitle || 'At Home with God\'s People',
    blocks: bookStructure,
    notes: 'Initial import from AHWGP_master.json'
  });
}
```

### 2. Update Editor Routes

Replace `/api/builder` endpoints with Supabase queries:

```javascript
// src/routes/editor/+page.server.js
export async function load({ locals }) {
  const { book, blocks } = await getCurrentBook();
  
  // Transform to editor format
  const editorBlocks = book.blocks.map(bookBlock => {
    const blockData = blocks.find(b => b.block_id === bookBlock.id);
    return {
      id: bookBlock.id,
      content: blockData.content,
      tag: blockData.tag,
      isVisible: !bookBlock.hidden,
      ...blockData.metadata
    };
  });
  
  return {
    blocks: editorBlocks,
    documentTitle: book.title,
    lastSaved: book.created_at
  };
}
```

### 3. Update Save Functionality

```javascript
// When saving changes
async function saveChanges(blocks) {
  const currentBook = await getLatestBook();
  
  // Check what changed
  const structureChanged = hasStructureChanged(currentBook.blocks, blocks);
  const contentChanges = getContentChanges(currentBook.blocks, blocks);
  
  // Save content changes
  for (const change of contentChanges) {
    await updateBlockContent(
      change.id,
      change.content,
      change.tag,
      change.metadata
    );
  }
  
  // Save structure changes
  if (structureChanged) {
    const bookStructure = blocks.map(b => ({
      id: b.id,
      hidden: !b.isVisible
    }));
    
    await updateBookStructure(bookStructure, 'Updated structure');
  }
}
```

## Implementation Timeline

### Phase 1: Database Setup (Day 1)
- [ ] Create Supabase project
- [ ] Run schema creation SQL
- [ ] Test basic CRUD operations

### Phase 2: Migration Script (Day 2)
- [ ] Write migration script
- [ ] Test with sample data
- [ ] Run full migration
- [ ] Verify data integrity

### Phase 3: API Integration (Days 3-4)
- [ ] Update editor load function
- [ ] Update save functionality
- [ ] Add version history viewing
- [ ] Test all operations

### Phase 4: UI Updates (Day 5)
- [ ] Add version history sidebar
- [ ] Add "view previous version" functionality
- [ ] Update save status indicators
- [ ] Final testing

## Benefits of This Approach

1. **Efficient Storage**: Content stored once, structure changes are lightweight
2. **Simple Versioning**: Automatic with timestamps, no complex version numbers
3. **Easy Rollback**: Can restore any previous state by date
4. **Minimal Changes**: Editor UI remains mostly the same
5. **Future-Proof**: Can add fields without migration

## Evaluation.json Integration

Keep `evaluation.json` as a static file since it won't change. The editor can load it separately:

```javascript
// In editor component
const evaluations = await fetch('/evaluation.json').then(r => r.json());

// Match evaluations to blocks by ID
blocks.forEach(block => {
  block.evaluation = evaluations[block.id];
});
```

This approach maintains the simplicity you want while providing robust versioning and history tracking.