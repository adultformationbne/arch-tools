# ACCF Platform Documentation

**Archdiocesan Center for Catholic Formation - Complete System Documentation**

This document is the single source of truth for the ACCF platform. Use this for context when working with AI agents.

---

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Database Architecture](#database-architecture)
3. [User Flows](#user-flows)
4. [Admin Interface](#admin-interface)
5. [Student Interface](#student-interface)
6. [API Endpoints](#api-endpoints)
7. [Design System](#design-system)
8. [Development Guidelines](#development-guidelines)

---

## Platform Overview

### What is ACCF?
An 8-session course platform for Catholic formation with 4 independent modules:
1. **Foundations of Faith**
2. **Scripture & Tradition**
3. **Sacraments & Liturgy**
4. **Moral Teaching**

### Key Facts
- **Duration**: 8 weekly sessions per module
- **Timeline**: 2 cohorts/year (February & August), 2 years to complete all modules
- **Users**: Admins, Hub Coordinators, Students
- **Tech Stack**: SvelteKit 5, Supabase, Tailwind CSS v4

### Quick Start
```bash
npm run dev                          # http://localhost:5174
/admin/cohorts                       # Admin interface
/dashboard                           # Student dashboard (after login)
```

---

## Database Architecture

### Core Tables

#### `modules` - Content Templates
```sql
modules (
  id uuid PRIMARY KEY,
  name text,                         -- "Foundations of Faith"
  description text,
  order_number integer UNIQUE        -- Display order (1-4)
)
```
- **4 modules total** - Templates for all cohorts
- Content defined once, inherited by all cohorts

#### `module_materials` - Content Library
```sql
module_materials (
  id uuid PRIMARY KEY,
  module_id uuid REFERENCES modules,
  session_number integer,            -- 1-8
  type text,                         -- 'video', 'document', 'link', 'native', 'image'
  title text,
  content text,                      -- URL or HTML content
  display_order integer
)
```
- **Module-level content** - Not duplicated per cohort
- Types: YouTube videos, Google Drive docs, web links, native HTML

#### `module_reflection_questions` - Prompts
```sql
module_reflection_questions (
  id uuid PRIMARY KEY,
  module_id uuid REFERENCES modules,
  session_number integer,            -- 1-8
  question_text text
)
```
- **One question per session** - 8 total per module

#### `cohorts` - Module Instances
```sql
cohorts (
  id uuid PRIMARY KEY,
  module_id uuid REFERENCES modules,
  name text,                         -- "Spring 2025 - Foundations"
  start_date date,
  end_date date,                     -- Auto-calculated (start + 8 weeks)
  status text,                       -- 'draft', 'scheduled', 'active', 'completed'
  created_at timestamptz,
  updated_at timestamptz
)
```
- **Instances of modules** - Inherits all content from parent module
- Status auto-transitions: scheduled→active (on start), active→completed (on end)

#### `user_profiles` - Platform Identity
```sql
user_profiles (
  id uuid PRIMARY KEY,               -- Links to auth.users.id
  email text UNIQUE,
  full_name text,
  display_name text,
  role text,                         -- 'accf_admin', 'hub_coordinator', 'accf_student'
  avatar_url text,
  completed_cohorts jsonb,           -- Array of completed cohort IDs
  created_at timestamptz,
  updated_at timestamptz
)
```
- **Platform-wide identity** - Used for auth, permissions, profile
- **All users** have a user_profile (DGR, Editor, ACCF, etc.)

#### `accf_users` - Program Participation ⭐ CRITICAL TABLE
```sql
accf_users (
  id uuid PRIMARY KEY,
  auth_user_id uuid REFERENCES auth.users,  -- NULL until signup complete
  email text NOT NULL,                      -- Snapshot at invitation time
  full_name text NOT NULL,                  -- Snapshot at invitation time
  role text NOT NULL,                       -- 'accf_student', 'hub_coordinator', 'accf_admin'

  -- Cohort assignment
  cohort_id uuid NOT NULL REFERENCES cohorts,
  hub_id uuid REFERENCES hubs,
  assigned_admin_id uuid REFERENCES user_profiles,

  -- Progression
  current_session integer DEFAULT 1,        -- 1-8
  status text NOT NULL DEFAULT 'pending',   -- See status machine below

  -- Invitation workflow
  invitation_token uuid UNIQUE DEFAULT gen_random_uuid(),
  invitation_sent_at timestamptz,
  invitation_accepted_at timestamptz,

  -- Audit
  error_message text,
  imported_by uuid REFERENCES user_profiles,
  enrolled_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(email, cohort_id)                  -- Can't join same cohort twice
)
```

**Status State Machine:**
```
pending → invited → accepted → active → completed
            ↓          ↓         ↓
          error      held    withdrawn
```

- **pending**: Uploaded via CSV, no invitation sent
- **invited**: Invitation email sent successfully
- **accepted**: User completed signup (auth_user_id populated)
- **active**: Participating in cohort (auto-transition from accepted)
- **held**: Admin paused progression
- **completed**: Finished all 8 sessions
- **withdrawn**: Left program
- **error**: Import or email error

#### `hubs` - Local Groups
```sql
hubs (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  coordinator_id uuid REFERENCES user_profiles,
  location text,
  created_at timestamptz,
  updated_at timestamptz
)
```
- **Auto-created during CSV upload** - Case-insensitive matching
- Prevents duplicates: "St. Mary's" === "St Marys" === "St Mary's"

#### `attendance` - Session Tracking
```sql
attendance (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES user_profiles,
  cohort_id uuid REFERENCES cohorts,
  session_number integer,            -- 1-8
  present boolean,
  marked_by uuid REFERENCES user_profiles,
  attendance_type text,              -- 'hub', 'flagship'
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
```

### The Two-Table Relationship

**Why both `user_profiles` AND `accf_users`?**

```
auth.users (Supabase Auth)
    ↓ (id)
    ├─→ user_profiles (Platform identity - ALL users)
    │       - Who they are across the entire arch-tools platform
    │       - Used for: Auth, permissions, profile management
    │
    └─→ accf_users.auth_user_id (ACCF participation)
            - Their journey through a specific cohort
            - NULL until signup complete
            - Used for: Course enrollment, progression, reflections
```

**Data Duplication is Intentional:**
- `email`, `full_name`, `role` exist in both tables
- `accf_users` stores "invitation snapshot" - what was used when invited
- `user_profiles` stores "current data" - what they've updated to
- **Reason**: Need to track pre-signup users who don't have auth accounts yet

**When to Use Which:**

| Use Case | Table |
|----------|-------|
| Send invitation email | `accf_users.email` |
| Display student name (not signed up) | `accf_users.full_name` |
| Display student name (signed up) | `user_profiles.full_name` (via join) |
| Check permissions | `user_profiles.role` |
| Student dashboard | `user_profiles` + `accf_users` join |
| Cohort roster | `accf_users` + join `user_profiles` |

---

## User Flows

### Admin: Create Cohort & Add Students

**1. Create Cohort**
```
/admin/cohorts → Click "New Cohort" → CohortCreationWizard opens
  ↓
Select Module → Set dates → Name cohort → Click "Create"
  ↓
Cohort created with status='draft'
  ↓
Inherits all module_materials and module_reflection_questions
```

**2. Add Students (Two Methods)**

**Method A: Single Student**
```
Select cohort → Click "Add Students" → "Add Single Student"
  ↓
Fill form: name, email, role, hub → Submit
  ↓
INSERT INTO accf_users (status='pending', invitation_token=gen_random_uuid())
```

**Method B: CSV Upload**
```
Download CSV template → Fill with student data → Upload
  ↓
Hub normalization (case-insensitive matching, auto-create if new)
  ↓
Check for duplicates (email + cohort_id)
  ↓
INSERT INTO accf_users (status='pending' for each student)
  ↓
Log to accf_user_imports table
```

**CSV Format:**
```csv
full_name,email,role,hub
John Smith,john@example.com,accf_student,St. Mary's Parish
Jane Doe,jane@example.com,hub_coordinator,Downtown Hub
```

**3. Send Invitations**
```
Select students (checkboxes) → Click "Send Invitations (X)"
  ↓
Filter: Only students with status='pending'
  ↓
Send emails via Resend with invitation_token
  ↓
Email contains: /signup?token={invitation_token}
  ↓
UPDATE accf_users SET status='invited', invitation_sent_at=now()
```

### Student: Signup & Enrollment

**1. Receive Invitation**
```
Email arrives → Click link → /signup?token={uuid}
```

**2. Complete Signup**
```
/signup page validates token → Loads accf_users record
  ↓
User fills form: password, confirm
  ↓
Creates Supabase Auth account (auth.users)
  ↓
INSERT INTO user_profiles (id=auth_user_id, email, full_name, role)
  ↓
UPDATE accf_users SET auth_user_id=$id, status='accepted'
  ↓
Auto-transition to status='active'
  ↓
Redirect to /dashboard
```

**3. Student Dashboard**
```
Query: JOIN user_profiles + accf_users + cohorts + modules
  ↓
Show: Current session materials, reflection prompt, progress bar
  ↓
Progressive revelation: Only show sessions 1 through current_session
```

### Admin: Manage Students

**Edit Student (Before Signup)**
```
Cohort page → Click edit icon → Modify name/role/hub → Save
  ↓
Only allowed if auth_user_id IS NULL
  ↓
UPDATE accf_users WHERE id=$id
```

**Delete Student (Before Signup)**
```
Cohort page → Click trash icon → Confirm
  ↓
Only allowed if auth_user_id IS NULL
  ↓
DELETE FROM accf_users WHERE id=$id
```

**Advance Student Progression**
```
Mark reflections → Click "Advance to Session 5"
  ↓
UPDATE accf_users SET current_session=5 WHERE id=$id
  ↓
Student now sees sessions 1-5 on dashboard
```

---

## Admin Interface

### `/admin/cohorts` - Main Dashboard

**Layout:**
```
[Header: "Cohort Management" | CSV Template | New Cohort]
├─ Horizontal Cards (Last 3 cohorts)
│  └─ CohortCard: name, module, students, sessions, status dot
└─ CohortManager (Selected cohort)
   ├─ Cohort Settings (inline edit: name, module, dates)
   ├─ Students Table
   │  ├─ Columns: [✓] Name | Email | Role | Hub | Status | Actions
   │  ├─ Pending users: Can select for invitations, edit, delete
   │  └─ Active users: Show "-" in checkbox, "Active" in actions
   └─ Actions: [Send Invitations (X)] [Add Students]
```

**Key Components:**

- **CohortCard.svelte** - Minimal horizontal card with status indicator
- **CohortManager.svelte** - Comprehensive management interface
  - Inline editing for cohort settings
  - Student CRUD with real-time updates
  - Bulk selection for invitations
  - Hub dropdown (normalized list)
- **CohortCreationWizard.svelte** - 3-step wizard
  - Step 1: Select module
  - Step 2: Set dates & name
  - Step 3: Optional CSV upload
- **StudentEnrollmentModal.svelte** - Add students after creation
  - Choice: Single or Bulk
  - Single: Form with name/email/role/hub
  - Bulk: CSV upload with validation

### `/admin/cohorts/api` - Unified API

**POST Actions:**
- `create_cohort` - Create new cohort
- `update_cohort` - Update cohort settings
- `delete_cohort` - Delete cohort (only if no students)
- `upload_csv` - Add students via CSV (requires cohortId)
- `update_accf_user` - Edit student (only if !auth_user_id)
- `delete_accf_user` - Remove student (only if !auth_user_id)
- `send_invitations` - Send emails to selected students

**GET Endpoint:**
- `?endpoint=accf_users&cohort_id=X` - Fetch all students for cohort

### Data Flow

**Page Load:**
```
+page.server.ts loads cohorts + student counts
  ↓
+page.svelte displays cards + manager
  ↓
CohortManager fetches students for selected cohort
```

**After Modal Action:**
```
Modal dispatches 'complete' event
  ↓
Parent increments refreshTrigger
  ↓
CohortManager $effect watches refreshTrigger
  ↓
Re-fetches students + calls onUpdate()
  ↓
Parent uses goto() with invalidateAll to refresh page
```

---

## Student Interface

### `/dashboard` - Main Hub

**Components:**
- Welcome card with module name
- Current session card with materials
- Reflection submission form
- Progress tracker (1-8 sessions)
- Past weeks access

**Progressive Revelation:**
```javascript
// Only show sessions 1 through current_session
const visibleSessions = sessions.filter(s => s.number <= user.current_session);
```

### `/reflections` - Submission & History

**Features:**
- Submit weekly reflection
- Toggle public/private visibility
- View past reflections
- See feedback from admin
- Pass/fail status

### `/week/[session]` - Session Content

**Dynamic Route:**
```
/week/1 → Session 1 materials
/week/2 → Session 2 materials (if current_session >= 2)
/week/9 → 404 (doesn't exist)
```

**Data Query:**
```sql
SELECT mm.*
FROM module_materials mm
JOIN cohorts c ON c.module_id = mm.module_id
JOIN accf_users au ON au.cohort_id = c.id
WHERE au.auth_user_id = $user_id
  AND mm.session_number = $session
  AND mm.session_number <= au.current_session
ORDER BY mm.display_order;
```

---

## API Endpoints

### Cohorts API: `/admin/cohorts/api`

**POST /admin/cohorts/api**
```typescript
{
  action: 'create_cohort',
  name: string,
  moduleId: uuid,
  startDate: date,
  endDate?: date  // Auto-calculated if omitted
}
→ Returns: { success: true, data: cohort, message: string }
```

```typescript
{
  action: 'upload_csv',
  cohortId: uuid,  // REQUIRED
  filename: string,
  data: Array<{
    full_name: string,
    email: string,
    role: string,
    hub?: string
  }>
}
→ Returns: {
  success: true,
  data: {
    importId: uuid,
    total: number,
    successful: number,
    errors: number,
    errorDetails: string[]
  }
}
```

```typescript
{
  action: 'send_invitations',
  userIds: uuid[]  // Only users with status='pending'
}
→ Returns: {
  success: true,
  data: {
    total: number,
    sent: number,
    failed: number,
    errors: Array<{ email: string, error: string }>
  }
}
```

**GET /admin/cohorts/api?endpoint=accf_users&cohort_id=X**
```typescript
→ Returns: {
  success: true,
  data: Array<{
    id: uuid,
    email: string,
    full_name: string,
    role: string,
    status: string,
    auth_user_id: uuid | null,
    cohorts: { name: string },
    hubs: { name: string }
  }>
}
```

### Hub Normalization Logic

```typescript
// Case-insensitive matching
const { data: existingHub } = await supabase
  .from('hubs')
  .select('id')
  .ilike('name', hubName)  // 'St. Mary\'s' matches 'ST MARYS'
  .single();

if (!existingHub) {
  // Create new hub
  const { data: newHub } = await supabase
    .from('hubs')
    .insert({ name: hubName })
    .select('id')
    .single();
}
```

---

## Design System

### Color Palette
```css
:root {
  --accf-darkest: #1e2322;   /* Dark forest green - headings */
  --accf-dark: #334642;      /* Main brand green - text */
  --accf-accent: #c59a6b;    /* Warm brown - CTAs, highlights */
  --accf-light: #eae2d9;     /* Cream - backgrounds */
  --accf-lightest: #ffffff;  /* White - cards */
}
```

### Typography
- **Headings**: Inter (Tailwind default) - ``
- **Body**: System font stack via Tailwind

### Component Patterns

**Buttons:**
```css
.btn-primary {
  background: var(--accf-accent);
  color: var(--accf-darkest);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
}

.btn-primary:hover {
  background: var(--accf-dark);
  color: white;
}
```

**Cards:**
```css
.accf-card {
  background: white;
  border: 1px solid var(--accf-light);
  border-radius: 12px;
  padding: 24px;
}
```

**Status Badges:**
```javascript
const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  invited: 'bg-blue-100 text-blue-800',
  accepted: 'bg-purple-100 text-purple-800',
  active: 'bg-emerald-100 text-emerald-800',
  held: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  withdrawn: 'bg-gray-100 text-gray-800',
  error: 'bg-red-100 text-red-800'
};
```

---

## Development Guidelines

### Svelte 5 Runes (MANDATORY)

```svelte
<script>
  // ✅ CORRECT - Svelte 5 syntax
  let count = $state(0);
  let doubled = $derived(count * 2);
  let { prop1, prop2 = 'default' } = $props();

  $effect(() => {
    console.log('Count changed:', count);
  });

  // ❌ WRONG - Svelte 4 syntax
  let count = 0;              // Use $state()
  $: doubled = count * 2;     // Use $derived()
  export let prop1, prop2;    // Use $props()
  $: console.log(count);      // Use $effect()
</script>
```

### Component Margin Rule

**Components NEVER apply their own horizontal margins:**

```svelte
<!-- ❌ WRONG - Component controlling its own margins -->
<div class="px-12 pb-12">
  <h2>Content</h2>
</div>

<!-- ✅ CORRECT - Parent controls all horizontal spacing -->
<!-- Component: -->
<div class="pb-12">
  <h2>Content</h2>
</div>

<!-- Parent page: -->
<div class="px-16">
  <MyComponent />
</div>
```

**Standard**: All pages use `px-16` (64px) for horizontal padding

### Reactive Updates Pattern

```svelte
<script>
  let refreshTrigger = $state(0);

  // In child component
  $effect(() => {
    if (refreshTrigger > 0) {
      loadData();
    }
  });

  // In parent, after modal action
  async function handleComplete() {
    refreshTrigger++;  // Triggers child reload
    await refreshData();
  }
</script>
```

### Permission Checks

```typescript
// Always check auth_user_id before allowing edits
const canEdit = !user.auth_user_id;  // Only if not signed up
const canInvite = user.status === 'pending';  // Only pending users

if (user.auth_user_id) {
  throw new Error('Cannot edit user who has completed signup');
}
```

### Common Queries

**Get cohort roster with user profiles:**
```sql
SELECT
  au.*,
  up.display_name,
  up.avatar_url,
  h.name AS hub_name
FROM accf_users au
LEFT JOIN user_profiles up ON up.id = au.auth_user_id
LEFT JOIN hubs h ON h.id = au.hub_id
WHERE au.cohort_id = $1
ORDER BY au.created_at DESC;
```

**Get student dashboard data:**
```sql
SELECT
  up.*,
  au.cohort_id,
  au.current_session,
  au.status,
  c.name AS cohort_name,
  c.start_date,
  c.end_date,
  m.name AS module_name
FROM user_profiles up
INNER JOIN accf_users au ON au.auth_user_id = up.id
INNER JOIN cohorts c ON c.id = au.cohort_id
INNER JOIN modules m ON m.id = c.module_id
WHERE up.id = $1
  AND au.status IN ('active', 'held');
```

---

## Testing Checklist

### Admin Flow
- [ ] Create cohort from module
- [ ] Add single student
- [ ] Upload CSV with 10+ students
- [ ] Edit pending student
- [ ] Delete pending student
- [ ] Select 5 students and send invitations
- [ ] Verify emails sent via Resend
- [ ] Check status changed to 'invited'
- [ ] Update cohort settings
- [ ] Delete empty cohort

### Student Flow
- [ ] Click invitation link
- [ ] Complete signup form
- [ ] Verify user_profiles created
- [ ] Verify accf_users.auth_user_id populated
- [ ] Verify status = 'active'
- [ ] Login and see dashboard
- [ ] View current session materials
- [ ] Submit reflection
- [ ] View past weeks (only up to current_session)

### Edge Cases
- [ ] Upload duplicate email in same cohort → Should error
- [ ] Upload same email in different cohort → Should succeed
- [ ] Try to edit user after signup → Should fail
- [ ] Try to delete user after signup → Should fail
- [ ] Hub name with different casing → Should match existing
- [ ] Upload CSV with missing required fields → Should error

---

## Current Status

**✅ Completed:**
- Database consolidated to single `accf_users` table
- Admin cohort management fully operational
- CSV upload with hub normalization
- Invitation sending via Resend
- Inline editing for cohorts and students
- Component-based architecture
- Reactive refresh system

**🚧 In Progress:**
- Signup page validation
- Student dashboard implementation
- Reflection submission system

**📋 Upcoming:**
- Reflection marking interface
- Attendance tracking
- Progress advancement workflow
- Hub coordinator interface

---

## Key Files Reference

```
src/routes/(courses)/
├── ACCF.md                                    # THIS FILE
├── ACCF_DATABASE.md                           # Detailed database docs
├── +layout.svelte                             # Courses layout with styling
├── admin/
│   ├── cohorts/
│   │   ├── +page.svelte                       # Main cohort management UI
│   │   ├── +page.server.ts                    # Load cohorts + counts
│   │   └── api/+server.ts                     # Unified API (POST/GET)
├── dashboard/+page.svelte                     # Student dashboard (TODO)
├── signup/+page.svelte                        # Invitation signup (TODO)
└── reflections/+page.svelte                   # Reflections (TODO)

src/lib/components/
├── CohortCard.svelte                          # Horizontal cohort card
├── CohortManager.svelte                       # Full management interface
├── CohortCreationWizard.svelte                # 3-step cohort creation
├── StudentEnrollmentModal.svelte              # Add students modal
└── CsvUpload.svelte                           # CSV parser component
```

---

*Last Updated: 2025-09-30*
*Status: Admin interface operational, student interface in development*