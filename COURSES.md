# Multi-Program Platform Migration Plan
## Transforming ACCF into ArchMin Courses Platform

**Status:** Planning Document
**Last Updated:** 2025-10-07
**Migration Strategy:** Clean slate (test data can be wiped)

---

## 🎯 Executive Summary

Transform the current ACCF-specific platform into a flexible multi-program course platform supporting ACCF, CLI, and future programs with:
- **Program isolation** with distinct branding, content, and features
- **Unified user management** across all programs
- **Flexible module/session structures** per program
- **URL-based program scoping** for clear navigation
- **Role-based permissions** at the enrollment level

---

## 📊 Confirmed Architecture Decisions

| Decision Point | Solution | Rationale |
|---------------|----------|-----------|
| **Table Rename** | `accf_users` → `cohort_enrollments` | Accurately reflects enrollment in cohorts, scales to all programs |
| **Program-Module Relationship** | Programs OWN modules (strong isolation) | ACCF and CLI have different curricula, no content sharing needed |
| **Role Model** | Roles at enrollment level, not user profile | One user can be admin in ACCF, student in CLI |
| **URL Structure** | `/courses/{program_slug}/...` | Self-documenting, deep links work, no session confusion |
| **Hubs** | Program-scoped with feature flag | Some programs have hubs (ACCF), others don't (CLI) |
| **Migration Strategy** | Clean migration (wipe test data) | No production data to preserve, allows clean schema redesign |
| **Admin Interface** | Program-scoped routes | Separate admin views per program, no cross-program aggregation yet |
| **Content Sharing** | Distinct modules per program | Future: shared materials library, but not in initial implementation |

---

## 🗄️ Database Schema Changes

### **New Tables**

#### 1. `programs` - Top-level program definitions
```sql
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,  -- 'accf', 'cli'
  name TEXT NOT NULL,  -- 'Archdiocesan Center for Catholic Formation'
  description TEXT,

  -- Branding
  logo_url TEXT,
  primary_color TEXT,  -- Hex color: '#334642'
  accent_color TEXT,   -- Hex color: '#c59a6b'
  light_color TEXT,    -- Hex color: '#eae2d9'

  -- Terminology customization
  session_term TEXT DEFAULT 'session',  -- Could be 'module', 'week', etc.
  cohort_term TEXT DEFAULT 'cohort',
  reflection_term TEXT DEFAULT 'reflection',

  -- Feature flags
  hubs_enabled BOOLEAN DEFAULT false,
  public_reflections_enabled BOOLEAN DEFAULT true,
  attendance_tracking_enabled BOOLEAN DEFAULT true,
  grading_enabled BOOLEAN DEFAULT true,

  -- Status
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE programs IS 'Top-level course programs (ACCF, CLI, etc.) with branding and feature configuration';
```

**Initial Data:**
```sql
INSERT INTO programs (slug, name, primary_color, accent_color, light_color, hubs_enabled, grading_enabled)
VALUES
  ('accf', 'Archdiocesan Center for Catholic Formation', '#334642', '#c59a6b', '#eae2d9', true, true),
  ('cli', 'Catholic Leadership Institute', '#2c3e50', '#e67e22', '#ecf0f1', false, false);
```

---

### **Modified Tables**

#### 2. `modules` - Add program_id
```sql
ALTER TABLE modules
  ADD COLUMN program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE;

CREATE INDEX idx_modules_program_id ON modules(program_id);

COMMENT ON COLUMN modules.program_id IS 'Program that owns this module - modules are NOT shared between programs';
```

**Migration:**
```sql
-- Create ACCF program first, then:
UPDATE modules SET program_id = (SELECT id FROM programs WHERE slug = 'accf');
```

---

#### 3. `cohorts` - Add program_id (denormalized for performance)
```sql
ALTER TABLE cohorts
  ADD COLUMN program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE;

CREATE INDEX idx_cohorts_program_id ON cohorts(program_id);

COMMENT ON COLUMN cohorts.program_id IS 'Denormalized from modules.program_id for query performance';
```

**Migration:**
```sql
UPDATE cohorts
SET program_id = (
  SELECT program_id FROM modules WHERE modules.id = cohorts.module_id
);
```

---

#### 4. `hubs` - Add program_id and active flag
```sql
ALTER TABLE hubs
  ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  ADD COLUMN active BOOLEAN DEFAULT true;

CREATE INDEX idx_hubs_program_id ON hubs(program_id);

COMMENT ON COLUMN hubs.program_id IS 'Program this hub belongs to. NULL for legacy/universal hubs.';
```

---

#### 5. `accf_users` → `cohort_enrollments` - RENAME + Add role column
```sql
-- Step 1: Create new table with corrected structure
CREATE TABLE cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User & Cohort linkage
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,

  -- Role in THIS specific cohort
  role TEXT NOT NULL CHECK (role IN ('student', 'admin', 'coordinator')),

  -- Student progression
  current_session INTEGER DEFAULT 1 CHECK (current_session >= 1 AND current_session <= 12),

  -- Hub assignment (if program has hubs)
  hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL,

  -- Admin assignment (for reflection marking)
  assigned_admin_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Invitation workflow
  email TEXT NOT NULL,  -- Used before user_profile_id is set
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invited', 'accepted', 'active', 'held', 'completed', 'withdrawn', 'error')),
  invitation_token UUID UNIQUE DEFAULT gen_random_uuid(),
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,

  -- Import tracking
  imported_by UUID REFERENCES user_profiles(id),
  error_message TEXT,

  -- Timestamps
  enrolled_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

CREATE INDEX idx_cohort_enrollments_user_profile ON cohort_enrollments(user_profile_id);
CREATE INDEX idx_cohort_enrollments_cohort ON cohort_enrollments(cohort_id);
CREATE INDEX idx_cohort_enrollments_status ON cohort_enrollments(status);
CREATE INDEX idx_cohort_enrollments_hub ON cohort_enrollments(hub_id);

COMMENT ON TABLE cohort_enrollments IS 'User enrollments in specific cohorts - one row per user per cohort';
COMMENT ON COLUMN cohort_enrollments.role IS 'User role in THIS cohort: student, admin, or coordinator';
COMMENT ON COLUMN cohort_enrollments.current_session IS 'Student progression (1-12), advanced manually by admin';
COMMENT ON COLUMN cohort_enrollments.user_profile_id IS 'Links to user_profiles.id. NULL until user accepts invitation.';

-- Step 2: Migrate data from accf_users
INSERT INTO cohort_enrollments (
  id, user_profile_id, cohort_id, role, current_session, hub_id,
  assigned_admin_id, email, full_name, status, invitation_token,
  invitation_sent_at, invitation_accepted_at, imported_by, error_message,
  enrolled_at, created_at, updated_at
)
SELECT
  id, user_profile_id, cohort_id,
  role,  -- This already has 'accf_student', 'accf_admin', etc.
  current_session, hub_id, assigned_admin_id, email, full_name, status,
  invitation_token, invitation_sent_at, invitation_accepted_at,
  imported_by, error_message, enrolled_at, created_at, updated_at
FROM accf_users;

-- Step 3: Update role values to new system
UPDATE cohort_enrollments
SET role = CASE
  WHEN role = 'accf_student' THEN 'student'
  WHEN role = 'accf_admin' THEN 'admin'
  WHEN role = 'hub_coordinator' THEN 'coordinator'
  ELSE 'student'
END;

-- Step 4: Update foreign keys in dependent tables
ALTER TABLE attendance
  DROP CONSTRAINT attendance_accf_user_id_fkey,
  ADD CONSTRAINT attendance_enrollment_id_fkey
    FOREIGN KEY (accf_user_id) REFERENCES cohort_enrollments(id);

ALTER TABLE reflection_responses
  DROP CONSTRAINT reflection_responses_accf_user_id_fkey,
  ADD CONSTRAINT reflection_responses_enrollment_id_fkey
    FOREIGN KEY (accf_user_id) REFERENCES cohort_enrollments(id);

ALTER TABLE cohort_activity_log
  DROP CONSTRAINT cohort_activity_log_actor_id_fkey,
  ADD CONSTRAINT cohort_activity_log_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES cohort_enrollments(id);

-- Step 5: Rename column references in dependent tables
ALTER TABLE attendance RENAME COLUMN accf_user_id TO enrollment_id;
ALTER TABLE reflection_responses RENAME COLUMN accf_user_id TO enrollment_id;

-- Step 6: Drop old table and rename new one
DROP TABLE accf_users CASCADE;
-- No need to rename since we created cohort_enrollments directly

-- Step 7: Enable RLS
ALTER TABLE cohort_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own enrollments"
  ON cohort_enrollments FOR SELECT
  USING (auth.uid() = user_profile_id);

CREATE POLICY "Admins can view all enrollments in their program"
  ON cohort_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cohort_enrollments ce
      JOIN cohorts c ON ce.cohort_id = c.id
      WHERE ce.user_profile_id = auth.uid()
        AND ce.role = 'admin'
        AND c.program_id = (
          SELECT program_id FROM cohorts WHERE id = cohort_enrollments.cohort_id
        )
    )
  );
```

---

#### 6. `user_profiles` - Simplify role enum
```sql
-- Remove program-specific roles from enum
-- Keep only platform-level roles
ALTER TYPE user_role RENAME TO user_role_old;

CREATE TYPE user_role AS ENUM (
  'platform_admin',  -- Can manage all programs
  'platform_viewer', -- Read-only access to platform
  'user'            -- Standard user (roles per enrollment)
);

ALTER TABLE user_profiles
  ALTER COLUMN role TYPE user_role
  USING (
    CASE
      WHEN role IN ('admin', 'accf_admin') THEN 'platform_admin'::user_role
      WHEN role = 'viewer' THEN 'platform_viewer'::user_role
      ELSE 'user'::user_role
    END
  );

DROP TYPE user_role_old;

COMMENT ON COLUMN user_profiles.role IS 'Platform-level role. Program-specific roles stored in cohort_enrollments.role';
```

---

### **New Tables for Enhanced Features**

#### 7. `program_settings` - Extended configuration
```sql
CREATE TABLE program_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(program_id, setting_key)
);

COMMENT ON TABLE program_settings IS 'Extended program configuration as key-value pairs';

-- Example settings:
INSERT INTO program_settings (program_id, setting_key, setting_value)
VALUES
  ((SELECT id FROM programs WHERE slug = 'accf'), 'email_templates', '{"welcome": "...", "reminder": "..."}'),
  ((SELECT id FROM programs WHERE slug = 'accf'), 'completion_criteria', '{"min_attendance": 6, "min_passing_reflections": 7}');
```

---

## 🗂️ Route Structure Changes

### **Current Structure (ACCF-only)**
```
/
├── (accf)/
│   ├── login
│   ├── dashboard
│   ├── materials
│   ├── reflections
│   └── admin/
│       ├── cohorts
│       ├── reflections
│       └── attendance
```

### **New Structure (Multi-Program)**
```
/
├── courses/
│   ├── [program_slug]/
│   │   ├── +layout.server.ts      # Program context loader
│   │   ├── +layout.svelte          # Program-specific branding
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── materials/
│   │   ├── reflections/
│   │   └── admin/
│   │       ├── cohorts/
│   │       ├── modules/
│   │       ├── reflections/
│   │       └── attendance/
│   └── +page.svelte                # Program selector (if multiple enrollments)
```

### **URL Examples**
```
/courses                                    # Program selector dashboard
/courses/accf/dashboard                     # ACCF student dashboard
/courses/accf/admin/cohorts                 # ACCF admin - cohort management
/courses/cli/dashboard                      # CLI student dashboard
/courses/cli/admin/modules                  # CLI admin - module management
```

---

## 🎨 Branding System

### **Program-Specific Styling**

#### Layout Server (`/courses/[program_slug]/+layout.server.ts`)
```typescript
export const load: LayoutServerLoad = async ({ params, parent }) => {
  const { program_slug } = params;

  // Fetch program branding
  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('slug', program_slug)
    .single();

  if (!program) {
    throw error(404, 'Program not found');
  }

  return {
    program,
    branding: {
      primaryColor: program.primary_color,
      accentColor: program.accent_color,
      lightColor: program.light_color,
      logoUrl: program.logo_url
    },
    features: {
      hubsEnabled: program.hubs_enabled,
      publicReflectionsEnabled: program.public_reflections_enabled,
      attendanceTrackingEnabled: program.attendance_tracking_enabled,
      gradingEnabled: program.grading_enabled
    },
    terminology: {
      session: program.session_term,
      cohort: program.cohort_term,
      reflection: program.reflection_term
    }
  };
};
```

#### Layout Component (`/courses/[program_slug]/+layout.svelte`)
```svelte
<script>
  let { children, data } = $props();
  const { program, branding, features, terminology } = data;

  // Apply program-specific CSS variables
  $effect(() => {
    document.documentElement.style.setProperty('--program-primary', branding.primaryColor);
    document.documentElement.style.setProperty('--program-accent', branding.accentColor);
    document.documentElement.style.setProperty('--program-light', branding.lightColor);
  });
</script>

<div class="min-h-screen" style="background-color: {branding.primaryColor};">
  <ProgramHeader
    logoUrl={branding.logoUrl}
    programName={program.name}
    {features}
    {terminology}
  />
  <main>
    {@render children()}
  </main>
  <ProgramFooter />
</div>
```

---

## 🔐 Permission System Changes

### **Before: Single Role in User Profile**
```sql
user_profiles.role = 'accf_admin'  -- Can't be student elsewhere
```

### **After: Role Per Enrollment**
```sql
-- Sarah's enrollments
cohort_enrollments:
  - cohort_id: feb-2025-foundations (ACCF)
    role: 'admin'
  - cohort_id: march-2025-leadership (CLI)
    role: 'student'
```

### **Permission Checking Logic**

#### Server-Side (`$lib/server/auth.ts`)
```typescript
export async function requireProgramRole(
  event: RequestEvent,
  programSlug: string,
  allowedRoles: string[]
): Promise<{ user: any; enrollment: any }> {
  const session = await event.locals.getSession();
  if (!session) throw redirect(303, `/courses/${programSlug}/login`);

  // Get program
  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('slug', programSlug)
    .single();

  // Get user's enrollments in this program
  const { data: enrollments } = await supabase
    .from('cohort_enrollments')
    .select(`
      *,
      cohorts!inner(program_id)
    `)
    .eq('user_profile_id', session.user.id)
    .eq('cohorts.program_id', program.id);

  // Check if user has any allowed role in this program
  const validEnrollment = enrollments?.find(e => allowedRoles.includes(e.role));

  if (!validEnrollment) {
    throw error(403, 'You do not have permission to access this resource');
  }

  return { user: session.user, enrollment: validEnrollment };
}
```

#### Usage in Page Server Load
```typescript
export const load: PageServerLoad = async (event) => {
  // Require admin role in ACCF program
  const { user, enrollment } = await requireProgramRole(
    event,
    'accf',
    ['admin']
  );

  // User is an admin in this program
  // Continue with admin logic...
};
```

---

## 🧭 Navigation & Program Switching

### **Program Switcher Component**
```svelte
<!-- ProgramSwitcher.svelte -->
<script>
  let { currentProgram, userEnrollments } = $props();

  // Group enrollments by program
  let programGroups = $derived(() => {
    const groups = {};
    userEnrollments.forEach(enrollment => {
      const slug = enrollment.cohorts.programs.slug;
      if (!groups[slug]) {
        groups[slug] = {
          program: enrollment.cohorts.programs,
          role: enrollment.role,
          cohortName: enrollment.cohorts.name
        };
      }
    });
    return groups;
  });
</script>

{#if Object.keys(programGroups).length > 1}
  <div class="program-switcher">
    <button class="current-program">
      {currentProgram.name}
      <ChevronDown size={16} />
    </button>

    <div class="dropdown">
      {#each Object.entries(programGroups) as [slug, data]}
        <a href="/courses/{slug}/dashboard" class="program-option">
          <img src={data.program.logo_url} alt={data.program.name} />
          <div>
            <div class="program-name">{data.program.name}</div>
            <div class="program-meta">{data.cohortName} • {data.role}</div>
          </div>
        </a>
      {/each}
    </div>
  </div>
{/if}
```

### **Header Integration**
```svelte
<!-- ProgramHeader.svelte -->
<header>
  <div class="header-left">
    <img src={logoUrl} alt={programName} />
  </div>

  <nav class="header-center">
    <!-- Program-specific navigation -->
    <a href="/courses/{programSlug}/dashboard">Dashboard</a>
    <a href="/courses/{programSlug}/materials">Materials</a>
    {#if features.publicReflectionsEnabled}
      <a href="/courses/{programSlug}/reflections">Reflections</a>
    {/if}
  </nav>

  <div class="header-right">
    <ProgramSwitcher {currentProgram} {userEnrollments} />
    <UserMenu />
  </div>
</header>
```

---

## 📋 Migration Checklist

### **Phase 1: Database Schema (Safe to wipe test data)**
- [ ] Create `programs` table with ACCF + CLI initial data
- [ ] Add `program_id` to `modules` table
- [ ] Add `program_id` to `cohorts` table (denormalized)
- [ ] Add `program_id` to `hubs` table
- [ ] Create new `cohort_enrollments` table
- [ ] Migrate data from `accf_users` to `cohort_enrollments`
- [ ] Update foreign key references in dependent tables
- [ ] Rename columns (`accf_user_id` → `enrollment_id`)
- [ ] Drop `accf_users` table
- [ ] Simplify `user_profiles.role` enum
- [ ] Create `program_settings` table
- [ ] Update all RLS policies
- [ ] Test database integrity

### **Phase 2: Route Restructure**
- [ ] Create new route structure: `/courses/[program_slug]/`
- [ ] Implement program context loader in `+layout.server.ts`
- [ ] Create program-specific layout with branding
- [ ] Move existing ACCF routes to `/courses/accf/`
- [ ] Update all internal links to use new URL structure
- [ ] Implement program switcher component
- [ ] Create program selector landing page (`/courses/+page.svelte`)
- [ ] Test navigation flow for single and multi-program users

### **Phase 3: Authentication & Permissions**
- [ ] Update `requireAccfUser` → `requireProgramRole`
- [ ] Implement enrollment-based permission checking
- [ ] Update all page server loads to use new auth system
- [ ] Test permission isolation between programs
- [ ] Update signup/login flows to handle program context
- [ ] Implement invitation system per program

### **Phase 4: UI Components**
- [ ] Create reusable `ProgramHeader` component
- [ ] Create reusable `ProgramFooter` component
- [ ] Update `AccfHeader` to use program branding props
- [ ] Create `ProgramSwitcher` dropdown component
- [ ] Update CSS to use program CSS variables
- [ ] Test ACCF branding renders correctly
- [ ] Test CLI branding renders correctly
- [ ] Create program-agnostic shared components

### **Phase 5: Feature Flags**
- [ ] Implement hub visibility based on `hubs_enabled`
- [ ] Implement public reflections based on `public_reflections_enabled`
- [ ] Implement attendance tracking based on `attendance_tracking_enabled`
- [ ] Implement grading based on `grading_enabled`
- [ ] Add conditional rendering in admin interface
- [ ] Test feature combinations

### **Phase 6: Terminology Customization**
- [ ] Replace hardcoded "session" with `terminology.session`
- [ ] Replace hardcoded "cohort" with `terminology.cohort`
- [ ] Replace hardcoded "reflection" with `terminology.reflection`
- [ ] Update all UI text to use program terminology
- [ ] Test terminology rendering in ACCF vs CLI

### **Phase 7: Testing & Validation**
- [ ] Create test data for ACCF program
- [ ] Create test data for CLI program
- [ ] Test user with single enrollment (ACCF only)
- [ ] Test user with multiple enrollments (ACCF + CLI)
- [ ] Test admin in one program, student in another
- [ ] Test program switcher functionality
- [ ] Test deep links to specific programs
- [ ] Test permission boundaries
- [ ] Test branding isolation
- [ ] Test feature flag behavior

### **Phase 8: Documentation**
- [ ] Update `CLAUDE.md` with new architecture
- [ ] Create `PROGRAMS.md` documenting program creation process
- [ ] Update API documentation
- [ ] Create admin guide for multi-program management
- [ ] Document branding customization process
- [ ] Update developer setup instructions

---

## 🚀 Future Enhancements (Not in Initial Implementation)

### **Shared Materials Library**
```sql
CREATE TABLE materials_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'video', 'document', 'link', 'native'
  content TEXT NOT NULL,
  tags TEXT[],
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Link materials to sessions
ALTER TABLE module_materials
  ADD COLUMN library_material_id UUID REFERENCES materials_library(id);
```

**Workflow:**
1. Admin creates material in library
2. Admin adds material to any module session across programs
3. Updating library material updates everywhere it's used

### **Cross-Program Reporting**
- Platform admin dashboard showing enrollment across all programs
- Aggregated reflection marking queue
- Multi-program attendance reports
- User transcript showing all completed programs

### **Program Templates**
- Create "template programs" for quick setup
- Clone program structure (modules, sessions, materials)
- Useful for new cohorts in same program

### **Advanced Role Management**
- Program-level roles (not just cohort-level)
- Role inheritance (program admin → cohort admin)
- Fine-grained permissions (can_mark_reflections, can_create_cohorts, etc.)

---

## ⚠️ Potential Issues & Mitigations

### **Issue 1: URL Bookmarks Break**
**Problem:** Users have bookmarked `/dashboard`, now it's `/courses/accf/dashboard`

**Mitigation:**
```typescript
// src/routes/dashboard/+page.server.ts
export const load: PageServerLoad = async ({ locals }) => {
  // Redirect old URLs to new structure
  const session = await locals.getSession();
  if (!session) throw redirect(303, '/courses/accf/login');

  // Default to ACCF for legacy users
  throw redirect(303, '/courses/accf/dashboard');
};
```

### **Issue 2: Enrollment Role Confusion**
**Problem:** User is admin in ACCF but tries to access CLI admin panel

**Mitigation:**
- Clear error messages: "You are not an administrator in the CLI program"
- Show available roles in program switcher
- Graceful redirect to appropriate view for their role

### **Issue 3: Program Slug Conflicts**
**Problem:** Someone creates program with slug that conflicts with platform routes

**Mitigation:**
```sql
ALTER TABLE programs
  ADD CONSTRAINT programs_slug_check
  CHECK (slug NOT IN ('admin', 'api', 'auth', 'static', 'courses'));
```

### **Issue 4: Cross-Program Data Leakage**
**Problem:** RLS policies don't properly isolate program data

**Mitigation:**
- Comprehensive RLS policy testing
- Program ID checks in all queries
- Enrollment validation in API endpoints
- Regular security audits

---

## 📈 Success Metrics

After migration, validate:

1. **Data Integrity**
   - All existing ACCF enrollments migrated correctly
   - Foreign key relationships intact
   - No orphaned records

2. **Functionality**
   - Users can log in to both programs
   - Program switcher works for multi-enrolled users
   - Admin interface scoped correctly per program
   - Reflections, attendance, materials work per program

3. **Performance**
   - Page load times comparable to pre-migration
   - Database queries optimized with proper indexes
   - No N+1 query issues in program context loading

4. **User Experience**
   - Clear visual distinction between programs
   - Intuitive navigation
   - No confusion about which program user is viewing
   - Smooth program switching experience

---

## 🎓 Example: Creating a New Program (CLI)

```sql
-- 1. Create program
INSERT INTO programs (slug, name, description, primary_color, accent_color, light_color, hubs_enabled, grading_enabled)
VALUES (
  'cli',
  'Catholic Leadership Institute',
  'Developing Catholic leaders for parish and diocesan ministry',
  '#2c3e50',
  '#e67e22',
  '#ecf0f1',
  false,  -- No hubs in CLI
  false   -- No grading in CLI
);

-- 2. Create modules for CLI
INSERT INTO modules (program_id, name, description, order_number)
SELECT
  (SELECT id FROM programs WHERE slug = 'cli'),
  'Leadership Foundations',
  'Core principles of Catholic leadership',
  1;

-- 3. Create sessions for the module
INSERT INTO module_sessions (module_id, session_number, title, description)
SELECT
  (SELECT id FROM modules WHERE program_id = (SELECT id FROM programs WHERE slug = 'cli') AND order_number = 1),
  1,
  'Servant Leadership',
  'Understanding leadership as service in the Catholic tradition';

-- 4. Add materials to session
INSERT INTO module_materials (session_id, type, title, content, display_order)
SELECT
  (SELECT id FROM module_sessions WHERE module_id = (SELECT id FROM modules WHERE program_id = (SELECT id FROM programs WHERE slug = 'cli')) AND session_number = 1),
  'video',
  'Introduction to Servant Leadership',
  'https://youtube.com/watch?v=example',
  1;

-- 5. Create first cohort
INSERT INTO cohorts (program_id, module_id, name, start_date, end_date, status, current_session)
SELECT
  (SELECT id FROM programs WHERE slug = 'cli'),
  (SELECT id FROM modules WHERE program_id = (SELECT id FROM programs WHERE slug = 'cli') AND order_number = 1),
  'Spring 2025 Leadership',
  '2025-03-01',
  '2025-06-01',
  'scheduled',
  1;
```

---

## 📞 Next Steps

1. **Review this plan** and confirm alignment with vision
2. **Prioritize migration phases** - which to tackle first?
3. **Set timeline** - how quickly do you need CLI operational?
4. **Identify CLI requirements** - what's different from ACCF?
5. **Begin Phase 1** - database migration (can wipe test data)

**Questions to resolve before starting:**
- What's the CLI course structure? (modules, sessions, content)
- When do you need CLI live?
- Any other programs on the horizon?
- Should we keep `(accf)` route group during transition or migrate immediately?

---

*This is a living document. Update as implementation progresses.*
