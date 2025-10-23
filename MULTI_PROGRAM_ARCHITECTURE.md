# Multi-Program Platform Architecture
## Complete Flow: Program Creation → Student Login

---

## 🎯 Core Concepts

### Hierarchy
```
PLATFORM (arch-tools)
  └── PROGRAMS (ACCF, CLI, etc.)
      └── MODULES (Foundations, Scripture, etc.)
          └── COHORTS (Feb 2025, Aug 2025)
              └── ENROLLMENTS (Students in specific cohort)
                  └── SESSIONS (Week 1-8)
```

### Key Insight: **Programs are Independent Course Platforms**
- Each program has its own branding, features, and terminology
- Students can be enrolled in multiple programs
- Course creators manage their own program(s)
- Platform admins manage everything

---

## 👥 User Roles & Permissions

### Platform Level (Arch-Tools)

| Role | Can Do | Example |
|------|--------|---------|
| `platform_admin` | Create programs, manage all users, access everything | Archbishop's office staff |
| `platform_viewer` | View analytics across all programs | Diocesan leadership |

### Program Level (ACCF, CLI, etc.)

| Role | Can Do | Example |
|------|--------|---------|
| `program_admin` | Full control over ONE program (create modules, cohorts, enroll students) | ACCF Director |
| `program_instructor` | Teach cohorts, grade reflections, create content | ACCF Faculty |
| `hub_coordinator` | Manage hub students, mark attendance, view hub reflections | Parish Hub Leader |
| `program_student` | Take courses, submit work | ACCF Student |

### Hub Coordinator Capabilities

Hub Coordinators are **above students but below instructors**. They:

✅ **CAN:**
- View all students assigned to their hub
- Mark attendance for hub members
- View public reflections from hub members
- See hub-level progress reports
- Communicate with hub members
- Access hub meeting materials

❌ **CANNOT:**
- Grade reflections (instructor-only)
- Create or edit content
- Enroll students
- Promote students to next session
- Access other hubs' data
- Change cohort settings

### How Roles Work
```typescript
user_profiles {
  id: uuid
  email: text
  full_name: text
  platform_role: 'platform_admin' | 'user' // Platform-wide access
  created_at: timestamp
}

program_members {
  id: uuid
  user_profile_id: uuid → user_profiles(id)
  program_id: uuid → programs(id)
  role: 'program_admin' | 'program_instructor' | 'hub_coordinator' | 'program_student'
  hub_id: uuid → hubs(id) // ONLY for hub_coordinator role
  permissions: jsonb // Granular permissions within program
  created_at: timestamp
}
```

**Key Principle:**
- Platform admins can do anything in any program
- Program admins can only manage their assigned program(s)
- Students can be enrolled in multiple programs with different roles

---

## 🏗️ Database Schema (Multi-Program)

```sql
-- ============================================
-- PLATFORM LEVEL
-- ============================================

-- Core user identity (platform-wide)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  platform_role TEXT DEFAULT 'user' CHECK (platform_role IN ('platform_admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Programs (course platforms like ACCF, CLI)
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'accf', 'cli', etc.
  name TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}'::jsonb, -- Branding, features, terminology
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Program membership (who has access to which programs)
CREATE TABLE program_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('program_admin', 'program_instructor', 'program_coordinator', 'program_student')),
  permissions JSONB DEFAULT '{}'::jsonb, -- Fine-grained permissions
  invited_by UUID REFERENCES user_profiles(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_profile_id, program_id) -- User can only have one role per program
);

-- ============================================
-- PROGRAM LEVEL (Content Structure)
-- ============================================

-- Modules (course content: "Foundations of Faith")
CREATE TABLE modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_number INTEGER NOT NULL,
  session_count INTEGER DEFAULT 8, -- How many sessions in this module
  config JSONB DEFAULT '{}'::jsonb, -- Module-specific settings
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, name)
);

-- Module materials (videos, documents, etc.)
CREATE TABLE module_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL, -- Week 1-8
  type TEXT NOT NULL CHECK (type IN ('video', 'document', 'link', 'html', 'reading')),
  title TEXT NOT NULL,
  content JSONB NOT NULL, -- URL, embed code, or HTML
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Module reflection questions
CREATE TABLE module_reflection_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  required BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- COHORT LEVEL (Scheduled Instances)
-- ============================================

-- Cohorts (scheduled instances: "Feb 2025 Foundations")
CREATE TABLE cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  current_session INTEGER DEFAULT 1, -- Manually controlled by admin
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'archived')),
  max_students INTEGER, -- Optional enrollment cap
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Hubs (optional: physical meeting locations)
CREATE TABLE hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  coordinator_id UUID REFERENCES user_profiles(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ENROLLMENT LEVEL (Students in Cohorts)
-- ============================================

-- Cohort enrollments (students in specific cohorts)
CREATE TABLE cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  hub_id UUID REFERENCES hubs(id),
  current_session INTEGER DEFAULT 1, -- Individual student progression
  assigned_instructor_id UUID REFERENCES user_profiles(id), -- Who grades this student
  status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'withdrawn')),
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reflections (student work)
CREATE TABLE reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES cohort_enrollments(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  content JSONB NOT NULL, -- Answers to questions
  is_public BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  graded_by UUID REFERENCES user_profiles(id),
  grade TEXT CHECK (grade IN ('pass', 'fail', 'pending')),
  feedback TEXT,
  graded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance tracking
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES cohort_enrollments(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  present BOOLEAN NOT NULL,
  marked_by UUID NOT NULL REFERENCES user_profiles(id),
  marked_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(enrollment_id, session_number)
);
```

---

## 🏘️ Hub System Architecture

### What are Hubs?

Hubs are **physical meeting locations** where students gather for in-person sessions. Think:
- Parish groups
- Diocesan centers
- Catholic schools
- Community centers

### Hub Features

Each hub has:
- **Hub Coordinator** - Local leader who manages the group
- **Meeting Location** - Where the group meets
- **Student Roster** - Students assigned to this hub
- **Attendance Tracking** - Per-session attendance
- **Local Communication** - Hub-specific announcements

### Hub Data Model

```typescript
hubs {
  id: uuid
  program_id: uuid → programs(id)
  name: text // "St. Mary's Parish Hub"
  location: text // "123 Main St, Parish Hall"
  coordinator_id: uuid → user_profiles(id)
  meeting_schedule: jsonb // { "day": "Thursday", "time": "7:00 PM" }
  active: boolean
  created_at: timestamp
}

// Hub coordinator assignment
program_members {
  user_profile_id: coordinator_user_id
  program_id: accf_program_id
  role: 'hub_coordinator'
  hub_id: st_marys_hub_id // ← Linked to their hub
}

// Student hub assignment
cohort_enrollments {
  user_profile_id: student_user_id
  cohort_id: feb_2025_foundations_id
  hub_id: st_marys_hub_id // ← Student belongs to this hub
}
```

### Hub Coordinator Permissions (RLS)

```sql
-- Hub coordinators can ONLY see their own hub's data
CREATE POLICY "hub_coordinators_view_own_hub"
ON cohort_enrollments
FOR SELECT
USING (
  hub_id IN (
    SELECT hub_id
    FROM program_members
    WHERE user_profile_id = auth.uid()
    AND role = 'hub_coordinator'
  )
);

-- Hub coordinators can mark attendance for their hub
CREATE POLICY "hub_coordinators_mark_attendance"
ON attendance
FOR INSERT
WITH CHECK (
  enrollment_id IN (
    SELECT ce.id
    FROM cohort_enrollments ce
    JOIN program_members pm ON ce.hub_id = pm.hub_id
    WHERE pm.user_profile_id = auth.uid()
    AND pm.role = 'hub_coordinator'
  )
);
```

---

## 🔄 Complete User Flows

### Flow 1: Platform Admin Creates New Program (CLI)

```
1. Platform Admin logs in
   ↓
2. Goes to /platform/programs
   ↓
3. Clicks "Create New Program"
   ↓
4. Fills form:
   - Slug: "cli"
   - Name: "Catholic Leadership Institute"
   - Description: "Executive leadership development"
   - Config (branding):
     * Logo URL
     * Primary color: #2c3e50
     * Accent color: #e67e22
   - Features:
     * Hubs enabled: No
     * Grading enabled: Yes
     * Public reflections: No
   ↓
5. System creates program record
   ↓
6. Platform Admin assigns Program Admin:
   - Search for user by email
   - If doesn't exist, send invite
   - Set role: "program_admin"
   ↓
7. Program Admin receives email:
   "You've been invited to manage Catholic Leadership Institute"
   ↓
8. Program Admin logs in, lands on /courses/cli/admin
```

**Database Changes:**
```sql
-- Step 5
INSERT INTO programs (slug, name, description, config, created_by)
VALUES ('cli', 'Catholic Leadership Institute', '...', {...}, platform_admin_id);

-- Step 6
INSERT INTO program_members (user_profile_id, program_id, role, invited_by)
VALUES (program_admin_id, cli_program_id, 'program_admin', platform_admin_id);
```

---

### Flow 2: Program Admin Creates Module & Content

```
1. Program Admin logs into CLI program
   ↓
2. Goes to /courses/cli/admin/modules
   ↓
3. Clicks "Create Module"
   ↓
4. Fills form:
   - Module name: "Leadership Foundations"
   - Description: "Core principles of Catholic leadership"
   - Sessions: 6 (instead of default 8)
   ↓
5. System creates module
   ↓
6. Program Admin clicks into module
   ↓
7. For each session (1-6):
   a. Add materials:
      - Video: "What is Leadership?" (YouTube URL)
      - Reading: "Servant Leadership" (PDF link)
      - Document: "Discussion Guide" (HTML editor)

   b. Add reflection questions:
      - "How does servant leadership differ from corporate leadership?"
      - "Describe a time when you led through service"
   ↓
8. Module is ready for cohorts
```

**Database Changes:**
```sql
-- Step 5
INSERT INTO modules (program_id, name, description, session_count, created_by)
VALUES (cli_program_id, 'Leadership Foundations', '...', 6, program_admin_id);

-- Step 7a
INSERT INTO module_materials (module_id, session_number, type, title, content)
VALUES
  (module_id, 1, 'video', 'What is Leadership?', '{"url": "..."}'),
  (module_id, 1, 'document', 'Servant Leadership', '{"url": "..."}');

-- Step 7b
INSERT INTO module_reflection_questions (module_id, session_number, question_text)
VALUES (module_id, 1, 'How does servant leadership differ...');
```

---

### Flow 3: Program Admin Creates Cohort & Invites Students

```
1. Program Admin goes to /courses/cli/admin/cohorts
   ↓
2. Clicks "Create Cohort"
   ↓
3. Fills form:
   - Module: "Leadership Foundations"
   - Cohort name: "Spring 2025 Leadership"
   - Start date: March 1, 2025
   - End date: April 15, 2025
   - Max students: 30
   ↓
4. System creates cohort
   ↓
5. Program Admin clicks "Enroll Students"
   ↓
6. Two options:

   A. INVITE BY EMAIL:
      - Enter emails (one per line or CSV upload)
      - System checks if users exist
      - If not, creates pending user_profile
      - Creates cohort_enrollment (status: pending)
      - Sends invitation email

   B. ENROLL EXISTING PROGRAM MEMBERS:
      - Shows list of users already in CLI program
      - Select students to enroll
      - Creates cohort_enrollment (status: active)
   ↓
7. Student receives email:
   "You've been invited to Spring 2025 Leadership at Catholic Leadership Institute"
   ↓
8. Student clicks link in email
   ↓
9. If new user:
   - Create account (password setup)
   - System creates user_profile
   - System creates program_member (role: program_student)
   - System activates cohort_enrollment

   If existing user:
   - Just activates cohort_enrollment
   ↓
10. Student lands on /courses/cli/dashboard
```

**Database Changes:**
```sql
-- Step 4
INSERT INTO cohorts (program_id, module_id, name, start_date, end_date, created_by)
VALUES (cli_program_id, module_id, 'Spring 2025 Leadership', '2025-03-01', '2025-04-15', admin_id);

-- Step 6A (Invite new user)
-- Create pending user
INSERT INTO user_profiles (email, full_name, platform_role)
VALUES ('john@example.com', 'John Doe', 'user');

-- Add to program
INSERT INTO program_members (user_profile_id, program_id, role, invited_by)
VALUES (user_id, cli_program_id, 'program_student', admin_id);

-- Enroll in cohort
INSERT INTO cohort_enrollments (user_profile_id, cohort_id, status)
VALUES (user_id, cohort_id, 'pending');

-- Step 9 (User accepts)
UPDATE cohort_enrollments
SET status = 'active', enrolled_at = now()
WHERE id = enrollment_id;
```

---

### Flow 3B: Program Admin Creates Hub & Assigns Coordinator

```
1. Program Admin goes to /courses/accf/admin/hubs
   ↓
2. Clicks "Create Hub"
   ↓
3. Fills form:
   - Hub name: "St. Mary's Parish Hub"
   - Location: "123 Main St, Parish Hall, Room 5"
   - Meeting schedule:
     * Day: Thursday
     * Time: 7:00 PM
   - Max capacity: 25
   ↓
4. System creates hub
   ↓
5. Program Admin clicks "Assign Coordinator"
   ↓
6. Two options:

   A. SELECT EXISTING USER:
      - Search for user in program
      - Select user
      - System updates program_member role to 'hub_coordinator'
      - System links hub_id to their program_member record

   B. INVITE NEW COORDINATOR:
      - Enter email: mary.smith@parish.org
      - Enter name: Mary Smith
      - System creates user_profile
      - System creates program_member (role: hub_coordinator, hub_id: hub_id)
      - Sends invitation email
   ↓
7. Coordinator receives email:
   "You've been assigned as Hub Coordinator for St. Mary's Parish Hub"
   ↓
8. Coordinator logs in, lands on /courses/accf/hub/dashboard
   ↓
9. Program Admin assigns students to hub:
   - Goes to cohort student list
   - Bulk select students by location/parish
   - Set hub: "St. Mary's Parish Hub"
   - Students now show in coordinator's roster
```

**Database Changes:**
```sql
-- Step 4: Create hub
INSERT INTO hubs (program_id, name, location, meeting_schedule)
VALUES (
  accf_program_id,
  'St. Mary''s Parish Hub',
  '123 Main St, Parish Hall, Room 5',
  '{"day": "Thursday", "time": "7:00 PM"}'::jsonb
);

-- Step 6A: Assign existing user as coordinator
UPDATE program_members
SET role = 'hub_coordinator', hub_id = st_marys_hub_id
WHERE user_profile_id = mary_user_id AND program_id = accf_program_id;

-- OR Step 6B: Invite new coordinator
INSERT INTO user_profiles (email, full_name) VALUES (...);
INSERT INTO program_members (user_profile_id, program_id, role, hub_id)
VALUES (mary_user_id, accf_program_id, 'hub_coordinator', st_marys_hub_id);

-- Step 9: Assign students to hub
UPDATE cohort_enrollments
SET hub_id = st_marys_hub_id
WHERE user_profile_id IN (student1_id, student2_id, ...);
```

---

### Flow 3C: Hub Coordinator Dashboard & Attendance

```
1. Hub Coordinator logs in
   ↓
2. System redirects to /courses/accf/hub/dashboard
   ↓
3. Dashboard shows:

   ┌─────────────────────────────────────────────┐
   │  St. Mary's Parish Hub                      │
   │  Thursday 7:00 PM • Parish Hall, Room 5     │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  Active Cohort: Feb 2025 Foundations        │
   │  Current Session: 3 of 8                    │
   │  Next Meeting: Feb 20, 2025                 │
   │                                             │
   │  [Mark Attendance for Session 3]            │
   │                                             │
   ├─────────────────────────────────────────────┤
   │  Hub Roster (18 students)                   │
   │                                             │
   │  ☑ John Doe        Progress: 3/8  ✓ ✓ ✓   │
   │  ☑ Jane Smith      Progress: 3/8  ✓ ✓ ✓   │
   │  ☐ Bob Johnson     Progress: 2/8  ✓ ✓ -   │
   │  ☑ Mary Williams   Progress: 3/8  ✓ - ✓   │
   │  ...                                        │
   │                                             │
   │  [View Public Reflections]                  │
   │  [Download Hub Report]                      │
   │                                             │
   └─────────────────────────────────────────────┘
   ↓
4. Coordinator clicks "Mark Attendance for Session 3"
   ↓
5. Attendance marking interface:

   ┌─────────────────────────────────────────────┐
   │  Session 3 Attendance - Feb 20, 2025        │
   ├─────────────────────────────────────────────┤
   │                                             │
   │  ☑ John Doe           [Present] [Absent]   │
   │  ☑ Jane Smith         [Present] [Absent]   │
   │  ☐ Bob Johnson        [Present] [Absent]   │
   │  ☑ Mary Williams      [Present] [Absent]   │
   │  ...                                        │
   │                                             │
   │  Quick Actions:                             │
   │  [Mark All Present] [Mark All Absent]       │
   │                                             │
   │  Notes (optional):                          │
   │  [Great discussion tonight...]              │
   │                                             │
   │  [Save Attendance]                          │
   │                                             │
   └─────────────────────────────────────────────┘
   ↓
6. Coordinator marks attendance, clicks Save
   ↓
7. System creates attendance records:

   INSERT INTO attendance (enrollment_id, session_number, present, marked_by)
   VALUES
     (john_enrollment_id, 3, true, coordinator_user_id),
     (jane_enrollment_id, 3, true, coordinator_user_id),
     (bob_enrollment_id, 3, false, coordinator_user_id);
   ↓
8. Dashboard updates showing attendance marked ✓
   ↓
9. Program Admin can see attendance data in admin reports
```

**What Coordinator SEES:**
- ✅ Students in their hub only
- ✅ Public reflections from hub members
- ✅ Attendance history for hub
- ✅ Progress reports for hub
- ✅ Materials for current session

**What Coordinator CANNOT SEE:**
- ❌ Students in other hubs
- ❌ Private reflections
- ❌ Grades or instructor feedback
- ❌ Other hubs' attendance
- ❌ Admin functions

---

### Flow 4: Student Login & Auto-Routing

This is the KEY flow for user experience.

#### Scenario A: Student Enrolled in ONE Program (Simple)

```
1. Student goes to login page (any URL: /login, /auth, /courses/cli/login)
   ↓
2. Enters email + password (or magic link)
   ↓
3. System authenticates via Supabase
   ↓
4. Server checks enrollments:

   SELECT DISTINCT p.slug, p.name
   FROM program_members pm
   JOIN programs p ON pm.program_id = p.id
   WHERE pm.user_profile_id = user_id
   AND pm.role = 'program_student'
   ↓
5. Found 1 program: "cli"
   ↓
6. System redirects to: /courses/cli/dashboard
   ↓
7. Dashboard shows active cohorts for this student
```

#### Scenario B: Student Enrolled in MULTIPLE Programs (Choice)

```
1. Student logs in (same as above)
   ↓
2. Server checks enrollments
   ↓
3. Found 2 programs: ["accf", "cli"]
   ↓
4. System redirects to: /programs/select
   ↓
5. Shows program selector:

   ┌─────────────────────────────────────┐
   │  Select Your Course                 │
   ├─────────────────────────────────────┤
   │                                     │
   │  [ACCF Logo]                        │
   │  Archdiocesan Center for            │
   │  Catholic Formation                 │
   │  • Active: Feb 2025 Foundations     │
   │  [Continue to ACCF →]               │
   │                                     │
   │  [CLI Logo]                         │
   │  Catholic Leadership Institute      │
   │  • Active: Spring 2025 Leadership   │
   │  [Continue to CLI →]                │
   │                                     │
   └─────────────────────────────────────┘
   ↓
6. Student clicks "Continue to CLI"
   ↓
7. System redirects to: /courses/cli/dashboard
   ↓
8. Stores preference in session/cookie for next login
```

#### Scenario C: Hub Coordinator Login

```
1. Hub Coordinator logs in
   ↓
2. Server checks roles:
   - program_members: hub_coordinator for ACCF (hub_id: st_marys_hub_id)
   ↓
3. System redirects to: /courses/accf/hub/dashboard
   ↓
4. Dashboard loads hub-specific data:

   SELECT
     h.*,
     COUNT(ce.id) as student_count,
     c.name as cohort_name,
     c.current_session
   FROM hubs h
   JOIN program_members pm ON h.id = pm.hub_id
   LEFT JOIN cohort_enrollments ce ON ce.hub_id = h.id
   LEFT JOIN cohorts c ON ce.cohort_id = c.id
   WHERE pm.user_profile_id = coordinator_user_id
   AND pm.role = 'hub_coordinator'
   GROUP BY h.id, c.name, c.current_session;
```

#### Scenario D: User with Multiple Roles

```
1. User logs in
   ↓
2. Server checks roles:
   - program_members: program_admin for CLI, hub_coordinator for ACCF, program_student for ACCF
   - platform_role: user
   ↓
3. System redirects to: /dashboard (platform dashboard)
   ↓
4. Platform dashboard shows:

   ┌─────────────────────────────────────┐
   │  My Programs                        │
   ├─────────────────────────────────────┤
   │                                     │
   │  CLI - Program Admin                │
   │  [Manage Program →]                 │
   │                                     │
   │  ACCF - Hub Coordinator             │
   │  [Manage Hub →]                     │
   │                                     │
   │  ACCF - Student                     │
   │  [View Course →]                    │
   │                                     │
   └─────────────────────────────────────┘
```

#### Scenario E: Platform Admin (God Mode)

```
1. Platform admin logs in
   ↓
2. Server checks platform_role: 'platform_admin'
   ↓
3. System redirects to: /platform/admin
   ↓
4. Platform admin dashboard:
   - View all programs
   - View all users
   - Create new programs
   - Access any program admin panel
   - System analytics
```

---

## 🔐 Auth System Integration

### Updated Auth Functions

```typescript
// $lib/server/auth.ts

/**
 * Get all programs user has access to
 */
export async function getUserPrograms(event: RequestEvent) {
  const { user } = await requireAuth(event);

  const { data: memberships } = await event.locals.supabase
    .from('program_members')
    .select('*, programs(*)')
    .eq('user_profile_id', user.id);

  return memberships || [];
}

/**
 * Check if user has access to specific program
 */
export async function requireProgramAccess(
  event: RequestEvent,
  programSlug: string,
  requiredRoles?: string[]
) {
  const { user } = await requireAuth(event);

  const { data: membership } = await event.locals.supabase
    .from('program_members')
    .select('*, programs(*)')
    .eq('user_profile_id', user.id)
    .eq('programs.slug', programSlug)
    .single();

  if (!membership) {
    throw error(403, `No access to program: ${programSlug}`);
  }

  if (requiredRoles && !requiredRoles.includes(membership.role)) {
    throw error(403, `Insufficient permissions in program: ${programSlug}`);
  }

  return { user, membership };
}

/**
 * Require program admin role
 */
export async function requireProgramAdmin(event: RequestEvent, programSlug: string) {
  return requireProgramAccess(event, programSlug, ['program_admin']);
}
```

### Login Handler

```typescript
// src/routes/auth/callback/+server.ts
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const code = url.searchParams.get('code');

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw redirect(303, '/login');
  }

  // Check platform role first
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single();

  if (profile?.platform_role === 'platform_admin') {
    throw redirect(303, '/platform/admin');
  }

  // Get user's program memberships
  const { data: memberships } = await supabase
    .from('program_members')
    .select('role, programs(slug, name)')
    .eq('user_profile_id', user.id);

  if (!memberships || memberships.length === 0) {
    throw redirect(303, '/welcome'); // No programs - onboarding
  }

  // Single program - direct to that program
  if (memberships.length === 1) {
    const program = memberships[0].programs;
    const role = memberships[0].role;

    if (role === 'program_admin') {
      throw redirect(303, `/courses/${program.slug}/admin`);
    } else {
      throw redirect(303, `/courses/${program.slug}/dashboard`);
    }
  }

  // Multiple programs - show selector
  throw redirect(303, '/programs/select');
};
```

---

## 🎨 UI Components Needed

### 1. Program Selector (Multiple Enrollments)
```svelte
<!-- src/routes/programs/select/+page.svelte -->
<script>
  let { data } = $props();
  let programs = $derived(data.programs);
</script>

<div class="max-w-4xl mx-auto p-8">
  <h1 class="text-3xl font-bold mb-8">Select Your Course</h1>

  <div class="grid gap-6 md:grid-cols-2">
    {#each programs as program}
      <a
        href="/courses/{program.slug}/dashboard"
        class="block p-6 rounded-lg border-2 hover:border-blue-500 transition"
      >
        <img src={program.logo_url} alt={program.name} class="h-16 mb-4" />
        <h2 class="text-xl font-semibold mb-2">{program.name}</h2>
        <p class="text-gray-600 mb-4">{program.description}</p>

        {#if program.active_cohorts.length > 0}
          <div class="text-sm text-gray-500">
            Active: {program.active_cohorts.map(c => c.name).join(', ')}
          </div>
        {/if}
      </a>
    {/each}
  </div>
</div>
```

### 2. Platform Admin Dashboard
```svelte
<!-- src/routes/platform/admin/+page.svelte -->
<div class="grid grid-cols-3 gap-6">
  <div class="col-span-2">
    <h2>Programs</h2>
    <ProgramsList programs={data.programs} />
    <button onclick={() => goto('/platform/programs/create')}>
      Create New Program
    </button>
  </div>

  <div>
    <h2>Quick Stats</h2>
    <div>Total Programs: {data.stats.programs}</div>
    <div>Total Users: {data.stats.users}</div>
    <div>Active Cohorts: {data.stats.activeCohorts}</div>
  </div>
</div>
```

### 3. Program Admin Dashboard
```svelte
<!-- src/routes/courses/[program_slug]/admin/+page.svelte -->
<script>
  let { data } = $props();
  let program = $derived(data.program);
  let cohorts = $derived(data.cohorts);
</script>

<div class="p-8">
  <h1>{program.name} - Administration</h1>

  <div class="grid grid-cols-4 gap-4 my-8">
    <StatCard label="Active Cohorts" value={cohorts.active} />
    <StatCard label="Total Students" value={data.stats.students} />
    <StatCard label="Pending Reviews" value={data.stats.pendingGrading} />
    <StatCard label="Modules" value={data.stats.modules} />
  </div>

  <Tabs>
    <Tab label="Cohorts">
      <CohortsTable cohorts={cohorts} />
    </Tab>
    <Tab label="Modules">
      <ModulesTable modules={data.modules} />
    </Tab>
    <Tab label="Students">
      <StudentsTable students={data.students} />
    </Tab>
  </Tabs>
</div>
```

---

## 🔄 Migration Path from Current ACCF

### Phase 1: Add Multi-Program Tables

```sql
-- Keep existing tables, add new ones
CREATE TABLE programs (...);
CREATE TABLE program_members (...);

-- Add program_id to existing tables
ALTER TABLE modules ADD COLUMN program_id UUID REFERENCES programs(id);
ALTER TABLE cohorts ADD COLUMN program_id UUID REFERENCES programs(id);
ALTER TABLE hubs ADD COLUMN program_id UUID REFERENCES programs(id);

-- Create ACCF program
INSERT INTO programs (slug, name, ...) VALUES ('accf', 'ACCF', ...);

-- Migrate existing data
UPDATE modules SET program_id = (SELECT id FROM programs WHERE slug = 'accf');
UPDATE cohorts SET program_id = (SELECT id FROM programs WHERE slug = 'accf');
UPDATE hubs SET program_id = (SELECT id FROM programs WHERE slug = 'accf');

-- Migrate existing users to program_members
INSERT INTO program_members (user_profile_id, program_id, role)
SELECT
  au.user_profile_id,
  (SELECT id FROM programs WHERE slug = 'accf'),
  CASE
    WHEN up.role = 'accf_admin' THEN 'program_admin'
    WHEN up.role = 'accf_student' THEN 'program_student'
    WHEN up.role = 'hub_coordinator' THEN 'program_coordinator'
  END
FROM accf_users au
JOIN user_profiles up ON au.user_profile_id = up.id;
```

---

## ✅ Summary: Key Design Decisions

1. **Programs are isolated** - Each program is its own world with branding/features
2. **Users can have multiple roles** - Student in ACCF, Admin in CLI
3. **Platform admins are super users** - Can access any program
4. **Auto-routing on login** - Smart redirect based on enrollment(s)
5. **Consistent URLs** - `/courses/{program_slug}/...` for all programs
6. **Program-scoped auth** - Check program access, not just authentication
7. **Flexible permissions** - Role + optional granular permissions in JSONB
