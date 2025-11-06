# Daily Gospel Readings (DGR) System

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Route Structure](#route-structure)
5. [API Endpoints](#api-endpoints)
6. [Key Features](#key-features)
7. [Data Flow](#data-flow)
8. [Business Logic](#business-logic)
9. [Refactoring Opportunities](#refactoring-opportunities)
10. [Security Considerations](#security-considerations)

---

## Overview

The Daily Gospel Readings (DGR) system is a comprehensive content management platform for scheduling, writing, reviewing, and publishing daily Catholic Gospel reflections. It coordinates multiple contributors, automates assignment workflows, and integrates with liturgical calendar data and WordPress publishing.

**Purpose**: Manage the entire lifecycle of daily Gospel reflections from assignment to publication.

**Key Users**:
- **Administrators**: Manage schedules, contributors, templates, and publishing
- **Contributors**: Write reflections via tokenized submission links
- **Public Visitors**: Read published reflections on WordPress

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                    DGR Management Dashboard                  │
│  (Admin Interface - /dgr/*)                                  │
├─────────────────────────────────────────────────────────────┤
│  ├─ Schedule Management  (view/assign/track submissions)    │
│  ├─ Contributor Management  (CRUD + scheduling patterns)    │
│  ├─ Assignment Rules  (liturgical-based auto-assignment)    │
│  ├─ Liturgical Calendar  (import/manage calendar data)      │
│  ├─ Template Editor  (HTML templates for WordPress)         │
│  ├─ Promo Tiles  (promotional content management)           │
│  └─ Publishing  (send to WordPress)                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Contributor Submission Interface                │
│  (/dgr/write/[token])                                        │
│  - Tokenized, no login required                             │
│  - Pre-filled with Gospel readings                          │
│  - Simple form for title, quote, reflection                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    WordPress Publishing                      │
│  (External integration via /api/dgr/publish)                │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack
- **Frontend**: Svelte 5 with runes syntax
- **Backend**: SvelteKit API routes
- **Database**: PostgreSQL (Supabase) with JSONB for flexible data
- **Auth**: Platform module-based (`dgr` module required)
- **External APIs**:
  - Lectionary database (local) via `get_readings_for_date()` RPC
  - WordPress REST API for publishing

---

## Database Schema

### 1. `dgr_schedule` (Core table)
**Purpose**: Tracks daily reflection assignments and submissions

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `date` | date | Date for the reflection (unique constraint) |
| `contributor_id` | uuid | FK to dgr_contributors |
| `contributor_email` | text | Cached email for convenience |
| `submission_token` | text | Secure token for contributor access |
| `status` | enum | `pending`, `submitted`, `approved`, `published` |
| `liturgical_date` | text | Name of liturgical day (e.g., "1st Sunday of Advent") |
| `gospel_reference` | text | Legacy field, Gospel reference string |
| `gospel_text` | text | Legacy field, full Gospel text |
| `gospel_quote` | text | Short quote selected for the reflection |
| `readings_data` | jsonb | **JSONB structure** with all readings (see below) |
| `reflection_title` | text | Title of the reflection |
| `reflection_content` | text | Full reflection text |
| `reminder_history` | jsonb | Array of reminder send timestamps |
| `submitted_at` | timestamptz | When contributor submitted |
| `approved_at` | timestamptz | When admin approved |
| `published_at` | timestamptz | When published to WordPress |
| `created_at` | timestamptz | Record creation |
| `updated_at` | timestamptz | Last update |

**readings_data JSONB Structure**:
```json
{
  "combined_sources": "Genesis 1:1-5; Psalm 19:2-5; Mark 1:14-20",
  "first_reading": {
    "source": "Genesis 1:1-5",
    "text": "Full reading text...",
    "heading": "A reading from the Book of Genesis"
  },
  "psalm": {
    "source": "Psalm 19:2-5",
    "text": "Psalm text..."
  },
  "second_reading": {
    "source": "1 Corinthians 12:4-11",
    "text": "Reading text...",
    "heading": "A reading from..."
  },
  "gospel": {
    "source": "Mark 1:14-20",
    "text": "Gospel text...",
    "heading": "A reading from the holy Gospel according to Mark"
  }
}
```

### 2. `dgr_contributors`
**Purpose**: Manages contributors who write reflections

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Full name |
| `email` | text | Email address (unique) |
| `active` | boolean | Whether contributor is currently active |
| `access_token` | text | Permanent access token for contributor dashboard |
| `preferred_days` | integer[] | Array of day-of-week preferences (0=Sun, 6=Sat) |
| `schedule_pattern` | jsonb | **Auto-assignment pattern** (see below) |
| `notes` | text | Admin notes |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**schedule_pattern JSONB Structure**:
```json
{
  "type": "day_of_month",  // or "day_of_week"
  "value": 15,              // day number (1-31) or weekday (0-6)
  "enabled": true
}
```
- `day_of_month`: Contributor is auto-assigned the 15th of every month
- `day_of_week`: Contributor is auto-assigned every Tuesday (2)

### 3. `dgr_assignment_rules`
**Purpose**: Conditional logic for auto-assignment based on liturgical calendar

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Rule name (e.g., "Block Sundays") |
| `description` | text | Human-readable explanation |
| `active` | boolean | Whether rule is enabled |
| `priority` | integer | Execution order (higher = first) |
| **Condition Fields** | | |
| `condition_season` | text | "Advent", "Christmas", "Lent", "Easter", "Ordinary Time" |
| `condition_day_type` | text | "Sunday", "Weekday", "Solemnity", "Feast" |
| `condition_week_number` | text | Week number(s) in season |
| `condition_liturgical_day_contains` | text | Text search in liturgical day name |
| **Action Fields** | | |
| `action_type` | text | `block` or `assign_contributor` |
| `action_value` | text | Contributor ID (if assign), empty if block |
| `action_message` | text | Message shown when rule triggered |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Rule Execution**:
1. Rules are sorted by priority (descending)
2. First matching rule wins
3. `block` rules prevent any assignment
4. `assign_contributor` rules override normal rotation

### 4. `dgr_templates`
**Purpose**: HTML templates for WordPress publishing

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `template_key` | text | Unique identifier (e.g., "default", "advent_2024") |
| `version` | integer | Version number for template_key |
| `name` | text | Display name |
| `description` | text | Template description |
| `html` | text | **HTML template with {{variables}}** |
| `variables` | text[] | Required variable names |
| `config` | jsonb | Additional configuration |
| `is_active` | boolean | Whether this version is active |
| `thumbnail_url` | text | Preview image URL |
| `thumbnail_generated_at` | timestamptz | When thumbnail was generated |
| `created_at` | timestamptz | |
| `created_by` | uuid | User who created it |

**Template Variables**:
- `{{title}}` - Reflection title
- `{{date}}` - ISO date
- `{{formattedDate}}` - Human-readable date
- `{{liturgicalDate}}` - Liturgical day name
- `{{readings}}` - Combined readings string
- `{{gospelQuote}}` - Selected quote
- `{{reflectionText}}` - Full reflection
- `{{authorName}}` - Contributor name
- `{{gospelFullText}}` - Full Gospel reading
- `{{gospelReference}}` - Gospel citation

### 5. `dgr_promo_tiles`
**Purpose**: Promotional content tiles shown in published reflections

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `position` | integer | Display order (1, 2, 3) |
| `image_url` | text | Image URL |
| `title` | text | Tile title |
| `link_url` | text | Click destination URL |
| `active` | boolean | Whether tile is shown |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## Route Structure

### Admin Routes (require `dgr` module)

```
/dgr/
├── +layout.server.ts         # Auth check (requireModule 'dgr')
├── +layout.svelte             # Navigation wrapper (DGRNavigation)
├── +page.server.ts            # Root dashboard auth
└── +page.svelte               # Main dashboard (Schedule Management)
    │
    ├── Schedule View
    │   ├── Filter by all/submissions only
    │   ├── Date range selector (30/60/90/180/365 days)
    │   ├── DGRScheduleTable component
    │   ├── Status updates (pending/submitted/approved/published)
    │   ├── Assign/reassign contributors
    │   ├── Get/edit readings
    │   ├── Send reminder emails
    │   ├── Quick add reflection modal
    │   └── Delete schedule entries
    │
    └── Modals
        ├── DGRReviewModal (review/edit submissions)
        ├── Delete Confirmation
        ├── Edit Readings
        └── Quick Add Reflection (DGRForm)

/dgr/submissions/
└── +page.svelte               # View all submissions (filtered)

/dgr/contributors/
└── +page.svelte               # Contributor CRUD + pattern management

/dgr/rules/
└── +page.svelte               # Assignment rules management

/dgr/liturgical-calendar/
└── +page.svelte               # Import/manage liturgical calendar data

/dgr/templates/
├── +layout.server.ts          # Template-specific auth
├── +page.server.ts
└── +page.svelte               # HTML template editor with preview

/dgr/promo/
└── +page.svelte               # Promotional tiles editor

/dgr/publish/
├── +page.server.ts
└── +page.svelte               # Batch publishing interface
```

### Contributor Routes (public, token-based)

```
/dgr/write/[token]/
├── +page.js                   # Load schedule by token
└── +page.svelte               # Submission form (DGRForm component)
```

---

## API Endpoints

### Admin Endpoints (require authentication)

#### 1. `/api/dgr-admin/schedule` (GET, POST)

**GET** - Fetch schedule with pattern-based entries
- **Query Params**:
  - `days` (default: 90): Number of days ahead to fetch
  - `status`: Filter by status (pending/submitted/approved/published)
- **Returns**: Array of schedule entries (actual + pattern-based)
- **Logic**:
  1. Fetch actual `dgr_schedule` entries in date range
  2. Fetch `liturgical_calendar` data for dates
  3. Fetch contributors with `schedule_pattern`
  4. Calculate pattern-based dates using `calculatePatternDates()`
  5. Merge actual entries with pattern entries (actual takes precedence)
  6. Add liturgical calendar data to all entries
  7. Return sorted by date

**POST** - Multiple actions via `action` field

**Actions**:

| Action | Parameters | Description |
|--------|-----------|-------------|
| `generate_schedule` | `startDate`, `days` | Create schedule entries with readings |
| `update_assignment` | `scheduleId`, `contributorId` | Change contributor assignment |
| `approve_reflection` | `scheduleId` | Mark as approved, set approved_at |
| `update_status` | `scheduleId`, `status` | Change status manually |
| `update_readings` | `scheduleId`, `readings{}` | Edit liturgical readings |
| `delete_schedule` | `scheduleId` | Remove entry |
| `send_to_wordpress` | `scheduleId` | Publish to WordPress, mark published |
| `save_reflection` | Various (see below) | Save/update reflection content |

**save_reflection** Parameters:
- `scheduleId` (for updates) OR `contributorId` + `date` (for new)
- `liturgicalDate`, `readings`, `title`, `gospelQuote`, `content`, `authorName`, `status`

**generate_schedule Logic**:
1. Loop through date range
2. Skip if entry exists
3. Call `assign_contributor_to_date()` RPC (respects assignment rules)
4. Call `check_assignment_rules()` RPC if no contributor (get block reason)
5. Generate submission token via `generate_submission_token()` RPC
6. Fetch readings from `get_readings_for_date()` RPC
7. Insert schedule entry with readings_data JSONB
8. Return summary with blocked dates

#### 2. `/api/dgr-admin/contributors` (GET, POST, DELETE)

**GET** - Fetch all contributors
- **Returns**: Array of contributors with schedule patterns

**POST** - Create/update contributor
- **Body**: `{ name, email, preferred_days, schedule_pattern, notes }`
- **Returns**: Created/updated contributor

**DELETE** - Delete contributor
- **Body**: `{ id }`
- **Returns**: Deleted contributor

#### 3. `/api/dgr-admin/assignment-rules` (GET, POST, DELETE)

**GET** - Fetch all assignment rules
- **Returns**: Array of rules sorted by priority

**POST** - Create/update rule
- **Body**: Rule fields (conditions, actions, priority)
- **Returns**: Created/updated rule

**DELETE** - Delete rule
- **Body**: `{ id }`
- **Returns**: Deleted rule

#### 4. `/api/dgr-admin/promo-tiles` (GET, POST)

**GET** - Fetch promo tiles
- **Returns**: Array of tiles (up to 3)

**POST** - Update tiles
- **Body**: `{ tiles: [...] }`
- **Returns**: Updated tiles

#### 5. `/api/dgr-templates` (GET, POST, DELETE)

**GET** - Fetch templates
- **Query Params**: `template_key`, `version`
- **Returns**: Templates

**POST** - Create/update template
- **Body**: Template fields
- **Returns**: Created/updated template

**DELETE** - Delete template version
- **Body**: `{ id }`

### Public/Contributor Endpoints

#### 6. `/api/dgr/schedule/[token]` (GET)

**Purpose**: Load schedule entry by submission token

- **URL Param**: `token` - submission_token
- **Returns**: Schedule entry with readings
- **Used by**: Contributor submission form

#### 7. `/api/dgr/readings` (POST)

**Purpose**: Fetch liturgical readings for a date

- **Body**:
  - `date` - target date
  - `schedule_id` (optional) - to update existing entry
  - `contributor_id` (optional) - to create new entry
- **Returns**: Readings data from `get_readings_for_date()` RPC
- **Side Effect**: Updates or creates schedule entry with readings

#### 8. `/api/dgr/reminder` (POST)

**Purpose**: Send reminder email to contributor

- **Body**: `{ scheduleId, contributorId, date }`
- **Logic**:
  1. If `scheduleId` exists, update `reminder_history` array
  2. If pattern-based (no scheduleId), create schedule entry first
  3. Send reminder email via Resend
  4. Return reminder count
- **Returns**: `{ success, reminderCount }`

#### 9. `/api/dgr/publish` (POST)

**Purpose**: Publish reflection to WordPress

- **Body**: `{ date, liturgicalDate, readings, title, gospelQuote, reflectionText, authorName, gospelFullText, gospelReference, templateKey }`
- **Logic**:
  1. Fetch template HTML by templateKey
  2. Replace {{variables}} with actual values
  3. POST to WordPress REST API
  4. Return WordPress post ID
- **Returns**: `{ success, postId, postUrl }`

#### 10. `/api/dgr/contributor/[token]` (GET)

**Purpose**: Contributor dashboard (view their assignments)

- **URL Param**: `token` - contributor access_token
- **Returns**: Contributor info + their schedule entries

---

## Key Features

### 1. Schedule Generation with Auto-Assignment

**Workflow**:
1. Admin selects start date and number of days
2. System checks for existing entries (skips duplicates)
3. For each new date:
   - Calls `assign_contributor_to_date(date)` RPC
   - RPC checks assignment rules (blocks or assigns)
   - RPC uses contributor preferences and rotation logic
4. Fetches readings from lectionary database
5. Generates unique submission tokens
6. Creates schedule entries in bulk

**Assignment Logic** (in database RPC):
```sql
assign_contributor_to_date(target_date):
  1. Check assignment rules (may block or force-assign)
  2. If rule says assign specific contributor, return that ID
  3. If rule says block, return NULL
  4. Otherwise:
     a. Find active contributors
     b. Filter by preferred_days if date matches preference
     c. Use round-robin based on recent assignments
     d. Return contributor_id
```

### 2. Pattern-Based Scheduling

**Purpose**: Show "virtual" assignments based on contributor patterns without creating DB entries

**How it Works**:
- Contributors can have `schedule_pattern` JSONB:
  - `type: "day_of_month"` → Assigned to day 15 every month
  - `type: "day_of_week"` → Assigned every Tuesday
- GET `/api/dgr-admin/schedule` calculates pattern dates on-the-fly
- Returns both actual entries and pattern-based entries
- Pattern entries have `from_pattern: true` flag
- Allows admins to see upcoming assignments without committing to DB
- Can send reminders to pattern entries (creates actual entry on reminder)

**Calculation** (`calculatePatternDates()` in src/routes/api/dgr-admin/schedule/+server.js:214):
```javascript
day_of_month pattern:
  - Loop through months in range
  - For each month, create date with specified day
  - Add to results if within range

day_of_week pattern:
  - Loop through days in range
  - Check if current.getDay() === targetDay
  - Add to results
```

### 3. Reminder System

**Features**:
- Send reminder emails to contributors
- Track reminder history in `reminder_history` JSONB array
- Can send multiple reminders per assignment
- Automatically creates schedule entry for pattern-based dates

**Reminder History Structure**:
```json
[
  {
    "sent_at": "2025-11-05T10:30:00Z",
    "sent_by": "user-uuid",
    "email_status": "sent"
  },
  ...
]
```

### 4. Quick Add Reflection (Admin Entry)

**Purpose**: Admin can manually enter reflections without contributor submission

**Features**:
- Opens modal with DGRForm component
- Pre-fills date, readings, liturgical date
- "Paste from Word" button to parse formatted documents
- Word document parser extracts:
  - Date, Liturgical Date, Readings, Title
  - Gospel Quote, Reflection text, Author name
- Saves as `approved` status (ready for publishing)
- Works with both actual entries and pattern-based entries

**Word Document Format Expected**:
```
Date: [date text]
Liturgical Date: [liturgical name]
Readings: [scripture references]
Title: [reflection title]
Gospel quote: [selected quote]
Reflection written by: [author name]

[Reflection paragraphs...]

By [author name]
```

### 5. Template System

**Purpose**: Flexible HTML templates for WordPress publishing with variable substitution

**Features**:
- Version-controlled templates (template_key + version)
- Visual editor with HTML/preview tabs
- Variable syntax: `{{variableName}}`
- Thumbnail generation for previews
- Active version selection per template_key

**Publishing Flow**:
1. Admin clicks "Send to WordPress" on approved reflection
2. System fetches active template for `templateKey` (default: "default")
3. Replaces all `{{variables}}` with actual content
4. POSTs HTML to WordPress REST API
5. Updates schedule status to `published`
6. Sets `published_at` timestamp

### 6. Liturgical Calendar Integration

**Purpose**: Auto-populate readings and liturgical day names

**Data Source**: `liturgical_calendar` table (imported from Ordo CSV)

**Columns**:
- `calendar_date` - The date
- `liturgical_season` - Advent, Christmas, Lent, Easter, Ordinary Time
- `liturgical_week` - Week number in season
- `liturgical_name` - "1st Sunday of Advent", "Feast of the Annunciation"
- `liturgical_rank` - Solemnity, Feast, Memorial, Weekday

**Integration Points**:
- Schedule generation fetches calendar data for date range
- Adds liturgical context to schedule entries
- Assignment rules can condition on liturgical data
- Displayed in schedule table for admin context

### 7. Assignment Rules Engine

**Purpose**: Conditional logic for blocking or forcing assignments based on liturgical calendar

**Rule Structure**:
```json
{
  "name": "Block Sundays",
  "priority": 100,
  "conditions": {
    "day_type": "Sunday"
  },
  "action": {
    "type": "block",
    "message": "No reflections on Sundays (Mass readings only)"
  }
}
```

**Example Rules**:
1. **Block Sundays**: `condition_day_type = 'Sunday'` → `action_type = 'block'`
2. **Assign specific contributor for Advent**: `condition_season = 'Advent'` → `action_type = 'assign_contributor'`, `action_value = '<contributor-uuid>'`
3. **Block Holy Week**: `condition_liturgical_day_contains = 'Holy'` → `action_type = 'block'`

**Execution** (in `assign_contributor_to_date()` RPC):
1. Fetch all active rules, sort by priority DESC
2. For each rule, check if all conditions match
3. If match, execute action (block or assign)
4. First matching rule wins, stop processing

---

## Data Flow

### Scenario 1: Admin Generates Schedule

```
Admin Dashboard (/dgr)
    │
    ├─→ User enters startDate, days
    │
    ├─→ POST /api/dgr-admin/schedule { action: 'generate_schedule' }
    │       │
    │       ├─→ For each date in range:
    │       │   │
    │       │   ├─→ RPC: assign_contributor_to_date(date)
    │       │   │   └─→ Checks assignment rules
    │       │   │   └─→ Returns contributor_id or NULL
    │       │   │
    │       │   ├─→ RPC: get_readings_for_date(date)
    │       │   │   └─→ Fetches from liturgical_calendar & api_readings
    │       │   │   └─→ Returns readings_data JSONB
    │       │   │
    │       │   ├─→ RPC: generate_submission_token()
    │       │   │   └─→ Returns unique secure token
    │       │   │
    │       │   └─→ Insert into dgr_schedule
    │       │
    │       └─→ Returns: { success, message, entries, blockedDates }
    │
    └─→ UI: Toast notification with summary
    └─→ Reload schedule table
```

### Scenario 2: Contributor Submits Reflection

```
Contributor receives email with link:
https://app.com/dgr/write/abc123xyz

    │
    ├─→ GET /dgr/write/[token] (page loads)
    │   │
    │   ├─→ +page.js: fetch `/api/dgr/schedule/${token}`
    │   │   └─→ Returns schedule entry with readings pre-filled
    │   │
    │   └─→ +page.svelte: Renders DGRForm with pre-filled data
    │
    ├─→ Contributor fills:
    │   ├─ Reflection title (optional)
    │   ├─ Gospel quote (short excerpt)
    │   └─ Reflection text (paragraphs)
    │
    ├─→ Clicks "Submit Reflection"
    │   │
    │   ├─→ POST /api/dgr/schedule/[token]
    │   │   └─→ Updates dgr_schedule:
    │   │       - status = 'submitted'
    │   │       - reflection_title, gospel_quote, reflection_content
    │   │       - submitted_at = now()
    │   │
    │   └─→ Returns: { success }
    │
    └─→ UI: Thank you message + biblical blessing
```

### Scenario 3: Admin Reviews & Publishes

```
Admin Dashboard (/dgr)
    │
    ├─→ Schedule table shows entry with status 'submitted'
    │   └─→ Yellow badge: "Needs Approval"
    │
    ├─→ Admin clicks "Review"
    │   │
    │   └─→ Opens DGRReviewModal
    │       └─→ Shows: date, readings, title, quote, content
    │
    ├─→ Admin edits content if needed
    │   │
    │   └─→ POST /api/dgr-admin/schedule { action: 'save_reflection' }
    │       └─→ Updates reflection_content
    │
    ├─→ Admin clicks "Approve"
    │   │
    │   └─→ POST /api/dgr-admin/schedule { action: 'approve_reflection' }
    │       └─→ Updates: status = 'approved', approved_at = now()
    │
    ├─→ Admin clicks "Send to WordPress"
    │   │
    │   ├─→ POST /api/dgr-admin/schedule { action: 'send_to_wordpress' }
    │   │   │
    │   │   ├─→ Calls: POST /api/dgr/publish
    │   │   │   │
    │   │   │   ├─→ Fetch template HTML from dgr_templates
    │   │   │   ├─→ Replace {{variables}} with reflection data
    │   │   │   ├─→ POST to WordPress REST API
    │   │   │   └─→ Returns: { postId, postUrl }
    │   │   │
    │   │   └─→ Updates: status = 'published', published_at = now()
    │   │
    │   └─→ Returns: { success, wordpress: { postId, postUrl } }
    │
    └─→ UI: Green badge "Published", toast notification
```

---

## Business Logic

### Contributor Assignment Algorithm

**Location**: Database RPC function `assign_contributor_to_date()`

**Inputs**: `target_date` (date)

**Logic**:
1. **Check assignment rules** (priority order):
   - If rule matches date → return rule's action
   - If action = "block" → return NULL
   - If action = "assign_contributor" → return contributor_id

2. **Get active contributors**:
   - Filter: `active = true`
   - Join with recent assignments to calculate "last assigned"

3. **Apply preferred_days filter**:
   - Extract day-of-week from target_date (0=Sun, 6=Sat)
   - If contributor has preferred_days, only include if day matches
   - If no contributors match preference, include all active

4. **Round-robin selection**:
   - Sort contributors by `last_assigned` ASC (least recently assigned first)
   - Exclude contributors already assigned in past 7 days (configurable)
   - Return first contributor

5. **Return**: `contributor_id` or `NULL`

### Status State Machine

```
pending
   │
   ├──(contributor submits)──→ submitted
   │                               │
   │                               ├──(admin approves)──→ approved
   │                               │                          │
   │                               │                          ├──(admin publishes)──→ published
   │                               │                          │
   │                               └──(admin rejects)──→ pending
   │
   └──(admin direct entry)──→ approved ──→ published
```

**Status Meanings**:
- `pending`: Assigned but not yet submitted
- `submitted`: Contributor has submitted, needs admin review
- `approved`: Admin approved, ready for publishing
- `published`: Published to WordPress

**Allowed Transitions** (enforced in UI, not DB):
- Any status can move to `pending` (reset)
- `submitted` → `approved` (most common)
- `approved` → `published` (publishing action)
- Direct jumps allowed for admin corrections

### Template Variable Substitution

**Location**: `/api/dgr/publish` (+server.js)

**Process**:
1. Fetch template HTML from `dgr_templates` where `template_key = ? AND is_active = true`
2. Build variable map:
```javascript
const variables = {
  title: reflection_title,
  date: date (ISO),
  formattedDate: formatDate(date),
  liturgicalDate: liturgical_date,
  readings: readings_data.combined_sources,
  gospelQuote: gospel_quote,
  reflectionText: reflection_content,
  authorName: contributor.name,
  gospelFullText: readings_data.gospel.text,
  gospelReference: readings_data.gospel.source
};
```
3. Replace each `{{variable}}` in HTML:
```javascript
let html = template.html;
Object.entries(variables).forEach(([key, value]) => {
  const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
  html = html.replace(regex, value || '');
});
```
4. Sanitize HTML (optional, WordPress may do this)
5. POST to WordPress REST API `/wp-json/wp/v2/posts`

---

## Refactoring Opportunities

### 1. **DRY Violation: Supabase Client Initialization**

**Issue**: Each API route file initializes its own Supabase admin client:

```javascript
// Repeated in multiple files:
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
```

**Files affected**:
- `/api/dgr-admin/schedule/+server.js`
- `/api/dgr-admin/contributors/+server.js`
- `/api/dgr-admin/assignment-rules/+server.js`
- `/api/dgr-admin/promo-tiles/+server.js`
- `/api/dgr-templates/+server.js`
- `/api/dgr/readings/+server.js`
- `/api/dgr/publish/+server.js`
- `/api/dgr/reminder/+server.js`

**Recommendation**:
- Use existing `$lib/server/supabase.js` which exports `supabaseAdmin`
- Replace all manual initializations with: `import { supabaseAdmin } from '$lib/server/supabase.js';`

**Benefits**:
- Single source of truth for admin client configuration
- Easier to update connection settings
- Consistent error handling and logging

### 2. **Large Monolithic Component: /dgr/+page.svelte**

**Issue**: Main dashboard component is 1,385 lines, handling:
- Schedule management
- Contributor management (legacy, now separate)
- Promo tiles editor
- Quick add reflection modal
- Multiple modals (review, delete, edit readings)
- Word document parsing
- Email reminders

**Recommendation**:
- Extract modals into separate components:
  - `DGRDeleteConfirmModal.svelte`
  - `DGREditReadingsModal.svelte`
  - `DGRQuickAddModal.svelte`
- Move business logic to composable stores or utilities:
  - `$lib/stores/dgr-schedule.svelte.js` for schedule state
  - `$lib/utils/dgr-word-parser.js` for Word doc parsing
  - `$lib/utils/dgr-api.js` for API call wrappers

**Benefits**:
- Improved maintainability
- Better code organization
- Easier testing
- Component reusability

### 3. **Inconsistent API Error Handling**

**Issue**: Some API routes throw errors, others return `json({ error })`, inconsistent status codes

**Example inconsistencies**:
```javascript
// Some routes:
if (error) throw error;

// Others:
if (error) return json({ error: error.message }, { status: 500 });

// Others:
return json({ error: 'Unauthorized' }, { status: 401 });
```

**Recommendation**:
- Create API error handler utility:
```typescript
// $lib/server/api-errors.ts
export class ApiError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return json({ error: error.message }, { status: error.statusCode });
  }
  console.error('Unhandled API error:', error);
  return json({ error: 'Internal server error' }, { status: 500 });
}
```

- Use in all API routes:
```typescript
try {
  // ... logic
} catch (error) {
  return handleApiError(error);
}
```

**Benefits**:
- Consistent error responses
- Proper logging
- Type safety with TypeScript

### 4. **Missing Validation Layer**

**Issue**: API endpoints validate inputs inline, no reusable validation

**Example** (from `/api/dgr-admin/schedule`):
```javascript
if (!scheduleId || !contributorId) {
  throw new Error('Missing required parameters');
}
```

**Recommendation**:
- Use existing `$lib/utils/form-validator.js` system for API validation
- Create DGR-specific validators:
```typescript
// $lib/utils/dgr-validators.ts
export const scheduleValidators = {
  date: [validators.required, validators.custom(isValidDate)],
  contributorId: [validators.required, validators.custom(isUUID)],
  status: [validators.required, validators.oneOf(['pending', 'submitted', 'approved', 'published'])],
  reflectionContent: [validators.required, validators.minLength(100)]
};
```

**Benefits**:
- Reusable validation logic
- Consistent error messages
- Easier to add new validation rules

### 5. **Template Variable Replacement Using Regex**

**Issue**: Template substitution uses regex replacement per variable (inefficient for many variables)

**Current** (`/api/dgr/publish`):
```javascript
Object.entries(variables).forEach(([key, value]) => {
  const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
  html = html.replace(regex, value || '');
});
```

**Recommendation**:
- Use single-pass template engine like `mustache` or write custom parser:
```javascript
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}
```

**Benefits**:
- O(n) instead of O(n*m) complexity
- Handles nested objects if needed
- More maintainable

### 6. **Pattern Calculation Duplicated**

**Issue**: `calculatePatternDates()` function is embedded in `/api/dgr-admin/schedule/+server.js` but could be reused elsewhere

**Recommendation**:
- Extract to utility:
```typescript
// $lib/utils/schedule-patterns.ts
export function calculatePatternDates(
  pattern: SchedulePattern,
  startDate: string,
  endDate: string
): string[] {
  // ... implementation
}

export type SchedulePattern = {
  type: 'day_of_month' | 'day_of_week';
  value: number;
  enabled?: boolean;
};
```

**Benefits**:
- Testable in isolation
- Reusable for client-side preview
- Type-safe pattern definition

### 7. **Readings Data Structure Inconsistency**

**Issue**: Readings are stored in `readings_data` JSONB but also have legacy `gospel_reference` and `gospel_text` columns

**Schema confusion**:
- `gospel_reference` (text) - Legacy
- `gospel_text` (text) - Legacy
- `readings_data` (jsonb) - Current, has `gospel.source` and `gospel.text`

**Recommendation**:
- **Phase 1**: Update all code to use `readings_data` exclusively
- **Phase 2**: Create database migration to drop legacy columns
- **Phase 3**: Update types in `database.types.ts`

**Benefits**:
- Single source of truth for reading data
- Reduced storage (no duplication)
- Clearer data model

### 8. **Component Prop Drilling in DGR Components**

**Issue**: Many props passed through multiple levels (especially in schedule table)

**Example**: `DGRScheduleTable` receives 12+ callbacks as props

**Recommendation**:
- Use Svelte context API for common actions:
```typescript
// In +page.svelte
setContext('dgrActions', {
  updateAssignment,
  updateStatus,
  openReviewModal,
  sendToWordPress,
  // ...
});

// In DGRScheduleTable.svelte
const actions = getContext('dgrActions');
```

**Benefits**:
- Reduced prop drilling
- Cleaner component interfaces
- Easier to add new actions

---

## Security Considerations

### 1. **Submission Token Security**

**Current Implementation**:
- Tokens generated by `generate_submission_token()` RPC
- Stored in `submission_token` column (text)
- Used in public URL: `/dgr/write/[token]`

**Security Measures**:
- Tokens should be cryptographically random (UUID v4 or better)
- No token expiration (contributor can submit late)
- Token reveals assignment but not contributor identity directly

**Recommendations**:
- Add token expiration date field: `token_expires_at`
- Implement token rotation after submission
- Add rate limiting to token endpoint

### 2. **Contributor Access Tokens**

**Current Implementation**:
- Each contributor has permanent `access_token`
- Used for contributor dashboard: `/dgr/contributor/[token]`

**Security Concerns**:
- Permanent tokens with no expiration
- No revocation mechanism
- Token in URL (can leak in logs)

**Recommendations**:
- Implement token rotation
- Add `token_expires_at` and `token_last_used_at`
- Move token to request header (not URL)
- Add admin UI to revoke tokens

### 3. **WordPress API Credentials**

**Current Implementation**:
- WordPress credentials presumably in environment variables
- Used in `/api/dgr/publish`

**Recommendations**:
- Ensure credentials are in `.env` (not committed)
- Use WordPress application passwords (not admin password)
- Implement rate limiting on publish endpoint
- Log all publish actions with user attribution

### 4. **Admin Authorization**

**Current Implementation**:
- `requireModule(event, 'dgr')` in `+layout.server.ts`
- Checks if user has `dgr` module in profile

**Security Measures**:
- Module-based access control
- Server-side checks on all API routes
- No client-side permission checks bypass

**Recommendations**:
- Add audit logging for all admin actions
- Implement role-based permissions within `dgr` module (viewer, editor, publisher)
- Add 2FA requirement for publishing action

### 5. **JSONB Injection**

**Potential Issue**:
- `readings_data`, `schedule_pattern`, `reminder_history` are JSONB
- User input stored in JSONB without validation

**Recommendations**:
- Validate JSONB structure before insert
- Use TypeScript interfaces for type safety
- Sanitize HTML content in reflections (already done via DOMPurify in publish)

### 6. **SQL Injection via RPC Functions**

**Current Implementation**:
- Most database operations use Supabase client (parameterized)
- RPC functions use `target_date` parameter

**Security Measures**:
- Supabase parameterizes all queries
- RPC functions use typed parameters

**Recommendations**:
- Audit custom RPC functions for SQL injection
- Use prepared statements in all custom functions
- Add input validation in RPC function definitions

---

## Performance Considerations

### 1. **Schedule Query Optimization**

**Current Issue**:
- GET `/api/dgr-admin/schedule` fetches all entries in range
- Calculates pattern dates on every request
- Joins with contributor table

**Optimization Ideas**:
- Cache pattern date calculations
- Use database indexes on `date` and `contributor_id`
- Implement pagination for large date ranges

### 2. **N+1 Query Problem**

**Potential Issue**:
- Loading schedule with contributors (using `.select('*, contributor:dgr_contributors(name, email)')`)

**Current Status**: Properly using Supabase joins (no N+1)

### 3. **Liturgical Calendar Lookup**

**Current Implementation**:
- Separate query for liturgical calendar data
- Uses `.gte()` and `.lte()` filters

**Optimization Ideas**:
- Pre-join calendar data in schedule query
- Use materialized view for common date ranges

---

## Future Enhancements

### 1. **Batch Publishing**
- Select multiple approved reflections
- Publish all to WordPress in sequence
- Show progress bar

### 2. **Contributor Statistics**
- Dashboard showing contributor activity
- Submissions per month
- Average approval time
- On-time submission rate

### 3. **Email Templates**
- HTML email templates for reminders
- Customizable per contributor or date type
- Include Gospel reading preview

### 4. **Mobile App for Contributors**
- React Native or PWA
- Offline composition
- Push notifications for reminders

### 5. **Advanced Assignment Rules**
- "Assign to least active contributor"
- "Rotate between 3 specific contributors"
- "Skip contributor if submitted in past 14 days"

### 6. **Content Version History**
- Track edits to reflections
- Show diff between versions
- Revert to previous version

---

## Related Documentation

- [AUTH_SYSTEM.md](../AUTH_SYSTEM.md) - Authentication and module system
- [EMAIL_SYSTEM.md](../EMAIL_SYSTEM.md) - Email integration details
- [LECTIONARY.md](../LECTIONARY.md) - Liturgical calendar system
- [DGR_MANAGEMENT_PLAN.md](../DGR_MANAGEMENT_PLAN.md) - Original implementation plan

---

**Last Updated**: 2025-11-05
**Document Version**: 1.0
**Status**: Complete ✅
