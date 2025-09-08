# Content Editor Integration Guide

## Unique ID System for Custom Editor

This system assigns unique, stable IDs to every content block, making it perfect for building custom content editors, version control, and collaborative editing systems.

## ID Structure

### Chapter IDs
```
ch_001_a1b2c3d4
└── └── └──────
│   │   └─ Content hash (8 chars)
│   └─ Chapter number (3 digits)
└─ Content type prefix
```

### Block IDs
```
blk_001_00042_a1b2c3d4
└── └── └──── └──────
│   │   │     └─ Content hash (8 chars)
│   │   └─ Block number (5 digits)
│   └─ Chapter number (3 digits)  
└─ Content type prefix
```

### Section IDs
```
sec_001_003_a1b2c3d4
└── └── └── └──────
│   │   │   └─ Content hash (8 chars)
│   │   └─ Section number (3 digits)
│   └─ Chapter number (3 digits)
└─ Content type prefix
```

## Generated XML Structure

```xml
<?xml version="1.0" ?>
<book id="book_001" created="2025-08-19T15:30:00" source="AHWGP_original.html">
  <metadata>
    <title>At Home With God's People</title>
    <subtitle>Our Catholic Faith</subtitle>
    <format>structured_xml_with_ids</format>
    <version>2.0</version>
  </metadata>
  
  <chapter id="ch_001_a1b2c3d4" number="1" title="In Search of God">
    <chapter_title id="blk_001_00001_e5f6g7h8">In Search of God</chapter_title>
    
    <paragraph id="blk_001_00002_i9j0k1l2" 
               original_class="body-1-first-par"
               content_type="paragraph"
               paragraph_type="first"
               indent="none">
      Part of being human is to be always searching for happiness...
    </paragraph>
    
    <section id="sec_001_001_m3n4o5p6" level="2">
      <section_title id="blk_001_00003_q7r8s9t0">Reflect</section_title>
      
      <callout_text id="blk_001_00004_u1v2w3x4"
                    original_class="box-text"
                    content_type="callout_text"
                    layout="callout">
        Can you recall something that was a real help to you...
      </callout_text>
    </section>
  </chapter>
  
  <chapter id="ch_002_y5z6a7b8" number="2" title="Prayer">
    <!-- More content blocks with unique IDs -->
  </chapter>
</book>
```

## Content Editor Features Enabled

### 1. **Granular Editing**
Each paragraph, heading, and callout box has a unique ID for individual editing:

```javascript
// Edit specific content block
function editBlock(blockId, newContent) {
  const block = document.querySelector(`[data-id="${blockId}"]`);
  block.textContent = newContent;
  
  // Save to backend with specific ID
  saveBlockContent(blockId, newContent);
}
```

### 2. **Version Control Integration**
Track changes at the block level:

```javascript
// Version control example
const contentHistory = {
  "blk_001_00042_a1b2c3d4": [
    { version: 1, content: "Original text...", timestamp: "2025-01-01" },
    { version: 2, content: "Edited text...", timestamp: "2025-01-02" }
  ]
};
```

### 3. **Collaborative Editing**
Multiple editors can work on different blocks simultaneously:

```javascript
// Real-time collaboration
function lockBlock(blockId, userId) {
  socket.emit('block_lock', { blockId, userId });
}

function unlockBlock(blockId) {
  socket.emit('block_unlock', { blockId });
}
```

### 4. **Content Management**
Easy content organization and search:

```javascript
// Find all callout boxes in chapter 5
const callouts = content.chapters
  .find(ch => ch.number === "5")
  .content_blocks
  .filter(block => block.content_type === "callout_text");
```

## Custom Editor Components

### Block Editor Component
```javascript
class BlockEditor {
  constructor(blockId, blockType, content, attributes) {
    this.blockId = blockId;
    this.blockType = blockType;
    this.content = content;
    this.attributes = attributes;
  }
  
  render() {
    return `
      <div class="editor-block" data-id="${this.blockId}" data-type="${this.blockType}">
        <div class="block-toolbar">
          <span class="block-id">${this.blockId}</span>
          <button onclick="editBlock('${this.blockId}')">Edit</button>
          <button onclick="moveBlock('${this.blockId}')">Move</button>
        </div>
        <div class="block-content" contenteditable="true">
          ${this.content}
        </div>
      </div>
    `;
  }
}
```

### Chapter Navigation
```javascript
function generateChapterNav(chapters) {
  return chapters.map(chapter => `
    <li>
      <a href="#${chapter.id}" data-chapter="${chapter.number}">
        ${chapter.title}
      </a>
      <span class="block-count">${chapter.content_blocks.length} blocks</span>
    </li>
  `).join('');
}
```

## API Endpoints for Editor

### Content Management
```javascript
// GET /api/content/:blockId - Get specific block
// PUT /api/content/:blockId - Update specific block  
// POST /api/content/:chapterId - Add new block to chapter
// DELETE /api/content/:blockId - Delete block
// GET /api/chapters - List all chapters
// POST /api/chapters - Create new chapter
```

### Block Operations
```javascript
// POST /api/blocks/move - Move block to different position
// POST /api/blocks/duplicate - Duplicate block
// POST /api/blocks/merge - Merge multiple blocks
// GET /api/blocks/search?q=text - Search content blocks
```

## Export Options

### Back to InDesign
```javascript
function exportToInDesign(chapters) {
  // Convert back to InDesign-compatible XML
  // Preserve all formatting attributes
  // Maintain block relationships
}
```

### Web Publication
```javascript
function exportToWeb(chapters) {
  // Generate clean HTML with semantic markup
  // Include all accessibility attributes
  // Responsive design ready
}
```

### Print-Ready PDF
```javascript
function exportToPDF(chapters) {
  // High-resolution formatting
  // Professional typography
  // Print-optimized layout
}
```

## Benefits for Custom Editor

1. **Persistent IDs**: Content blocks keep same ID even when moved or edited
2. **Hierarchical Structure**: Clear parent-child relationships
3. **Semantic Attributes**: Rich metadata for intelligent editing
4. **Version Control**: Track changes at granular level
5. **Collaborative Editing**: Multiple users can edit different blocks
6. **Search & Filter**: Find content by type, attributes, or content
7. **Undo/Redo**: Block-level operation history
8. **Import/Export**: Round-trip compatibility with InDesign

## Running the Extraction

```bash
# In your Docker environment
./dev.sh shell
cd /app
python scripts/html_to_structured_xml.py
```

This creates `AHWGP_structured_with_ids.xml` with every content block having a unique, stable identifier perfect for custom editor integration!