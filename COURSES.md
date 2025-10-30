# Courses Platform Documentation

**Last Updated:** October 30, 2025
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
  current_session INTEGER DEFAULT 1,     -- Current session (1-8, etc.)

  -- Status
  status TEXT DEFAULT 'scheduled',       -- 'scheduled', 'active', 'completed'

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `courses_enrollments`
User enrollments in specific cohorts with role-based access.

```sql
CREATE TABLE courses_enrollments (
  id UUID PRIMARY KEY,
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,

  -- Role in THIS cohort
  role TEXT NOT NULL CHECK (role IN ('student', 'admin', 'coordinator')),

  -- Student progression
  current_session INTEGER DEFAULT 1,

  -- Hub assignment (optional)
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

#### `courses_materials`
Course materials for each session within a module.

```sql
CREATE TABLE courses_materials (
  id UUID PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES courses_modules(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,       -- Which session (1-8, etc.)

  -- Material details
  type TEXT NOT NULL,                    -- 'video', 'document', 'link', 'native'
  title TEXT NOT NULL,
  content TEXT NOT NULL,                 -- URL or native HTML content
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

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
- **Video** - YouTube/Vimeo embed URLs
- **Document** - PDF links or downloadable files
- **Link** - External resources (articles, websites)
- **Native** - Rich HTML content edited directly in the platform
- **Image** - Image resources

**Properties:**
- Multiple materials per session (ordered by `display_order`)
- Each material has a title and content (URL or HTML)
- Materials are session-specific and reusable across cohorts

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
├─ Materials:
│   ├─ Video: "Introduction to Faith" (YouTube)
│   ├─ Document: "Reading Guide.pdf" (PDF link)
│   ├─ Native: Welcome message (HTML)
│   └─ Link: "Additional Resources" (external)
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

### Platform-Level Roles (`user_profiles.role`)
- `admin` - Platform administrator (full access)
- `student` - Regular user
- `hub_coordinator` - Hub management access

### Course-Level Roles (`courses_enrollments.role`)
- `admin` - Course administrator (can manage cohorts, enrollments, mark reflections)
- `student` - Enrolled student
- `coordinator` - Hub coordinator for course

### Auth Helpers (`$lib/server/auth.ts`)

```typescript
// Platform-level auth
await requirePlatformAdmin(event);                    // Requires platform admin
await requireModule(event, 'user_management');        // Requires specific module access

// Course-level auth
await requireCourseAdmin(event, courseSlug);          // Requires course admin role
await requireCourseAccess(event, courseSlug);         // Requires any enrollment
await requireCourseRole(event, courseSlug, ['admin', 'coordinator']);
```

**Response Modes:**
- `throw_error` (default) - Returns HTTP 401/403 (for API routes)
- `redirect` - Returns 303 redirect (for page routes)

```typescript
// For page routes
await requirePlatformAdmin(event, { mode: 'redirect', redirectTo: '/profile' });

// For API routes (default)
await requirePlatformAdmin(event);  // Throws error with 401/403
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

Navigate to `/courses/[slug]/admin/modules`:
1. Select module
2. Select session (1-8, etc.)
3. Add materials:
   - Videos (YouTube/Vimeo URLs)
   - Documents (PDF links)
   - Links (external resources)
   - Native content (HTML editor)
4. Add reflection prompts

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
3. If enrolled in multiple courses → Shown course selector at `/courses`

### Dashboard
Shows current cohort information:
- Module name
- Current session
- Progress indicator
- Quick links to materials, reflections

### Materials
- View session materials for current session
- Materials organized by type (videos, documents, links)
- Native HTML content rendered directly

### Reflections
- Submit written reflections for each session
- View feedback from admins
- See passing/not passing status

---

## 👨‍💼 Admin Experience

### Cohort Management Dashboard (`/courses/[slug]/admin`)
- **Cohort pills** - Quick switch between cohorts (shows up to 4)
- **Cohort details** - Module, dates, session progress, participant count
- **Set current session** - Advance all students in cohort
- **Recent activity** - Last 7 days of submissions/activity
- **Participants list** - Full enrollment roster with progression tracking
- **Bulk operations** - Advance students, manage attendance

### Module & Materials Editor (`/courses/[slug]/admin/modules`)
- Select module
- Navigate between sessions (1-8, etc.)
- Add/edit/delete materials
- Edit reflection prompts
- Preview student view

### Reflection Marking (`/courses/[slug]/admin/reflections`)
- Queue of ungraded reflections
- Mark passing/not passing
- Provide written feedback
- Filter by cohort, session, student

---

## 🔄 Course Lifecycle

```
1. Course Created
   ↓
2. Modules Added
   ↓
3. Materials & Reflections Added to Sessions
   ↓
4. Cohort Created (scheduled)
   ↓
5. Students Enrolled (pending → invited → active)
   ↓
6. Cohort Started (status: active)
   ↓
7. Sessions Progress (current_session: 1 → 2 → 3...)
   ↓
8. Cohort Completed (status: completed)
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

### How to advance students to the next session?
1. Go to `/courses/[slug]/admin`
2. Click "Set Current Session to [X]" button
3. All students in cohort advance together

### How to give someone admin access to a course?
1. Enroll them in a cohort for that course
2. Set their role to `admin` in the enrollment

---

*Last updated: October 30, 2025*
