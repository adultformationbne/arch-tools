# Courses Platform Documentation

**Last Updated:** November 17, 2025
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
  slug TEXT UNIQUE NOT NULL,             -- e.g., "accf" (used in URLs)
  description TEXT,

  -- Settings (JSONB)
  settings JSONB DEFAULT '{}',           -- Includes theme: { accentDark, accentLight, fontFamily }
                                         -- Includes branding: { logoUrl, showLogo }
  metadata JSONB DEFAULT '{}',

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
  type TEXT NOT NULL,                    -- 'video', 'link', 'native'
  title TEXT NOT NULL,
  content TEXT NOT NULL,                 -- URL or native HTML content
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Material Types:**
- `video` - YouTube videos (auto-fetches title, shows preview in edit mode)
- `link` - External resources (auto-detects file type: PDF, Word, Excel, images, etc.)
- `native` - Rich HTML content created in platform editor

#### `courses_reflections`
Reflection prompts for each session.

```sql
CREATE TABLE courses_reflections (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES courses_modules(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  prompt TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_reflection_responses`
Student responses to reflection prompts.

```sql
CREATE TABLE courses_reflection_responses (
  id UUID PRIMARY KEY,
  reflection_id UUID NOT NULL REFERENCES courses_reflections(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES courses_enrollments(id) ON DELETE CASCADE,

  response TEXT NOT NULL,

  -- Grading
  marked_by UUID REFERENCES user_profiles(id),
  passing BOOLEAN,
  feedback TEXT,
  marked_at TIMESTAMPTZ,

  submitted_at TIMESTAMPTZ DEFAULT now()
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

### Course-Specific Routes
```
/courses/[slug]/                          # Course context (theme applied)
├── login                                 # Course-specific login
├── dashboard                             # Student dashboard (current cohort info)
├── materials                             # Session materials (student view)
├── reflections                           # Student reflection submission
├── profile                               # Course profile
└── admin/                                # Admin-only routes (course admins)
    ├── (dashboard)                       # Cohort management dashboard
    ├── modules/                          # Module CRUD (modals, no detail pages)
    ├── sessions/                         # Session editor (materials + reflections)
    │   └── ?module={id}                  # Optional: pre-select module
    ├── reflections/                      # Review student submissions
    ├── users/                            # Participant management
    ├── enrollments/                      # Enrollment management
    ├── attendance/                       # Attendance tracking
    └── hubs/                             # Hub management
```

### Key Route Concepts

**No Individual Module Pages:**
- Modules are managed via modals on `/admin/modules`
- Click "Edit" → redirects to `/admin/sessions?module={id}`
- No `/admin/modules/[id]` route exists

**Single Sessions Editor:**
- `/admin/sessions` handles ALL session content editing
- Module dropdown to switch between modules
- Session tabs (1-8) to switch between sessions
- Edit materials and reflections in one unified interface

**Course Settings vs Management:**
- **Settings** (theme, name, slug) → `/(internal)/courses` (platform level)
- **Management** (modules, sessions, cohorts) → `/courses/[slug]/admin/*` (course level)

---

## 🔐 Authentication & Authorization

### Platform-Level Modules (`user_profiles.modules`)

Module-based permissions control platform access:

| Module | Access Granted |
|--------|----------------|
| `users` | User management, invitations, permissions |
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

Navigate to `/courses/[slug]/admin/courses`:
1. Create modules with names, descriptions, session counts
2. Modules appear in order_number sequence

### 3. Add Materials & Reflections

Navigate to `/courses/[slug]/admin/sessions`:
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

Navigate to `/courses/[slug]/admin`:
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

### Cohort Management Dashboard (`/courses/[slug]/admin`)
- **Cohort pills** - Quick switch between cohorts (shows up to 4)
- **Cohort details** - Module, dates, session progress, participant count
- **Set current session** - Advance all students in cohort
- **Recent activity** - Last 7 days of submissions/activity
- **Participants list** - Full enrollment roster with progression tracking
- **Bulk operations** - Advance students, manage attendance

### Sessions Editor (`/courses/[slug]/admin/sessions`)
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

### Reflection Marking (`/courses/[slug]/admin/reflections`)
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
- `/src/routes/courses/[slug]/admin/+page.svelte` - Cohort dashboard
- `/src/routes/courses/[slug]/admin/modules/+page.svelte` - Materials editor
- `/src/routes/courses/[slug]/admin/reflections/+page.svelte` - Reflection marking

**Auth:**
- `/src/lib/server/auth.ts` - Unified authentication helpers

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
1. Go to `/courses/[slug]/admin/courses`
2. Create new module with name, description, session count
3. Add materials via `/courses/[slug]/admin/modules`

### How to start a cohort?
1. Go to `/courses/[slug]/admin`
2. Select cohort (should be at `current_session = 0` with status `'upcoming'`)
3. Click "Advance to Session 1" button
4. Cohort status automatically becomes `'active'`
5. Students can now access Session 1 materials

### How to advance students to the next session?
1. Go to `/courses/[slug]/admin`
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
1. Go to `/courses/[slug]/admin`
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

### Material Organization
- **Drag to reorder** - Use ↑↓ buttons to change display order
- **Instant preview** - YouTube videos show preview in edit mode only
- **Edit in place** - Click edit button to modify any material
- **Type indicators** - Color-coded icons for each material type

---

*Last updated: November 17, 2025*
