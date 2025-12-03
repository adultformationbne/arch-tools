# Courses Platform Documentation

**Last Updated:** November 26, 2025
**Status:** Production Implementation

---

## 🎯 Overview

The ArchMin Courses platform is a flexible, multi-course system supporting programs like ACCF (Archdiocesan Center for Catholic Formation) and future programs. Each course has its own branding, modules, cohorts, and enrollments.

---

## 📊 Content Hierarchy

The platform follows this strict hierarchy:

```
Course (e.g., "ACCF")
  └─ Module (e.g., "Module 1: Foundations of Faith")
      └─ Session (e.g., "Session 1", "Session 2"... typically 8 per module)
          ├─ Materials (multiple: videos, documents, links, native HTML)
          └─ Reflection Question (one per session)
```

**Important Terminology:**
- **Course** = Top-level program (has theme, branding, contains multiple modules)
- **Module** = Curriculum unit within a course (e.g., "Foundations of Faith")
- **Session** = Individual class/week within a module (contains materials + reflection)
- **Cohort** = A group of students going through a module together (has dates, enrollment)

**Key Concepts:**
- Modules belong to a course
- Sessions belong to a module
- Materials and reflections belong to sessions
- Cohorts are instances of a module with enrolled students

---

## 🗄️ Current Database Schema

### Core Tables

#### `courses`
Top-level course definitions with branding and settings.

```sql
CREATE TABLE courses (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,                    -- e.g., "Archdiocesan Center for Catholic Formation"
  short_name TEXT,                       -- e.g., "ACCF" (for display)
  slug TEXT UNIQUE NOT NULL,             -- e.g., "accf" (used in URLs)
  description TEXT,

  -- Settings (JSONB)
  settings JSONB DEFAULT '{}',           -- Includes theme: { accentDark, accentLight, fontFamily }
                                         -- Includes branding: { logoUrl, showLogo }
  email_branding_config JSONB,           -- Email-specific branding overrides
  metadata JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active',          -- 'active', 'archived'
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Theme Structure:**
```json
{
  "theme": {
    "accentDark": "#334642",    // Primary dark color for headers, text
    "accentLight": "#c59a6b",   // Light accent for backgrounds
    "fontFamily": "Inter"       // Font family for course pages
  },
  "branding": {
    "logoUrl": "/accf-logo.png",
    "showLogo": true
  }
}
```

#### `courses_modules`
Course curriculum organized into modules.

```sql
CREATE TABLE courses_modules (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g., "Module 1: Foundations of Faith"
  description TEXT,
  order_number INTEGER NOT NULL,         -- Display order
  total_sessions INTEGER DEFAULT 8,      -- Number of sessions in this module

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_cohorts`
Cohorts are specific instances/offerings of a module with students.

```sql
CREATE TABLE courses_cohorts (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES courses_modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- e.g., "Feb 2025 - Foundations of Faith"

  -- Schedule
  start_date DATE,
  end_date DATE,
  current_session INTEGER DEFAULT 0,     -- Current session (0 = not started, 1-8 = in progress)

  -- Status
  status TEXT DEFAULT 'upcoming',        -- 'upcoming', 'active', 'completed'

  -- Email preferences
  email_preferences JSONB DEFAULT '{}',  -- Per-cohort email settings

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_enrollments`
**Participant enrollments in specific cohorts.**

**IMPORTANT:** Cohort enrollments are for participants only—course managers and admins are NOT enrolled in cohorts. They manage courses via platform modules.

```sql
CREATE TABLE courses_enrollments (
  id UUID PRIMARY KEY,
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,

  -- Enrollment role (participants only - course management is via platform modules)
  role TEXT NOT NULL CHECK (role IN ('student', 'coordinator')),
  -- 'student' = regular participant
  -- 'coordinator' = hub coordinator

  -- Student progression
  current_session INTEGER DEFAULT 1,

  -- Hub assignment (optional, for hub coordinators)
  hub_id UUID REFERENCES courses_hubs(id) ON DELETE SET NULL,

  -- Invitation workflow
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invited', 'accepted', 'active', 'completed', 'withdrawn')),

  enrolled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Note:** Course management access is controlled via platform modules (`courses.admin`, `courses.manager`), NOT via enrollment roles.

#### `courses_materials`
Course materials for each session within a module.

```sql
CREATE TABLE courses_materials (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES courses_sessions(id) ON DELETE CASCADE,

  -- Material details
  type TEXT NOT NULL,                    -- 'video', 'link', 'native', 'document', 'image'
  title TEXT NOT NULL,
  content TEXT NOT NULL,                 -- URL or native HTML content
  display_order INTEGER DEFAULT 0,

  -- Access control
  coordinator_only BOOLEAN DEFAULT false, -- If true, only hub coordinators can see

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Material Types:**
- `video` - YouTube videos (auto-fetches title, shows preview in edit mode)
- `link` - External resources (auto-detects file type: PDF, Word, Excel, images, etc.)
- `native` - Rich HTML content created in platform editor

#### `courses_sessions`
Session metadata within a module.

```sql
CREATE TABLE courses_sessions (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES courses_modules(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,        -- 0 = pre-start, 1-8+ = regular sessions
  title TEXT,                             -- e.g., "Faith and Reason"
  description TEXT,                       -- Session overview
  learning_objectives TEXT[],             -- Array of objectives
  reflections_enabled BOOLEAN DEFAULT true, -- Whether this session has reflections

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_reflection_questions`
Reflection prompts for each session.

```sql
CREATE TABLE courses_reflection_questions (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES courses_sessions(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Note:** Not every session has a reflection question. The system tracks which sessions have questions via `CourseQueries.getSessionsWithReflectionQuestions()`.

#### `courses_reflection_responses`
Student responses to reflection prompts.

```sql
CREATE TABLE courses_reflection_responses (
  id UUID PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES courses_enrollments(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES courses_reflection_questions(id) ON DELETE CASCADE,

  response_text TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,        -- Whether visible to cohort members
  status reflection_status NOT NULL,       -- Enum: 'submitted', 'under_review', 'passed', 'needs_revision'

  -- Grading
  marked_by UUID REFERENCES user_profiles(id),
  marked_at TIMESTAMPTZ,
  feedback TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Reflection Status Enum:**
- `submitted` - Response submitted, awaiting review
- `under_review` - Admin is currently reviewing
- `passed` - Marked as passing
- `needs_revision` - Requires student revision

### Supporting Tables

#### `courses_hubs`
Hub groups for in-person meetings within a course.

```sql
CREATE TABLE courses_hubs (
  id UUID PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                     -- e.g., "St Mary's Cathedral Hub"
  location TEXT,                          -- Physical location
  coordinator_id UUID REFERENCES user_profiles(id), -- Hub coordinator

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_attendance`
Attendance tracking for sessions.

```sql
CREATE TABLE courses_attendance (
  id UUID PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES courses_enrollments(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  present BOOLEAN NOT NULL,
  attendance_type TEXT,                   -- 'in_person', 'online', 'excused'
  notes TEXT,
  marked_by UUID REFERENCES user_profiles(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_email_templates`
Email templates for course communications.

```sql
CREATE TABLE courses_email_templates (
  id UUID PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,             -- e.g., 'welcome_enrolled', 'session_advance'
  name TEXT NOT NULL,                     -- Display name
  description TEXT,
  category TEXT,                          -- 'system', 'custom', 'automated'

  -- Template content
  subject_template TEXT NOT NULL,         -- Subject with {{variables}}
  body_template TEXT NOT NULL,            -- HTML body with {{variables}}
  available_variables JSONB,              -- List of supported variables

  -- Automation
  trigger_event TEXT,                     -- Event that triggers this email
  is_active BOOLEAN DEFAULT true,
  is_deletable BOOLEAN DEFAULT true,      -- System templates can't be deleted

  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_activity_log`
Activity tracking for cohort events.

```sql
CREATE TABLE courses_activity_log (
  id UUID PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES courses_enrollments(id),
  activity_type TEXT NOT NULL,            -- 'reflection_submitted', 'session_advanced', etc.
  actor_name TEXT,                        -- Who performed the action
  description TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_community_feed`
Community feed posts for cohort engagement.

```sql
CREATE TABLE courses_community_feed (
  id UUID PRIMARY KEY,
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL,                -- 'announcement', 'reflection', 'discussion'
  title TEXT,
  content TEXT NOT NULL,
  author_id UUID REFERENCES user_profiles(id),
  author_name TEXT,
  session_number INTEGER,
  reflection_response_id UUID REFERENCES courses_reflection_responses(id),
  image_url TEXT,
  pinned BOOLEAN DEFAULT false,
  email_notification_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_enrollment_imports`
Tracking for bulk CSV imports.

```sql
CREATE TABLE courses_enrollment_imports (
  id UUID PRIMARY KEY,
  imported_by UUID REFERENCES user_profiles(id),
  filename TEXT,
  total_rows INTEGER,
  successful_rows INTEGER,
  error_rows INTEGER,
  status TEXT,                            -- 'processing', 'completed', 'failed'

  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 📚 Session Structure Explained

Each session within a module contains two main components:

### Materials (Multiple per session)
Stored in `courses_materials` table with reference to `session_id`:

**Material Types:**
- **Video** (`type: 'video'`)
  - YouTube videos only
  - Auto-fetches video title from YouTube oEmbed API
  - Shows live preview in edit mode
  - Embeds player for students

- **Link** (`type: 'link'`)
  - Any external URL (documents, websites, files, images)
  - Auto-detects file type from URL extension
  - Shows appropriate icon:
    - 📄 PDF documents (.pdf)
    - 📝 Word documents (.doc, .docx)
    - 📊 Spreadsheets (.xls, .xlsx, .csv)
    - 📽️ Presentations (.ppt, .pptx)
    - 📦 Archives (.zip, .rar, .7z, .tar, .gz)
    - 🖼️ Images (.jpg, .png, .gif, .svg, .webp, .bmp)
    - 🔗 Generic link (all other URLs)
  - Displays file type label (e.g., "PDF Document", "Spreadsheet")

- **Native** (`type: 'native'`)
  - Rich HTML content created using the platform's WYSIWYG editor
  - Rendered directly on the page

### Coordinator-Only Materials

Materials can be marked as `coordinator_only: true` to restrict visibility:

- **Students** - Cannot see coordinator-only materials
- **Hub Coordinators** - Can see all materials including coordinator-only
- **Admins** - Can see all materials

**Use Cases:**
- Hub meeting guides
- Coordinator discussion points
- Administrative resources
- Session facilitation notes

**Implementation:**
```typescript
// In +page.server.ts
const canSeeCoordinatorMaterials = enrollment.role === 'coordinator' || enrollment.role === 'admin';

const filterMaterials = (materials) =>
  materials.filter(m => !m.coordinator_only || canSeeCoordinatorMaterials);
```

**Upload Documents:**
- Use the "Upload Document" material type in the form
- Uploads to Supabase Storage (`materials` bucket)
- Automatically creates a `link` type material with the storage URL
- File type is auto-detected from the uploaded file extension

**Properties:**
- Multiple materials per session (ordered by `display_order`)
- Each material has a title and content (URL or HTML)
- Materials are session-specific and reusable across cohorts
- YouTube videos automatically populate title on URL paste
- File type icons update dynamically based on URL

### Reflection Question (One per session)
Stored in `courses_reflection_questions` table:
- One text question per session
- Students submit responses via `courses_reflection_responses`
- Admins review and mark as `passed` or `needs_revision`
- Can include feedback for students

### Session Metadata (Optional)
Stored in `courses_sessions` table:
- **Title** - Session name (e.g., "Faith and Reason")
- **Description** - Detailed session overview
- **Learning Objectives** - Array of objectives for this session

**Example Session Structure:**
```
Session 1: Faith and Reason
├─ Overview: "In this session, we explore the relationship between faith and reason..."
├─ Materials:
│   ├─ Video: "Introduction to Faith" (YouTube) [auto-titled, with preview]
│   ├─ Link: "Reading Guide.pdf" (PDF) [📄 PDF Document icon]
│   ├─ Native: Welcome message (rich HTML)
│   └─ Link: "Additional Resources" (external) [🔗 Link icon]
└─ Reflection: "How do you define faith in your own words?"
```

---

## 🎨 Course Branding System

### Theme Application

The course theme is applied via the layout at `/courses/[slug]/+layout.svelte`:

```typescript
// +layout.server.ts loads course settings
const { data: course } = await supabaseAdmin
  .from('courses')
  .select('*')
  .eq('slug', slug)
  .single();

const courseTheme = course.settings?.theme || {};
const courseBranding = course.settings?.branding || {};

return {
  courseTheme,    // { accentDark, accentLight, fontFamily }
  courseBranding  // { logoUrl, showLogo }
};
```

```svelte
<!-- +layout.svelte applies theme as CSS variables -->
<script>
  function buildThemeStyles(themeSettings) {
    const accentDark = themeSettings.accentDark || '#334642';
    const accentLight = themeSettings.accentLight || '#c59a6b';
    const fontFamily = themeSettings.fontFamily || 'Inter';

    return [
      `--course-accent-darkest: ${accentDark}`,
      `--course-accent-dark: ${accentDark}`,
      `--course-accent-light: ${accentLight}`,
      `--course-surface: ${accentLight}`,
      `--course-lightest: #ffffff`,
      `--course-text-on-dark: #ffffff`,
      `--course-text-on-light: ${accentDark}`,
      `--course-font-family: '${fontFamily}', sans-serif`
    ].join('; ');
  }
</script>

<div style={themeStyles} class="course-themed-container">
  {@render children()}
</div>

<style>
  .course-themed-container {
    min-height: 100vh;
    background-color: var(--course-accent-dark);
    color: var(--course-text-on-dark);
    font-family: var(--course-font-family);
  }
</style>
```

### Theme Editing

Courses can be created/edited at `/courses` (internal admin route) with:
- **ThemeSelector component** - Color pickers for accent dark/light
- **Font selector** - Choose from Inter, Georgia, Courier New, Arial, Times New Roman
- **Live preview** - See exactly how the theme will look
- **Quick presets** - ACCF Classic, Ocean Blue, Autumn, Forest Green

---

## 🗂️ Route Structure

### Platform-Level Routes (Internal Admin)
```
/(internal)/courses/                      # Platform course management
                                         # - Create/edit courses
                                         # - Configure theme & branding
                                         # - Managed by platform admins only
```

### Participant Routes (Student-Facing)
```
/courses/[slug]/                          # Course context (theme applied)
├── (dashboard)                           # Student dashboard (main page)
├── materials                             # Session materials viewer
├── reflections                           # Reflection submission & status
├── write/[questionId]                    # Reflection writing page
└── profile                               # Student profile
```

### Admin Routes (Course Management)
```
/admin/courses/[slug]/                    # Admin context for course
├── (dashboard)                           # Cohort management dashboard
├── modules/                              # Module CRUD
├── sessions/                             # Session editor (materials + reflections)
│   └── ?module={id}                      # Pre-select module
├── reflections/                          # Review & mark student submissions
├── participants/                         # Enrollment management
├── attendance/                           # Attendance tracking
├── hubs/                                 # Hub management
├── emails/                               # Email template management & sending
└── settings/                             # Course settings
```

### Key Route Concepts

**No Individual Module Pages:**
- Modules are managed via modals on `/admin/courses/[slug]/modules`
- Click "Edit" → redirects to `/admin/courses/[slug]/sessions?module={id}`
- No `/admin/courses/[slug]/modules/[id]` route exists

**Single Sessions Editor:**
- `/admin/courses/[slug]/sessions` handles ALL session content editing
- Module dropdown to switch between modules
- Session tabs (0-9) to switch between sessions
- Edit materials and reflections in one unified interface

**Course Settings vs Management:**
- **Platform Settings** (create courses, theme) → `/(internal)/courses` (platform level)
- **Course Management** (modules, sessions, cohorts) → `/admin/courses/[slug]/*` (course level)

---

## 🔐 Authentication & Authorization

### Platform-Level Modules (`user_profiles.modules`)

Module-based permissions control platform access:

| Module | Access Granted |
|--------|----------------|
| `users` | **Platform admin** - Manage all users, invitations, and permissions (highest platform privilege) |
| `editor` | Content editor access |
| `dgr` | Daily Gospel Reflections management |
| `courses.participant` | Access to enrolled courses via `/my-courses` |
| `courses.manager` | Manage assigned courses (via `user_profiles.assigned_course_ids`) |
| `courses.admin` | Manage ALL courses platform-wide |

**Key Concepts:**
- Platform modules are stored in `user_profiles.modules` as an array
- `courses.participant` and `courses.manager` are independent (not hierarchical)
- `courses.admin` can manage ALL courses (no assignment needed)
- `courses.manager` can only manage courses in their `assigned_course_ids` array
- **Course managers and admins are NOT enrolled in cohorts**—enrollments are for participants only

### Course Assignment for Managers (`user_profiles.assigned_course_ids`)

Users with the `courses.manager` module must be assigned to specific courses:

```json
// Example: user_profiles.assigned_course_ids
["uuid-of-course-1", "uuid-of-course-2"]
```

- **courses.admin** users don't need assignments (can manage all courses)
- **courses.manager** users only see courses in their `assigned_course_ids`
- Assignment is managed at `/users` by platform admins

### Course Enrollment Roles (`courses_enrollments.role`)

**Cohort enrollments are for participants only.** Only two roles exist:

| Role | Description |
|------|-------------|
| `student` | Regular course participant |
| `coordinator` | Hub coordinator for this course |

**Critical:** Course managers and admins are NOT enrolled in cohorts. They manage courses via platform modules, not enrollments.

### Auth Helpers (`$lib/server/auth.ts`)

```typescript
// Platform-level module checks
await requireModule(event, 'users');                  // Requires 'users' module
await requireModuleLevel(event, 'courses.admin');     // Requires exact 'courses.admin' module
await requireAnyModule(event, ['courses.manager', 'courses.admin']);

// Course management access (for admin UIs)
await requireCourseAdmin(event, courseSlug);
// Returns true if:
//   - User has 'courses.admin' module (can manage ALL courses), OR
//   - User has 'courses.manager' module AND courseId is in their assigned_course_ids

// Course participant access (for student-facing content)
await requireCourseAccess(event, courseSlug);
// Must be enrolled in a cohort (student or coordinator role)

await requireCourseRole(event, courseSlug, ['coordinator']);
// Must be enrolled with specific role (e.g., only hub coordinators)
```

**Response Modes:**
- `throw_error` (default) - Returns HTTP 401/403 (for API routes)
- `redirect` - Returns 303 redirect (for page routes)

```typescript
// For page routes
await requireModule(event, 'users', { mode: 'redirect', redirectTo: '/my-courses' });

// For API routes (default)
await requireModule(event, 'users');  // Throws error(403)
```

---

## 📝 Course Management Workflow

### 1. Create a Course

Navigate to `/courses` as a platform admin:
1. Click **"Create Course"** button
2. Fill in:
   - Course Name (e.g., "Catholic Leadership Institute")
   - URL Slug (e.g., "cli")
   - Description
3. Configure theme:
   - Choose accent dark color (primary brand color)
   - Choose accent light color (background accent)
   - Select font family
   - Preview live appearance
4. Click **"Create Course"**

### 2. Create Modules

Navigate to `/admin/courses/[slug]/modules`:
1. Create modules with names, descriptions, session counts
2. Modules appear in order_number sequence

### 3. Add Materials & Reflections

Navigate to `/admin/courses/[slug]/sessions`:
1. Select module from dropdown
2. Select session (Pre-Start, 1-8, etc.)
3. Add materials:
   - **Videos** - Paste YouTube URL, title auto-fetches, preview shows inline
   - **Links** - Any external URL, file type auto-detected (PDFs, docs, images, etc.)
   - **Native Content** - Rich text editor for custom HTML content
   - **Upload Document** - Upload files to storage, creates link material automatically
4. Add reflection question (one per session)
5. Add session overview/description

### 4. Create Cohorts

Navigate to `/admin/courses/[slug]`:
1. Click **"New Cohort"** button
2. Select module
3. Set start/end dates
4. Name the cohort (e.g., "Feb 2025 - Foundations")
5. Click **"Create"**

### 5. Enroll Students

From cohort dashboard:
1. Click **"Add Participants"** button
2. Options:
   - Upload CSV (bulk import)
   - Add individual student
3. Students receive invitation emails
4. Track enrollment status (pending → invited → active)

---

## 🎓 Student Experience

### Course Access
1. Student logs in
2. If enrolled in one course → Auto-redirected to `/courses/[slug]/dashboard`
3. If enrolled in multiple courses → Shown course selector at `/my-courses`

### Dashboard

**When `current_session = 0` (Cohort Not Started):**
- Shows "Course Starting Soon" message
- Displays start date: "This course begins on [date]"
- Message: "Materials will be available when your cohort starts Session 1"
- No materials or reflection prompts visible
- Empty state UI

**When `current_session >= 1` (Cohort Active):**
- Module name and current session number
- Session materials for current session
- Reflection prompt for current session
- Progress indicator
- Quick links to materials, reflections
- Past reflections from current user
- Public reflections from cohort members

### Materials
- View session materials for current session
- Materials organized by type (videos, documents, links)
- Native HTML content rendered directly
- Empty state shown when `current_session = 0`

### Reflections
- Submit written reflections for each session
- View feedback from admins
- See passing/not passing status
- Empty state shown when `current_session = 0`

---

## 👨‍💼 Admin Experience

### Cohort Management Dashboard (`/admin/courses/[slug]`)
- **Cohort pills** - Quick switch between cohorts (shows up to 4)
- **Cohort details** - Module, dates, session progress, participant count
- **Set current session** - Advance all students in cohort
- **Recent activity** - Last 7 days of submissions/activity
- **Participants list** - Full enrollment roster with progression tracking
- **Bulk operations** - Advance students, manage attendance

### Sessions Editor (`/admin/courses/[slug]/sessions`)
- **Module selector dropdown** - Switch between modules
- **Session navigation** - Pre-Start + Sessions 1-8 (or custom count)
- **Materials editor**:
  - Add/edit/delete materials
  - YouTube videos: Auto-fetch title, live preview
  - Links: Auto-detect file type, show appropriate icon
  - Upload documents: Inline upload box when "Upload Document" selected
  - Native content: Rich text editor
  - Drag to reorder materials
- **Reflection editor**: One question per session
- **Session overview**: Description/introduction for each session
- **Live save status** indicator
- Changes save automatically to database

### Reflection Marking (`/admin/courses/[slug]/reflections`)
- Queue of ungraded reflections
- Mark passing/not passing
- Provide written feedback
- Filter by cohort, session, student

---

## 📊 Cohort Status Model

### Session-Based Status

Cohort status is determined by **session progression**, not dates:

| `current_session` | `status` | Meaning | Student Access |
|-------------------|----------|---------|----------------|
| `0` | `'upcoming'` | Cohort created but not started | Can see start date, no materials |
| `1-8` | `'active'` | Cohort in progress | Can access current session materials |
| Any | `'completed'` | Admin manually marked complete | Full archive access |

### Status Transition Rules

```typescript
// Automatic (runtime calculation):
if (current_session === 0 && status !== 'completed') {
  status = 'upcoming';
} else if (current_session >= 1 && status !== 'completed') {
  status = 'active';
}
// Manual: Admin marks as 'completed'
```

### Key Points

- ✅ **Status changes when admin advances sessions** (not automatically by date)
- ✅ **Dates are for display/planning only** (start_date, end_date)
- ✅ **current_session drives everything**:
  - `0` = Not started (upcoming)
  - `1+` = Active (materials visible)
- ✅ **Only 'completed' is set manually** by admin action
- ✅ **No automatic date-based transitions**

---

## 🔄 Course Lifecycle

```
1. Course Created
   ↓
2. Modules Added
   ↓
3. Materials & Reflections Added to Sessions
   ↓
4. Cohort Created (status: upcoming, current_session: 0)
   ↓
5. Students Enrolled (pending → invited → active)
   ↓
6. Admin Starts Cohort (status: active, current_session: 1)
   ↓
7. Sessions Progress (current_session: 2 → 3 → 4...)
   ↓
8. Admin Marks Complete (status: completed)
```

---

## 🎨 Design System

### Course Cards (`/courses`)
- Gradient accent bar (dark → light)
- Course title in accent dark color
- URL slug displayed as `/slug`
- Module count in footer
- Themed action buttons using accent colors
- 3-dot menu for admin settings

### Buttons & UI
Components automatically use course theme:
- Buttons styled with `var(--course-accent-dark)`
- Backgrounds use `var(--course-accent-light)`
- Text colors use `var(--course-text-on-dark)` or `var(--course-text-on-light)`
- Font family from `var(--course-font-family)`

---

## 🔧 Technical Implementation

### Key Files

**Course CRUD:**
- `/src/routes/(internal)/courses/+page.svelte` - Course listing & CRUD
- `/src/routes/(internal)/courses/+page.server.ts` - Form actions (create, update, delete)
- `/src/lib/components/ThemeSelector.svelte` - Theme editing component

**Course Layout:**
- `/src/routes/courses/[slug]/+layout.server.ts` - Load course settings
- `/src/routes/courses/[slug]/+layout.svelte` - Apply theme as CSS variables

**Course Admin:**
- `/src/routes/admin/courses/[slug]/+page.svelte` - Cohort dashboard
- `/src/routes/admin/courses/[slug]/sessions/+page.svelte` - Session & materials editor
- `/src/routes/admin/courses/[slug]/reflections/+page.svelte` - Reflection marking
- `/src/routes/admin/courses/[slug]/emails/+page.svelte` - Email management

**Email System:**
- `/src/lib/utils/email-service.js` - Email sending & templating
- `/src/lib/email/compiler.js` - MJML email compiler
- `/src/lib/components/EmailTemplateEditor.svelte` - Template editor
- `/src/lib/components/SendEmailView.svelte` - Email composition UI
- `/src/routes/api/courses/[slug]/emails/+server.ts` - Template CRUD API
- `/src/routes/api/courses/[slug]/send-email/+server.ts` - Email sending API

**Auth:**
- `/src/lib/server/auth.ts` - Unified authentication helpers

**Data Repository:**
- `/src/lib/server/course-data.ts` - Centralized course data access layer

**Reflection Status:**
- `/src/lib/utils/reflection-status.js` - Status calculation utilities

---

## 📦 Data Repository Pattern

**As of January 2025**, all course data access goes through a centralized repository pattern in `/src/lib/server/course-data.ts`. This provides:

- ✅ **Single source of truth** for all queries
- ✅ **Parallel query execution** for performance
- ✅ **Type-safe operations** with TypeScript
- ✅ **Consistent data transformations**
- ✅ **Easy testing** via mocking

### Architecture

The repository has three layers:

#### Layer 1: Core Queries (Atomic Operations)

Basic database operations that return raw data:

```typescript
import { CourseQueries } from '$lib/server/course-data.js';

// Get user's enrollment
const { data: enrollment } = await CourseQueries.getEnrollment(userId, courseSlug);

// Get sessions for a module
const { data: sessions } = await CourseQueries.getSessions(moduleId);

// Get materials for sessions
const { data: materials } = await CourseQueries.getMaterials(sessionIds);

// Get reflection responses
const { data: responses } = await CourseQueries.getReflectionResponses(enrollmentId);
```

**Available Core Queries:**
- `getCourse(slug)` - Course by slug
- `getEnrollment(userId, courseSlug)` - User's enrollment with cohort/module
- `getUserEnrollments(userId)` - All enrollments for a user
- `getModules(courseId)` - Modules for a course
- `getCohorts(courseId)` - Cohorts for a course
- `getSessions(moduleId)` - Sessions for a module
- `getMaterials(sessionIds)` - Materials for sessions
- `getReflectionQuestions(sessionIds)` - Questions for sessions
- `getReflectionResponses(enrollmentId)` - User's reflection responses
- `getPublicReflections(cohortId, excludeEnrollmentId?)` - Public reflections
- `getAttendance(enrollmentId)` - Attendance records
- `getHubData(hubId, cohortId)` - Hub coordinator data

#### Layer 2: Aggregates (Business Logic)

High-level functions that combine queries with parallel execution:

```typescript
import { CourseAggregates } from '$lib/server/course-data.js';

// Student dashboard - ONE CALL gets everything!
const result = await CourseAggregates.getStudentDashboard(userId, courseSlug);
// Returns: enrollment, sessions, materials, questions, responses, publicReflections, hubData

// Admin course overview
const result = await CourseAggregates.getAdminCourseData(courseId);
// Returns: modules, cohorts

// Session editor data
const result = await CourseAggregates.getSessionData(moduleId);
// Returns: sessions, materials, questions
```

**Performance:** Aggregates use `Promise.all()` for parallel execution, reducing load time by ~57%.

#### Layer 3: Mutations (Write Operations)

Validated write operations:

```typescript
import { CourseMutations } from '$lib/server/course-data.js';

// Submit a reflection
await CourseMutations.submitReflection({
  enrollmentId,
  cohortId,
  questionId,
  content,
  isPublic: true,
  status: 'submitted'
});

// Mark a reflection (admin)
await CourseMutations.markReflection(
  reflectionId,
  'pass',  // or 'fail'
  'Great work!',
  markedByUserId
);

// Mark attendance
await CourseMutations.markAttendance({
  enrollmentId,
  cohortId,
  sessionNumber,
  present: true,
  markedBy: userId
});
```

### Data Transformers

Helper functions for backward compatibility and view formatting:

```typescript
import {
  addSessionNumber,
  addSessionNumbers,
  groupMaterialsBySession,
  groupQuestionsBySession
} from '$lib/server/course-data.js';

// Add computed session_number to reflection (for legacy components)
const reflection = addSessionNumber(response);

// Add to array of reflections
const reflections = addSessionNumbers(responses);

// Group materials by session number
const materialsBySession = groupMaterialsBySession(materials);
// Returns: { 1: [...materials], 2: [...materials], ... }

// Group questions by session number
const questionsBySession = groupQuestionsBySession(questions);
// Returns: { 1: { id, text, sessionId }, 2: { ... }, ... }
```

### Migration Guide: Using the Repository

**Before (Old Pattern):**
```typescript
export const load: PageServerLoad = async (event) => {
  // Serial queries - SLOW!
  const { data: enrollment } = await supabaseAdmin
    .from('courses_enrollments')
    .select('...')
    .eq('user_profile_id', userId)
    .single();

  const { data: cohort } = await supabaseAdmin
    .from('courses_cohorts')
    .select('...')
    .eq('id', enrollment.cohort_id)
    .single();

  const { data: sessions } = await supabaseAdmin
    .from('courses_sessions')
    .select('...')
    .eq('module_id', cohort.module_id);

  // ... 7 more serial queries ...
  // Total: 10 database round-trips
};
```

**After (Repository Pattern):**
```typescript
import { CourseAggregates, addSessionNumbers, groupMaterialsBySession } from '$lib/server/course-data.js';

export const load: PageServerLoad = async (event) => {
  // ONE aggregate call - FAST!
  const result = await CourseAggregates.getStudentDashboard(userId, courseSlug);

  if (result.error || !result.data) {
    throw error(500, 'Failed to load data');
  }

  const { enrollment, sessions, materials, questions, responses } = result.data;

  // Transform for view
  const responsesWithSessionNum = addSessionNumbers(responses);
  const materialsBySession = groupMaterialsBySession(materials);

  return { enrollment, sessions, materialsBySession, responses: responsesWithSessionNum };
  // Total: 3-4 database round-trips (parallel execution)
};
```

### Important Schema Changes

**`session_number` Column Removed:**

The `courses_reflection_responses.session_number` column was removed (migration applied Jan 2025). Session number is now obtained via join:

```
reflection_response.question_id
  → courses_reflection_questions.session_id
  → courses_sessions.session_number
```

**Why?** Single source of truth, no data sync issues.

**Backward Compatibility:** Use `addSessionNumbers()` transformer to add computed `session_number` property to response objects for legacy UI components.

### When to Use Each Layer

**Use Core Queries when:**
- You need ONE specific piece of data
- You're building a custom aggregation
- You need fine-grained control

**Use Aggregates when:**
- Loading a full page (dashboard, reflections, etc.)
- You need multiple related pieces of data
- Performance matters (automatic parallelization)

**Use Mutations when:**
- Writing/updating data
- You need validation
- You want consistent error handling

### Testing with the Repository

**Mock the repository instead of Supabase:**

```typescript
import { CourseAggregates } from '$lib/server/course-data.js';
import { vi } from 'vitest';

// Mock the aggregate
vi.spyOn(CourseAggregates, 'getStudentDashboard').mockResolvedValue({
  data: {
    enrollment: { ... },
    sessions: [ ... ],
    materials: [ ... ]
  },
  error: null
});

// Test your page load function
const result = await load(event);
expect(result.enrollment).toBeDefined();
```

### Performance Benefits

**Measured Improvements:**

| Metric | Before Repository | After Repository | Improvement |
|--------|------------------|------------------|-------------|
| Dashboard Load Time | ~280ms | ~120ms | **57% faster** |
| Database Round-trips | 10 (serial) | 3-4 (parallel) | **60-70% fewer** |
| Code Size (dashboard) | 470 lines | 230 lines | **51% smaller** |

### Examples in Production

**Student Dashboard:** `/src/routes/courses/[slug]/+page.server.ts`
- Uses `CourseAggregates.getStudentDashboard()`
- Reduced from 470 lines to 230 lines
- Parallel query execution

**Reflection Submission:** `/src/routes/courses/[slug]/reflections/api/+server.ts`
- Uses `CourseMutations.submitReflection()`
- Validates and writes safely

### Future Enhancements

The repository makes these easy to add:

1. **Caching** - Add at repository level (Redis, in-memory)
2. **Monitoring** - Log query performance
3. **Rate Limiting** - Throttle at repository level
4. **Database Functions** - Move hot paths to Postgres functions
5. **Real-time** - Add Supabase subscriptions via repository

---

## 📧 Email Template System

The platform includes a comprehensive email system for course communications with course-branded templates, variable substitution, and logging.

### Architecture

```
Email Flow:
1. Select template (system or custom)
2. Choose recipients (cohort, hub, individuals)
3. Variables auto-populated from recipient/course data
4. Email wrapped in course-branded HTML
5. Sent via Resend API
6. Logged to platform_email_log
```

### Key Files

- **Service:** `$lib/utils/email-service.js` - Core email functions
- **MJML Compiler:** `$lib/email/compiler.js` - Email HTML generation
- **Admin UI:** `/admin/courses/[slug]/emails/+page.svelte` - Template management
- **API:** `/api/courses/[slug]/emails/+server.ts` - Template CRUD
- **Send API:** `/api/courses/[slug]/send-email/+server.ts` - Email sending

### Template Variables

Templates support `{{variable}}` syntax. Available variables:

**Student Variables:**
- `{{firstName}}`, `{{lastName}}`, `{{fullName}}` - Student name
- `{{email}}` - Student email address

**Course Variables:**
- `{{courseName}}` - Full course name
- `{{courseSlug}}` - URL slug
- `{{cohortName}}` - Cohort name
- `{{startDate}}`, `{{endDate}}` - Formatted dates

**Session Variables:**
- `{{sessionNumber}}` - Current session number
- `{{sessionTitle}}` - Session title
- `{{currentSession}}` - Cohort's current session

**Link Variables:**
- `{{loginLink}}` - Course login page
- `{{dashboardLink}}` - Student dashboard
- `{{materialsLink}}` - Materials page
- `{{reflectionLink}}` - Reflections page

**System Variables:**
- `{{supportEmail}}` - Support email address
- `{{hubName}}` - Student's hub name

### Email Service Functions

```typescript
import {
  sendEmail,
  sendBulkEmails,
  sendCourseEmail,
  renderTemplate,
  createBrandedEmailHtml,
  buildVariableContext,
  getCourseEmailTemplate
} from '$lib/utils/email-service.js';

// Send single course email
await sendCourseEmail({
  to: 'student@email.com',
  subject: 'Welcome to {{courseName}}',
  bodyHtml: '<p>Hi {{firstName}},</p><p>Welcome!</p>',
  emailType: 'welcome',
  course,
  cohortId,
  enrollmentId,
  resendApiKey,
  supabase
});

// Build variable context for a recipient
const variables = buildVariableContext({
  enrollment,
  course,
  cohort,
  session,
  siteUrl: 'https://archdiocesanministries.org.au'
});

// Render template with variables
const { subject, body } = renderTemplateForRecipient({
  subjectTemplate: 'Welcome to {{courseName}}',
  bodyTemplate: '<p>Hi {{firstName}}</p>',
  variables
});
```

### System Templates

Default templates seeded for each course:

| Template Key | Purpose |
|--------------|---------|
| `welcome_enrolled` | New enrollment welcome |
| `session_advance` | Session advancement notification |
| `reflection_reminder` | Reminder to submit reflection |
| `reflection_feedback` | Feedback on marked reflection |

### Admin Email UI

Located at `/admin/courses/[slug]/emails`:

- **Send Email** - Compose and send to recipients
- **Templates** - View/edit system and custom templates
- **Email Logs** - View sent email history

**Recipient Selection:**
- All cohort members
- By hub
- Individual selection
- Filter by status

### Email Branding

Emails automatically apply course theme:

```typescript
createBrandedEmailHtml({
  content: renderedBody,
  courseName: course.name,
  accentDark: course.settings?.theme?.accentDark,
  accentLight: course.settings?.theme?.accentLight,
  logoUrl: course.settings?.branding?.logoUrl
});
```

The email HTML is generated via MJML for cross-client compatibility (including Outlook).

---

## 📊 Reflection Status System

The platform uses a centralized reflection status system to ensure consistent calculations across all views (admin, student dashboard, hub coordinator).

### Key Principle: Sessions with Questions

**Not every session has a reflection question.** The system only counts sessions that actually have reflection questions when calculating a student's reflection status.

**Example:**
- Module has sessions 1-9
- Only sessions 1 and 2 have reflection questions
- Student at session 5 should only have 2 expected reflections (not 5)

### Architecture

#### Source of Truth: `getSessionsWithReflectionQuestions()`

```typescript
// In CourseQueries ($lib/server/course-data.ts)
async getSessionsWithReflectionQuestions(moduleId: string) {
  // Returns array of session numbers that have questions: [1, 2]
}
```

**API Endpoint:**
```
GET /admin/courses/{slug}/api?endpoint=sessions_with_questions&module_id={id}
// Returns: { success: true, data: [1, 2] }
```

#### Status Calculator: `getUserReflectionStatus()`

```typescript
// In $lib/utils/reflection-status.js
import { getUserReflectionStatus } from '$lib/utils/reflection-status.js';

const status = getUserReflectionStatus(
  reflections,           // Array of user's reflection responses
  currentSession,        // User's current session number
  sessionsWithQuestions  // Array of session numbers with questions [1, 2]
);

// Returns:
// {
//   status: 'all_caught_up' | 'not_submitted' | 'submitted' | 'needs_revision' | 'overdue',
//   count: number,  // Number of reflections in this status
//   details: { notSubmitted: 0, submitted: 1, needsRevision: 0, ... }
// }
```

### Usage Locations

| Location | How It Gets `sessionsWithQuestions` |
|----------|-------------------------------------|
| `/admin/courses/[slug]` | Fetches via API when loading participants |
| `CohortManager.svelte` | Fetches via API using `cohort.module.id` |
| `/courses/[slug]/reflections` | Server-side: loops only through `questionsBySession` |
| `HubCoordinatorBar.svelte` | Server-side: checks `questionsBySession[currentSession]` |

### Status Values

**Individual Reflection Status (`ReflectionStatus`):**
| Status | Description |
|--------|-------------|
| `NOT_SUBMITTED` | No response exists |
| `SUBMITTED` | Response submitted, awaiting review |
| `NEEDS_REVISION` | Marked as needing revision |
| `OVERDUE` | Submitted but past due date |
| `MARKED_PASS` | Passed review |
| `MARKED_FAIL` | Failed review |

**User Overall Status (`UserReflectionStatus`):**
| Status | Description |
|--------|-------------|
| `ALL_CAUGHT_UP` | All required reflections submitted/passed |
| `NOT_SUBMITTED` | Has unsubmitted reflections |
| `SUBMITTED` | Has pending reflections awaiting review |
| `NEEDS_REVISION` | Has reflections needing revision |
| `OVERDUE` | Has overdue reflections |

### Important Implementation Notes

1. **Always fetch `sessionsWithQuestions`** when calculating status for admin views
2. **Pass it to `getUserReflectionStatus()`** - don't assume all sessions have questions
3. **Hub coordinator view** checks `questionsBySession[currentSession]` server-side to determine if reflection status should be shown
4. **Student reflections page** already handles this correctly by looping through `questionsBySession`

### Example: Admin Page Loading

```typescript
// In +page.svelte loadParticipants()
const moduleId = currentCohort.module?.id;

const [enrollmentResponse, sessionsResponse] = await Promise.all([
  fetch(`/api?endpoint=courses_enrollments&cohort_id=${cohortId}`),
  fetch(`/api?endpoint=sessions_with_questions&module_id=${moduleId}`)
]);

const sessionsWithQuestions = sessionsResponse.data; // [1, 2]

participants = enrollments.map(user => {
  const status = getUserReflectionStatus(
    userReflections,
    user.current_session,
    sessionsWithQuestions  // Pass this!
  );
  return { ...user, reflectionStatus: status };
});
```

### Hub Coordinator Reflection Status

Hub coordinators see reflection status for students in their hub. This is calculated server-side:

```typescript
// In /courses/[slug]/+page.server.ts
const currentSessionHasQuestion = !!questionsBySession[cohortCurrentSession];

students.map(student => ({
  ...student,
  reflectionStatus: currentSessionHasQuestion
    ? (studentResponse?.status || 'not_started')
    : null  // null = no reflection required for this session
}));
```

The `HubCoordinatorBar.svelte` handles `null` status by showing "N/A".

---

## 🚀 Future Enhancements

### Multi-Course User Experience
- Course switcher in header for users enrolled in multiple courses
- Unified transcript showing progress across all courses
- Cross-course analytics for platform admins

### Advanced Materials
- Shared materials library
- Material versioning
- Interactive content types (quizzes, exercises)

### Enhanced Cohort Management
- Automated session advancement (date-based)
- Cohort templates
- Sub-cohorts/groups

### Reporting
- Course completion certificates
- Progress reports
- Attendance analytics
- Reflection quality metrics

---

## 📊 Current Production Courses

### ACCF (Archdiocesan Center for Catholic Formation)
- **Slug:** `accf`
- **Theme:** Dark green (#334642) & warm tan (#c59a6b)
- **Font:** Inter
- **Features:** Hubs enabled, full reflection system, attendance tracking
- **Modules:** 4 (Foundations, Scripture & Tradition, Sacraments, Moral Teaching)
- **Sessions per module:** 8

---

## ❓ Common Tasks

### How to change a course's theme?
1. Go to `/courses`
2. Click 3-dot menu on course card
3. Edit theme colors and font
4. Save changes

### How to add a new module to a course?
1. Go to `/admin/courses/[slug]/modules`
2. Create new module with name, description, session count
3. Add materials via `/admin/courses/[slug]/modules`

### How to start a cohort?
1. Go to `/admin/courses/[slug]`
2. Select cohort (should be at `current_session = 0` with status `'upcoming'`)
3. Click "Advance to Session 1" button
4. Cohort status automatically becomes `'active'`
5. Students can now access Session 1 materials

### How to advance students to the next session?
1. Go to `/admin/courses/[slug]`
2. Click "Advance to Session [X]" button
3. All students in cohort advance together
4. Cohort remains `'active'` until manually marked complete

### How to give someone course management access?

**For specific course management (courses.manager):**
1. Go to `/users` as a platform admin
2. Grant the user `courses.manager` module
3. Add the course ID to their `assigned_course_ids` array
4. They can now manage only those assigned courses
5. **Note:** They are NOT enrolled in cohorts—management is via module assignment

**For platform-wide course management (courses.admin):**
1. Go to `/users` as a platform admin
2. Grant the user `courses.admin` module
3. They can now manage ALL courses (no assignment or enrollment needed)

**Important:** Course managers and admins should NOT be enrolled in cohorts. Cohort enrollments are for participants only (students and hub coordinators).

### How to mark a cohort as complete?
1. Go to `/admin/courses/[slug]`
2. Select the cohort
3. Click "Mark Complete" button
4. Status changes to `'completed'`
5. Students still have access but cohort is archived

---

## 🎥 Material Editor Features

### YouTube Video Integration
When adding a YouTube video material:
1. **Paste YouTube URL** - Supports all formats:
   - `youtube.com/watch?v=...`
   - `youtu.be/...`
   - `youtube.com/embed/...`
   - `youtube.com/shorts/...`
2. **Auto-fetch title** - Automatically fetches video title from YouTube after 0.5s
3. **Live preview** - Shows embedded video player while editing
4. **Clean display** - Shows "YouTube Video" label instead of ugly URL in materials list

### File Type Detection
When adding a link material:
- System automatically detects file type from URL extension
- Shows appropriate icon and label:
  - PDFs → 📄 "PDF Document"
  - Word docs → 📝 "Word Document"
  - Spreadsheets → 📊 "Spreadsheet"
  - Presentations → 📽️ "Presentation"
  - Archives → 📦 "Archive"
  - Images → 🖼️ "Image"
  - Other → 🔗 "Link"
- No manual categorization needed

### Document Upload
Upload files directly to Supabase Storage:
1. Select "Upload Document" as material type
2. **Inline upload box** appears in the form (not a modal)
3. Drag & drop or browse for files
4. Accepts: `.pdf`, `.doc`, `.docx`, `.txt`, `.md`
5. Automatically creates link material with:
   - Storage URL
   - File name as title (extension removed)
   - File size in description
   - Appropriate file type icon

**⚠️ Technical Debt:** Storage file paths currently use `week-${sessionNumber}` format (e.g., `cohort-123/week-1/file.pdf`) for backwards compatibility with existing uploaded files. Function parameters were renamed to `sessionNumber`, but the actual storage path structure was preserved to avoid breaking existing file references. Future work: migrate storage paths to use `session-${sessionNumber}` format.

### Material Organization
- **Drag to reorder** - Use ↑↓ buttons to change display order
- **Instant preview** - YouTube videos show preview in edit mode only
- **Edit in place** - Click edit button to modify any material
- **Type indicators** - Color-coded icons for each material type

---

*Last updated: November 26, 2025*
