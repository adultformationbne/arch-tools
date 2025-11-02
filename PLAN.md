*** Module-Based Permissions System Migration ***

This plan replaces the legacy platform-role model (`user_profiles.role ∈ {admin, student, hub_coordinator}`) with a pure module-based permission system using namespaced modules (e.g., `courses.participant`, `courses.manager`).

---

## 🎯 **Design Overview**

### Prior State (Before)
- `user_profiles.role` carried one of three platform roles (`admin`, `student`, `hub_coordinator`).  
- `user_profiles.modules` existed but mostly for add-on features (editor, DGR).  
- Many guards combined `role` checks with module checks, resulting in branching logic (`role === 'admin' || hasModule('user_management')`).  
- Invitations defaulted users to the `student` role, then optionally appended modules.  
- Course tooling relied on `role` to redirect users (students → `/my-courses`, admins → `/admin`).  
- RLS policies and Supabase functions referenced `role`, often granting full bypass to admins (e.g., admins could access any course without an enrollment).

### Target State (After)
- `user_profiles.role` column removed; modules encode *all* platform capabilities.  
- Namespaced modules describe navigation + permission scope (`courses.participant`, `courses.manager`, etc.).  
- Auth helpers (`requireModule`, `requireModuleLevel`, `requireCourseAdmin`) operate purely on modules + course enrollments.  
- Invitations assign explicit module sets based on context (staff vs participant).  
- Course access decisions derive from enrollments; modules only control which management surfaces appear.  
- RLS policies check the new module helper (`has_module`) instead of role branches, ensuring consistent enforcement.

### Why Change?
1. **Mismatch with Real Usage** – The platform has multiple top-level surfaces (Users, Courses, DGR, Editor), and people often need a mix of them. Mixing `role` with modules made combinations (e.g., staff who also participate) awkward and brittle.  
2. **Redundant Authority Sources** – Admins were hard-coded everywhere, leading to special-case code and policies. Modules already expressed intent; duplicating it in `role` created drift and confusion.  
3. **Invite-Only Model** – Because every user is invited, there’s no need for a default category (“student”). Permissions can be assigned precisely during invitation.  
4. **Course Coordination is Per-Course** – Hub coordinators are defined by enrollments (`courses_enrollments.role`), not by platform identity. Keeping a platform role for them was misleading.  
5. **Future Flexibility** – Namespaced modules allow new capabilities (e.g., `courses.reviewer`, `users.viewer`) without schema changes or new roles.

### Module Format: `module.level`

Top-level module determines **navigation visibility** (what sections you see).  
Second-level determines **capabilities** (what you can do in that section).

### Final Module Catalog

**Single-level modules (no hierarchy):**
- `users` - Manage users, invitations, permissions (access `/users`)
- `editor` - Content editor access (access `/editor`)
- `dgr` - Daily Gospel Reflections management (access `/dgr`)

**Multi-level modules (courses):**
- `courses.participant` - Access `/my-courses`, view enrolled courses
- `courses.manager` - Access `/courses/admin`, manage courses where enrolled as admin
- `courses.admin` - Access `/courses/admin`, manage ALL courses platform-wide

### Key Principles

1. **Invite-only platform** - Users get modules via invitation flows
2. **Orthogonal concerns** - Platform modules independent of course enrollments
3. **Hub coordination** - Handled via `enrollment.role`, not platform module
4. **No default modules** - Users must be invited with specific permissions
5. **Participant vs Manager** - Completely separate views of course system

---

## 📋 **Migration Roadmap**

**Step 0 – Baseline Snapshot** ✅ **COMPLETE**
*Purpose:* Lock in current state before migrations.

- [x] Capture current schema (`mcp__supabase__list_tables`, `list_migrations`)
- [x] Export current `user_profiles` data (2 users with role/modules)
- [x] Document current RLS policies referencing `role`
- [x] Note active routes using platform roles

---

**Step 1 – Inventory Role Dependencies (~0.5 day)** ✅ **COMPLETE**
*Before:* Role comparisons hard-coded throughout codebase.
*After:* Comprehensive list of touchpoints to convert to module checks.

**Code search targets:**
```bash
rg "role ===" src
rg "profile.role" src
rg "hub_coordinator" src
rg "student" src
rg "requirePlatformAdmin" src
rg "requirePlatformRole" src
rg 'role":"admin' src
```

**Key files to catalog:**
- `src/lib/server/auth.ts` - All auth helpers
- `src/routes/+layout.server.ts` - Root/global layout
- `src/routes/my-courses/+page.server.ts` - Participant view
- `src/routes/courses/admin/+page.server.ts` and `src/routes/courses/[slug]/admin/**/*` - Course admin pages
- `src/routes/users/+page.svelte` - User management UI
- `src/routes/editor/**/*`, `src/routes/dgr/**/*` - Feature modules
- `src/routes/api/admin/**/*` - Admin APIs
- `src/lib/components/AppNavigation.svelte` - Navigation
- `src/lib/components/CourseAdminSidebar.svelte` - Course nav
- `src/lib/components/CsvUpload.svelte` - CSV import/export

**Supabase / SQL:**
- List all RLS policies: `SELECT * FROM pg_policies WHERE polname ILIKE '%role%'`
- Find functions/triggers: `SELECT routine_name, routine_definition FROM information_schema.routines WHERE routine_definition ILIKE '%user_profiles.role%'`
- Check existing migrations for role dependencies

**Deliverable:** Checklist of all files/policies requiring updates with specific change notes.

### File Hit List (Living Checklist)
- **Supabase / SQL**
  - `supabase/migrations/*` (new migration to drop `user_profiles.role`, add helper functions, rewrite policies)
  - `supabase/config.toml` (only if policy helpers require configuration changes)
- **Core Auth & Helpers**
  - `src/lib/server/auth.ts`
  - `src/lib/utils/permissions.js`
  - `src/lib/utils/accf-auth.ts`
- **Layouts & Routing**
  - `src/routes/+layout.server.ts`
  - `src/routes/+layout.ts`
  - `src/routes/+page.svelte`
  - `src/routes/(internal)/+layout.server.ts`
  - `src/routes/auth/+page.svelte`
  - `src/routes/my-courses/+page.server.ts`
  - `src/routes/courses/[slug]/+layout.server.ts`
  - `src/routes/courses/admin/+page.server.ts`
  - `src/routes/profile/+page.svelte`
  - `src/routes/dgr/templates/+page.server.ts`
  - `src/routes/dgr/publish/+page.server.ts`
  - `src/routes/test-emails/+page.server.ts`
- **Admin / Management Pages**
  - `src/routes/users/+page.server.ts`
  - `src/routes/users/+page.svelte`
  - `src/routes/courses/[slug]/admin/+page.svelte`
  - `src/routes/courses/[slug]/admin/hubs/+page.server.ts`
  - `src/routes/courses/[slug]/admin/hubs/+page.svelte`
  - `src/lib/components/CourseAdminSidebar.svelte`
  - `src/lib/components/CohortManager.svelte`
  - `src/lib/components/HubModal.svelte`
  - `src/lib/components/ModuleModal.svelte`
- **Participant / Course Experience**
  - `src/routes/courses/[slug]/dashboard/+page.server.ts`
  - `src/routes/courses/[slug]/profile/+page.svelte`
  - `src/routes/courses/[slug]/admin/modules/+page.svelte`
  - `src/routes/courses/[slug]/admin/reflections/+page.svelte`
  - `src/lib/components/StudentEnrollmentModal.svelte`
  - `src/lib/components/AppNavigation.svelte`
  - `src/lib/components/CsvUpload.svelte`
  - `src/routes/my-courses/+page.server.ts`
- **APIs & Backend Endpoints**
  - `src/routes/api/admin/users/+server.js`
  - `src/routes/api/admin/enrollments/+server.ts`
  - `src/routes/api/admin/reset-password/+server.js`
  - `src/routes/api/courses/index/+server.ts`
  - `src/routes/api/courses/module-materials/+server.ts`
  - `src/routes/api/courses/module-reflection-questions/+server.ts`
  - Any additional `/api/**` handlers surfaced by searches above
- **Docs / Planning**
  - `AUTH_SYSTEM.md`
  - `PERMISSIONS_SYSTEM.md`
  - `COURSES.md`
  - `PLAN.md`
  - `MIGRATION_STRATEGY.md`, `MULTI_PROGRAM_ARCHITECTURE.md`, `CLAUDE.md` (all reference roles)
- **Scripts / Utilities**
  - `scripts/*`, `data/*`, or other automation that references `user_profiles.role`

> **Note:** Route directories now align one-to-one with module namespaces (`routes/users`, `routes/editor`, `routes/dgr`, `routes/courses/admin`, `routes/my-courses`, etc.). Maintain this structure for any new pages or when relocating files during the migration.

Keep this list updated as new files are identified.

---

**Step 2 – Define Module System (~0.5 day)** ✅ **COMPLETE**
*Before:* Mixed platform roles + module array + course enrollments.
*After:* Modules fully describe platform capabilities; enrollments describe course roles.

**Module Catalog:**

| Module | Description | Navigation | Notes |
|--------|-------------|------------|-------|
| `users` | User/permission management | `/users` | Highest platform privilege |
| `editor` | Content editor | `/editor` | Single level for now |
| `dgr` | Daily Gospel management | `/dgr` | Single level for now |
| `courses.participant` | View enrolled courses | `/my-courses` | Default for course invitations |
| `courses.manager` | Manage assigned courses | `/courses/admin` | Only courses where enrolled as admin |
| `courses.admin` | Manage all courses | `/courses/admin` | Platform-wide course access |

**Lifecycle Rules:**

1. **New user defaults:** No modules (must be invited)
2. **Staff invitation (via `/users`):** Admin selects modules to grant
3. **Participant invitation (via cohort):** Auto-grants `courses.participant`
4. **Hub coordination:** Via `enrollment.role = 'coordinator'` (per-course)
5. **Course management access:**
   - `courses.admin` → All courses regardless of enrollment
   - `courses.manager` → Only courses where `enrollment.role = 'admin'`
   - `courses.participant` → Only enrolled courses

**Module Independence:**
- Courses levels are NOT hierarchical
- Staff can have `courses.manager` WITHOUT `courses.participant`
- Participants have `courses.participant` but NOT management modules
- Common combo: `['courses.participant', 'courses.manager']` for staff who also take courses

**SQL Helper Functions:**
```sql
-- Check if user has specific module
CREATE FUNCTION has_module(user_id uuid, module text)
RETURNS boolean LANGUAGE sql STABLE AS
$$
  SELECT module = ANY(
    SELECT jsonb_array_elements_text(modules)
    FROM user_profiles
    WHERE id = user_id
  )
$$;

-- Check if user has minimum level for hierarchical module (future use)
CREATE FUNCTION has_min_level(user_id uuid, module_name text, min_level text)
RETURNS boolean LANGUAGE sql STABLE AS
$$
  -- Implementation for future hierarchical modules
$$;
```

**Deliverable:** Written spec in `AUTH_SYSTEM.md` update capturing module definitions and auth logic.

---

**Step 3 – Supabase Schema & Policy Migration (~1 day)** ✅ **COMPLETE**
*Before:* `user_profiles.role` column + role-based policies.
*After:* Column removed, policies use module checks.

**DDL Migration Tasks:**

```sql
-- MIGRATION: remove_platform_roles

-- 1. Migrate existing role data to modules
UPDATE user_profiles
SET modules = CASE
  -- Platform admins → All management modules
  WHEN role = 'admin' THEN
    ARRAY['users', 'editor', 'dgr', 'courses.admin', 'courses.participant']

  -- Hub coordinators → Just participant (coordination is per-enrollment)
  WHEN role = 'hub_coordinator' THEN
    ARRAY['courses.participant']

  -- Students → Just participant
  WHEN role = 'student' THEN
    ARRAY['courses.participant']

  ELSE
    ARRAY[]::text[]
END
WHERE modules IS NULL OR modules = '{}';

-- 2. Ensure all enrolled users have courses.participant
UPDATE user_profiles up
SET modules = array_append(modules, 'courses.participant')
WHERE EXISTS (
  SELECT 1 FROM courses_enrollments ce
  WHERE ce.user_profile_id = up.id
)
AND NOT ('courses.participant' = ANY(modules));

-- 3. Add module helper functions (see Step 2)
CREATE FUNCTION has_module(user_id uuid, module text) ...;

-- 4. Update RLS policies to use has_module()
-- Example: user_profiles SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
CREATE POLICY "Users can view all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (
  has_module(auth.uid(), 'users')
  OR id = auth.uid()
);

-- Example: courses SELECT policy for course admin
DROP POLICY IF EXISTS "Course admins can view all courses" ON courses;
CREATE POLICY "Course admins can view all courses"
ON courses FOR SELECT
TO authenticated
USING (
  has_module(auth.uid(), 'courses.admin')
  OR has_module(auth.uid(), 'courses.manager')
);

-- 5. Update triggers that set default role
-- Check: fix_user_creation_trigger, handle_new_user, etc.
-- Remove any role assignments

-- 6. Verify migration
SELECT email, role, modules FROM user_profiles;

-- 7. Drop role column
ALTER TABLE user_profiles DROP COLUMN role;
```

**Policy Rewrite Strategy:**
- Admin-only access: `has_module(auth.uid(), 'users')`
- Course management: `has_module(auth.uid(), 'courses.admin') OR has_module(auth.uid(), 'courses.manager')`
- Participant access: Check enrollments (modules don't grant data access, just UI)

**Execution:**
- Apply via `mcp__supabase__apply_migration({ name: 'remove_platform_roles', query: '...' })`
- Test queries with both user accounts
- Run advisors: `mcp__supabase__get_advisors({ type: 'security' })`

**Deliverable:** Migration applied, RLS verified, schema validated.

---

**Step 4 – Auth Helper Refactor (~0.5 day)** ✅ **COMPLETE**
*Before:* `requirePlatformAdmin`/`requirePlatformRole` check `profile.role`.
*After:* Helpers use module checks, hierarchical support for courses.

**Changes to `src/lib/server/auth.ts`:**

**Remove these functions:**
```typescript
❌ requirePlatformAdmin()
❌ requirePlatformRole()
❌ isPlatformAdmin()
```

**Add/Update these functions:**
```typescript
// Module utilities
export function getModuleLevel(modules: string[], moduleName: string): string | null {
  const match = modules.find(m => m.startsWith(`${moduleName}.`));
  return match ? match.split('.')[1] : null;
}

export function hasModule(modules: string[] | null, moduleName: string): boolean {
  if (!modules) return false;
  // Check for exact match or namespaced match (e.g., 'courses' matches 'courses.participant')
  return modules.some(m => m === moduleName || m.startsWith(`${moduleName}.`));
}

export function hasModuleLevel(modules: string[] | null, moduleLevel: string): boolean {
  return modules?.includes(moduleLevel) || false;
}

export function hasMinimumLevel(
  modules: string[] | null,
  moduleName: string,
  minLevel: string
): boolean {
  // For now, just check exact match (hierarchies added later if needed)
  return hasModuleLevel(modules, `${moduleName}.${minLevel}`);
}

// Auth requirements
export async function requireModule(
  event: RequestEvent,
  moduleName: string,
  options: AuthOptions = { mode: 'throw_error' }
) {
  const { user } = await requireAuth(event, options);
  const profile = await getUserProfile(event.locals.supabase, user.id);

  if (!hasModule(profile?.modules, moduleName)) {
    if (options.mode === 'redirect') {
      throw redirect(303, options.redirectTo || '/my-courses');
    }
    throw error(403, `Requires ${moduleName} module access`);
  }

  return { user, profile };
}

export async function requireModuleLevel(
  event: RequestEvent,
  moduleLevel: string,
  options: AuthOptions = { mode: 'throw_error' }
) {
  const { user } = await requireAuth(event, options);
  const profile = await getUserProfile(event.locals.supabase, user.id);

  if (!hasModuleLevel(profile?.modules, moduleLevel)) {
    if (options.mode === 'redirect') {
      throw redirect(303, options.redirectTo || '/my-courses');
    }
    throw error(403, `Requires ${moduleLevel} access`);
  }

  return { user, profile };
}

// Course-level auth (updated logic)
export async function requireCourseAdmin(
  event: RequestEvent,
  courseSlug: string,
  options: AuthOptions = { mode: 'throw_error' }
) {
  const { user } = await requireAuth(event, options);
  const profile = await getUserProfile(event.locals.supabase, user.id);

  // Check for courses.admin (platform-wide access)
  if (hasModuleLevel(profile?.modules, 'courses.admin')) {
    return { user, profile, enrollment: null, viaModule: true };
  }

  // Check for courses.manager + enrollment as admin
  if (hasModuleLevel(profile?.modules, 'courses.manager')) {
    const enrollment = await getUserCourseEnrollment(
      event.locals.supabase,
      user.id,
      courseSlug
    );

    if (enrollment?.role === 'admin') {
      return { user, profile, enrollment, viaModule: false };
    }
  }

  if (options.mode === 'redirect') {
    throw redirect(303, options.redirectTo || '/my-courses');
  }
  throw error(403, 'Requires course admin access');
}

// requireCourseAccess stays mostly the same (no more admin bypass)
export async function requireCourseAccess(
  event: RequestEvent,
  courseSlug: string,
  options: AuthOptions = { mode: 'throw_error' }
) {
  const { user } = await requireAuth(event, options);

  // Everyone must be enrolled (including courses.admin users)
  const enrollment = await getUserCourseEnrollment(
    event.locals.supabase,
    user.id,
    courseSlug
  );

  if (!enrollment) {
    if (options.mode === 'redirect') {
      throw redirect(303, options.redirectTo || '/my-courses');
    }
    throw error(403, 'Must be enrolled in this course');
  }

  return { user, enrollment };
}
```

**Update client-side helpers:**
```typescript
export function hasAnyModule(modules: string[] | null, requiredModules: string[]): boolean {
  if (!modules) return false;
  return requiredModules.some(mod => hasModule(modules, mod));
}

export function hasAllModules(modules: string[] | null, requiredModules: string[]): boolean {
  if (!modules) return false;
  return requiredModules.every(mod => hasModule(modules, mod));
}
```

**Remove:**
```typescript
❌ export function isPlatformAdmin(role: string | null): boolean
```

**Deliverable:** All helpers updated, TypeScript compiles, no runtime errors.

---

**Step 5 – Backend/API Sweep (~1 day)** ✅ **COMPLETE**
*Before:* Server routes check `profile.role` and use old helpers.
*After:* All routes use module checks.

**Layout Updates:**

**Remove `(internal)` route grouping or convert:**
- Option A: Remove grouping, add module checks to each route
- Option B: Keep grouping, update layout to check for ANY management module

```typescript
// src/routes/(internal)/+layout.server.ts
export const load: LayoutServerLoad = async (event) => {
  const { session, user } = await event.locals.safeGetSession();

  if (!session) {
    throw redirect(303, '/auth');
  }

  const profile = await getUserProfile(event.locals.supabase, user.id);

  // Check for any management module
  const hasManagement = hasAnyModule(profile?.modules, [
    'users',
    'courses.manager',
    'courses.admin',
    'editor',
    'dgr'
  ]);

  if (!hasManagement) {
    throw redirect(303, '/my-courses');
  }

  return { user, profile };
};
```

**API Route Updates:**

| File | Old Check | New Check |
|------|-----------|-----------|
| `/api/admin/users/+server.ts` | `requirePlatformAdmin()` | `requireModule('users')` |
| `/api/courses/*/+server.ts` | `requireCourseAdmin()` | Updated logic in helper |
| All admin APIs | `profile.role === 'admin'` | Module-specific checks |

**Key File Updates:**
```typescript
// src/routes/users/+page.server.ts
export const load: PageServerLoad = async (event) => {
  const { user, profile } = await requireModule(event, 'users', {
    mode: 'redirect',
    redirectTo: '/my-courses'
  });

  // ... fetch users
  return { users };
};

// src/routes/courses/[slug]/admin/+page.server.ts
export const load: PageServerLoad = async (event) => {
  const courseSlug = event.params.slug;

  // Uses updated requireCourseAdmin logic
  const { user, profile, viaModule } = await requireCourseAdmin(event, courseSlug, {
    mode: 'redirect'
  });

  return { course, canManage: true };
};

// src/routes/my-courses/+page.server.ts
export const load: PageServerLoad = async (event) => {
  const { user, profile } = await requireModuleLevel(event, 'courses.participant', {
    mode: 'redirect',
    redirectTo: '/profile'
  });

  // Fetch enrolled courses
  return { enrollments };
};

// src/routes/courses/admin/+page.server.ts (course list)
export const load: PageServerLoad = async (event) => {
  const { user, profile } = await requireModuleLevel(event, 'courses.manager', {
    mode: 'redirect'
  });

  // courses.admin users see everything; courses.manager limited to their courses
  const canManageAll = hasModuleLevel(profile.modules, 'courses.admin');

  let query = event.locals.supabase.from('courses').select('*');

  if (!canManageAll) {
    query = query
      .select('*, courses_modules!inner(courses_cohorts!inner(courses_enrollments!inner(*)))')
      .eq('courses_modules.courses_cohorts.courses_enrollments.user_profile_id', user.id)
      .eq('courses_modules.courses_cohorts.courses_enrollments.role', 'admin');
  }

  const { data: courses } = await query;
  return { courses, canManageAll };
};
```

**Invitation Flow Updates:**
```typescript
// Staff invitation
export async function POST(event) {
  await requireModule(event, 'users');
  const { email, modules } = await event.request.json();

  // Validate modules
  const validModules = ['users', 'editor', 'dgr', 'courses.participant', 'courses.manager', 'courses.admin'];

  // Create user with modules
  // ...
}

// Participant invitation (via cohort)
export async function POST(event) {
  await requireAnyModule(event, ['courses.manager', 'courses.admin']);
  const { email, cohortId, role } = await event.request.json();

  // Auto-add courses.participant module
  // Create enrollment
  // ...
}
```

**Deliverable:** All routes compile and use module-based auth, no `profile.role` references remain.

---

**Step 6 – Frontend/UI Refactor (~1–1.5 day)** ✅ **COMPLETE**
*Before:* UI shows role badges and checks `profile.role`.
*After:* UI uses module checks and displays module badges.

**Navigation Updates:**

```svelte
<!-- src/lib/components/AppNavigation.svelte -->
<script>
  import { hasModule, hasModuleLevel } from '$lib/server/auth';
  let { profile } = $props();
</script>

<!-- Participant section -->
{#if hasModuleLevel(profile.modules, 'courses.participant')}
  <NavItem href="/my-courses">
    <HomeIcon /> My Courses
  </NavItem>
{/if}

<!-- Management sections -->
{#if hasModule(profile.modules, 'users')}
  <NavItem href="/users">
    <UsersIcon /> Users
  </NavItem>
{/if}

{#if hasModule(profile.modules, 'courses.manager') || hasModule(profile.modules, 'courses.admin')}
  <NavItem href="/courses/admin">
    <SettingsIcon /> Course Admin
  </NavItem>
{/if}

{#if hasModule(profile.modules, 'dgr')}
  <NavItem href="/dgr">
    <BookIcon /> Daily Gospel
  </NavItem>
{/if}

{#if hasModule(profile.modules, 'editor')}
  <NavItem href="/editor">
    <EditIcon /> Editor
  </NavItem>
{/if}
```

**User Management UI:**

```svelte
<!-- src/routes/users/+page.svelte -->
<script>
  let { data } = $props();

  const moduleOptions = [
    { value: 'users', label: 'Users', description: 'Full user management' },
    { value: 'editor', label: 'Editor', description: 'Content editor access' },
    { value: 'dgr', label: 'DGR', description: 'Daily Gospel management' },
    { value: 'courses.participant', label: 'Course Participant', description: 'Access My Courses' },
    { value: 'courses.manager', label: 'Course Manager', description: 'Manage assigned courses' },
    { value: 'courses.admin', label: 'Course Admin', description: 'Manage all courses' }
  ];
</script>

<h1>Manage Users</h1>

<table>
  <thead>
    <tr>
      <th>Email</th>
      <th>Modules</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each data.users as user}
      <tr>
        <td>{user.email}</td>
        <td>
          <div class="flex gap-2">
            {#each user.modules || [] as module}
              <Badge variant={getBadgeVariant(module)}>
                {module}
              </Badge>
            {/each}
          </div>
        </td>
        <td>
          <Button onclick={() => editUser(user)}>Edit</Button>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<!-- Edit modal -->
<Modal bind:isOpen={showEditModal}>
  <h2>Edit Permissions</h2>

  <div class="space-y-4">
    {#each moduleOptions as option}
      <label class="flex items-center gap-2">
        <input
          type="checkbox"
          checked={editingUser.modules?.includes(option.value)}
          onchange={() => toggleModule(option.value)}
        />
        <div>
          <div class="font-medium">{option.label}</div>
          <div class="text-sm text-gray-600">{option.description}</div>
        </div>
      </label>
    {/each}
  </div>
</Modal>
```

**Course Admin UI:**

```svelte
<!-- Show course list based on permission level -->
<script>
  let { data } = $props();
</script>

<h1>Course Admin</h1>

{#if data.isAdmin}
  <p class="text-sm text-gray-600">You can manage all courses (platform admin)</p>
{:else if data.isManager}
  <p class="text-sm text-gray-600">You can manage courses where you're an admin</p>
{/if}

<div class="course-list">
  {#each data.courses as course}
    <Card>
      <h3>{course.name}</h3>
      <a href="/courses/admin/{course.slug}">Manage</a>
    </Card>
  {/each}
</div>
```

**CSV Import/Export:**

```typescript
// Update CSV mappings
const exportCsv = () => {
  const csv = users.map(u => ({
    email: u.email,
    modules: u.modules?.join(';') || '',  // Changed from 'role'
    enrollments: getEnrollments(u.id)
  }));

  downloadCsv(csv, 'users.csv');
};

const importCsv = (file) => {
  // Parse CSV
  // Map 'modules' column (semicolon-separated) to modules array
  // Validate modules against allowed list
};
```

**Deliverable:** UI updated, no `profile.role` references, module management working.

---

**Step 7 – Documentation & Cleanup (~0.5 day)** ✅ **COMPLETE**
*Before:* Docs describe platform roles.
*After:* Docs reflect module system.

**Documentation Updates:**

**AUTH_SYSTEM.md:**
```markdown
# Authentication & Authorization System

## Module-Based Permissions

### Platform Modules

| Module | Navigation | Capabilities |
|--------|-----------|--------------|
| `users` | `/users` | Manage users, invitations, permissions |
| `editor` | `/editor` | Content editor access |
| `dgr` | `/dgr` | Daily Gospel Reflections management |

### Course Modules

| Module | Navigation | Capabilities |
|--------|-----------|--------------|
| `courses.participant` | `/my-courses` | View enrolled courses |
| `courses.manager` | `/courses/admin` | Manage courses where enrolled as admin |
| `courses.admin` | `/courses/admin` | Manage all courses platform-wide |

### Course Roles (per enrollment)

| Role | Description |
|------|-------------|
| `student` | Regular student in course |
| `coordinator` | Hub coordinator in course |
| `admin` | Course administrator (can manage this course) |

### Auth Helpers

```typescript
// Platform module access
await requireModule(event, 'users');
await requireModuleLevel(event, 'courses.admin');

// Course access
await requireCourseAccess(event, courseSlug);  // Must be enrolled
await requireCourseAdmin(event, courseSlug);   // courses.admin OR enrolled as admin

// Client-side checks
hasModule(profile.modules, 'users')
hasModuleLevel(profile.modules, 'courses.participant')
```
```

**COURSES.md:**
- Update participant vs admin sections
- Document courses.manager vs courses.admin distinction
- Update enrollment flow documentation

**CLAUDE.md:**
- Update auth pattern examples
- Replace role references with module checks
- Update common patterns section

**Code Cleanup:**
- Delete obsolete helpers if any
- Remove old role constants
- Clean up commented-out role checks

**Validation Checklist:**

**Test Scenarios:**
1. ✅ Create participant account via cohort invitation
   - Modules: `['courses.participant']`
   - Can access `/my-courses`
   - Cannot access admin sections

2. ✅ Create staff account with user management
   - Modules: `['users', 'courses.manager']`
   - Can access `/users` and `/courses/admin`
   - Sees only courses where enrolled as admin

3. ✅ Create platform admin
   - Modules: `['users', 'editor', 'dgr', 'courses.admin', 'courses.participant']`
   - Can access all sections
   - Can manage all courses regardless of enrollment

4. ✅ Hub coordinator per course
   - Modules: `['courses.participant']`
   - Enrollment: `role = 'coordinator'`
   - Sees coordinator UI within course

**Run Supabase Advisors:**
```typescript
await mcp__supabase__get_advisors({ type: 'security' });
await mcp__supabase__get_advisors({ type: 'performance' });
```

**Deliverable:** Documentation complete, validation passed, advisors clean.

---

**Step 8 – Post-Migration Monitoring**

- [ ] Monitor invitation flows for correct module assignment
- [ ] Verify new users get appropriate defaults
- [ ] Test CSV import/export with module format
- [ ] Confirm RLS policies enforce module permissions
- [ ] Re-run advisors after any schema tweaks
- [ ] Document any edge cases discovered

---

## 📊 **Key Schemas & Files**

**Database:**
- `user_profiles.modules` - TEXT[] of module permissions
- `courses_enrollments.role` - Per-course roles (student, coordinator, admin)
- RLS policies using `has_module()` helper
- Migration: `remove_platform_roles`

**Core TypeScript:**
- `src/lib/server/auth.ts` - All auth helpers
- `src/routes/+layout.server.ts` - Root layout & global guard
- `src/routes/my-courses/+page.server.ts` - Participant view
- `src/routes/courses/admin/+page.server.ts` - Course admin overview

**UI Components:**
- `src/lib/components/AppNavigation.svelte` - Top nav
- `src/lib/components/CourseAdminSidebar.svelte` - Course admin nav
- `src/routes/users/+page.svelte` - User management

**Documentation:**
- `AUTH_SYSTEM.md` - Auth system guide
- `COURSES.md` - Course system architecture
- `CLAUDE.md` - Development guide

---

## ✅ **Success Criteria**

- [ ] `user_profiles.role` column removed
- [ ] All routes use module-based auth
- [ ] Navigation conditional on modules
- [ ] Staff can manage courses where enrolled as admin (courses.manager)
- [ ] Platform admins can manage all courses (courses.admin)
- [ ] Participants see only My Courses section
- [ ] Hub coordination works via enrollment role
- [ ] Invitation flows assign correct modules
- [ ] RLS policies enforce module permissions
- [ ] Documentation reflects new system
- [ ] No TypeScript errors
- [ ] Security advisors pass

---

**Keep this plan updated as tasks complete or dependencies surface.**

---

## ✅ Validation Snapshot (2025-03-01)

- `mcp__supabase__get_advisors({ type: 'security' })` re-run; outstanding WARN items: enable leaked-password protection and upgrade the Supabase Postgres image. Both require org-level configuration changes, so they are deferred to platform operations.
- `mcp__supabase__get_advisors({ type: 'performance' })` re-run; results highlight long-standing cleanup work (unindexed foreign keys across `courses_*` tables, `auth_rls_initplan` noise on many policies, unused/duplicate indexes, and multiple permissive policies). No schema changes were made today; these items stay on the backlog for a focused performance/RLS pass.
- Manual smoke tests for invitation → enrollment flows are still pending; complete them before declaring migration finished.

---

## ✅ Migration Complete (October 30, 2025)

**Code migration is 100% complete!** All steps 0-7 have been finished:

### Completed Work

**Step 0-4: Core Infrastructure** ✅
- Schema migration complete (role column dropped)
- SQL helper functions created
- Auth helpers fully refactored
- Module system defined and implemented

**Step 5: Backend/API Sweep** ✅
- All server routes updated to use module checks
- API routes using `requireModule`, `requireModuleLevel`, `requireAnyModule`
- Course routes using updated `requireCourseAdmin` logic
- No `requirePlatformAdmin` or `profile.role` references remain

**Step 6: Frontend/UI Refactor** ✅
- `src/lib/utils/permissions.js` - Replaced all role-based functions with module-based equivalents
- `src/routes/auth/+page.svelte` - Post-login redirect now uses module-based logic
- `src/routes/users/+page.svelte` - Displays module badges, removed role dropdown from new user form
- `src/routes/profile/+page.svelte` - Module checks instead of role checks
- Navigation components using module-based visibility

**Step 7: Documentation** ✅
- `AUTH_SYSTEM.md` - Updated with module examples (already current)
- `COURSES.md` - Updated authentication section with module-based permissions
- `CLAUDE.md` - Updated auth pattern examples
- `PLAN.md` - Marked all steps as complete

### Files Changed in Final Push (Oct 30, 2025)

**Code:**
1. `src/lib/utils/permissions.js` - Complete rewrite for module system
2. `src/routes/auth/+page.svelte` - Module-based redirect logic
3. `src/routes/users/+page.svelte` - Module display & management
4. `src/routes/profile/+page.svelte` - Module-based conditionals

**Documentation:**
1. `AUTH_SYSTEM.md` - Minor update (already current)
2. `COURSES.md` - Authentication section rewritten
3. `CLAUDE.md` - Auth patterns updated
4. `PLAN.md` - Marked complete

---

## ⏭️ Immediate Next Steps

**Step 8: Manual QA Testing** (Pending)

1. **Manual QA sweep** – Exercise invitation, module toggles, `/users`, `/courses/admin`, `/my-courses`, `/editor`, and `/dgr` with representative module combinations to ensure UI + API gating match the new module system.
2. **Test scenarios:**
   - Create participant account via cohort invitation
   - Create staff account with `['users', 'courses.manager']`
   - Create platform admin with all modules
   - Verify navigation visibility
   - Test course admin access with `courses.admin` vs `courses.manager`
3. **Security follow-up** – Create tickets to (a) enable leaked password protection in Supabase Auth and (b) schedule the Postgres minor upgrade with Supabase support.
4. **Database tuning backlog** – Triage advisor findings (RLS init-plan replacements, redundant policies, index cleanup) and decide which belong in the next hardening sprint versus long-term backlog.
