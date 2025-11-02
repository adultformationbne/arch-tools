# Authentication & Authorization System

## Overview

The arch-tools platform uses a **unified module-based authentication system** (`$lib/server/auth.ts`) that handles all authentication and authorization using namespaced module permissions.

## System Architecture

### Single Unified Auth Library

**Location:** `$lib/server/auth.ts`

**Features:**
- Module-based authorization (namespaced permissions)
- Course-level authorization (per-course roles via enrollments)
- Flexible response modes (errors vs redirects)
- Clean, consistent API

---

## Response Modes

The auth system supports two response modes via the `options` parameter:

### 1. `throw_error` (Default)
Returns HTTP 401/403 errors - perfect for API routes:
```typescript
// Will throw error(401) or error(403)
await requireModule(event, 'users');
```

### 2. `redirect`
Returns 303 redirects - perfect for page routes:
```typescript
// Will throw redirect(303, '/my-courses')
await requireModule(event, 'users', { mode: 'redirect', redirectTo: '/my-courses' });
```

---

## Module-Based Permissions

### Module Format: `module.level`

**Top-level module** determines **navigation visibility** (what sections you see).
**Second-level** determines **capabilities** (what you can do in that section).

### Platform Modules

| Module | Description | Navigation | Notes |
|--------|-------------|------------|-------|
| `users` | Manage users, invitations, permissions | `/users` | Highest platform privilege |
| `editor` | Content editor access | `/editor` | Single level for now |
| `dgr` | Daily Gospel Reflections management | `/dgr` | Single level for now |

### Course Modules

| Module | Description | Navigation | Capabilities |
|--------|-------------|------------|--------------|
| `courses.participant` | Access enrolled courses | `/my-courses` | View enrolled courses, submit reflections |
| `courses.manager` | Manage assigned courses | `/admin/courses` | Manage courses where enrolled as admin |
| `courses.admin` | Manage all courses | `/admin/courses` | Platform-wide course access regardless of enrollment |

**Key Principles:**
- **courses.participant** and **courses.manager** are independent (not hierarchical)
- Staff can have `courses.manager` WITHOUT `courses.participant`
- Some staff may have BOTH to participate AND manage
- `courses.admin` bypasses enrollment checks for management (but not for course content access)

### Course Roles (per enrollment)

Stored in `courses_enrollments.role` (per user per course):

| Role | Description |
|------|-------------|
| `student` | Regular enrolled student |
| `coordinator` | Hub coordinator for this course |
| `admin` | Course administrator (can manage this specific course) |

**Important:** Hub coordination is per-course via `enrollment.role`, NOT a platform module.

---

## Platform-Level Authorization

### Functions

#### `requireAuth(event, options?)`
Requires user to be authenticated.
```typescript
const { session, user } = await requireAuth(event);
// With redirect:
const { session, user } = await requireAuth(event, { mode: 'redirect', redirectTo: '/auth' });
```

#### `requireModule(event, moduleName, options?)`
Requires user to have specific module (any level for namespaced modules).
```typescript
const { user, profile } = await requireModule(event, 'users');
const { user, profile } = await requireModule(event, 'courses'); // matches courses.*
const { user, profile } = await requireModule(event, 'dgr', { mode: 'redirect' });
```

#### `requireModuleLevel(event, moduleLevel, options?)`
Requires user to have specific module.level.
```typescript
const { user, profile } = await requireModuleLevel(event, 'courses.participant');
const { user, profile } = await requireModuleLevel(event, 'courses.admin');
```

---

## Course-Level Authorization

Course-level permissions are based on enrollments in `courses_enrollments`. Module access determines which management UIs are visible, but course content access requires enrollment.

### Functions

#### `requireCourseAccess(event, courseSlug, options?)`
Requires user to be enrolled in the course (any role: admin, student, or coordinator).
```typescript
const courseSlug = event.params.slug;
const { user, enrollment } = await requireCourseAccess(event, courseSlug);
// Everyone must be enrolled - including courses.admin users
```

#### `requireCourseAdmin(event, courseSlug, options?)`
Requires user to have course admin access via:
- `courses.admin` module (platform-wide access), OR
- `courses.manager` module + enrolled with `role='admin'` in this course

```typescript
const { user, profile, enrollment, viaModule } = await requireCourseAdmin(event, courseSlug);
// viaModule: true if accessed via courses.admin, false if via enrollment
```

#### `requireCourseRole(event, courseSlug, allowedRoles, options?)`
Requires user to have one of the specified roles in the course.
```typescript
// Allow both admin and coordinator
const { user, enrollment } = await requireCourseRole(event, courseSlug, ['admin', 'coordinator']);
```

---

## Module Lifecycle

### Default User
- New users have NO modules (must be invited)
- No access to any section until modules granted

### Staff Invitation (via `/users`)
- Admin selects which modules to grant
- Example: `['users', 'courses.manager', 'dgr']`

### Participant Invitation (via course cohort)
- Auto-grants `['courses.participant']`
- Creates enrollment with role (student/coordinator/admin)

### Module Independence
- Modules can be combined freely
- Common combos:
  - `['courses.participant']` - Participant only
  - `['users', 'courses.manager']` - Staff (no participation)
  - `['users', 'courses.participant', 'courses.manager']` - Staff who also participates

---

## Usage Examples

### Example 1: User Management Page (Staff Only)
```typescript
// src/routes/(internal)/admin/users/+page.server.ts
import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  // Redirects to /my-courses if user doesn't have access
  const { user, profile } = await requireModule(event, 'users', {
    mode: 'redirect',
    redirectTo: '/my-courses'
  });

  // ... fetch users
  return { users };
};
```

### Example 2: API Route - Throw Errors
```typescript
// src/routes/api/admin/users/+server.ts
import { json } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth';

export async function POST(event) {
  // Throws error(403) if user doesn't have access
  const { user } = await requireModule(event, 'users');

  // ... create user
  return json({ success: true });
}
```

### Example 3: My Courses (Participant View)
```typescript
// src/routes/my-courses/+page.server.ts
import type { PageServerLoad } from './$types';
import { requireModuleLevel } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  // Requires specific courses.participant module
  const { user, profile } = await requireModuleLevel(event, 'courses.participant', {
    mode: 'redirect',
    redirectTo: '/profile'
  });

  // Fetch enrolled courses
  const { data: enrollments } = await event.locals.supabase
    .from('courses_enrollments')
    .select('*, courses(*)')
    .eq('user_profile_id', user.id);

  return { enrollments };
};
```

### Example 4: Course Admin Page
```typescript
// src/routes/courses/[slug]/admin/+page.server.ts
import type { PageServerLoad } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  const courseSlug = event.params.slug;

  // courses.admin OR (courses.manager + enrolled as admin)
  const { user, profile, viaModule } = await requireCourseAdmin(event, courseSlug, {
    mode: 'redirect'
  });

  // ... fetch course data
  return { courseData, canManageAll: viaModule };
};
```

### Example 5: Course List (For Managers)
```typescript
// src/routes/admin/courses/+page.server.ts
import type { PageServerLoad } from './$types';
import { requireModule, hasModuleLevel } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  // Must have any courses management module
  const { user, profile } = await requireModule(event, 'courses', {
    mode: 'redirect'
  });

  const isAdmin = hasModuleLevel(profile.modules, 'courses.admin');
  const isManager = hasModuleLevel(profile.modules, 'courses.manager');

  let query = event.locals.supabase.from('courses').select('*');

  if (isAdmin) {
    // Show all courses
  } else if (isManager) {
    // Filter to only courses where enrolled as admin
    query = query
      .select('*, courses_modules!inner(courses_cohorts!inner(courses_enrollments!inner(*)))')
      .eq('courses_modules.courses_cohorts.courses_enrollments.user_profile_id', user.id)
      .eq('courses_modules.courses_cohorts.courses_enrollments.role', 'admin');
  }

  const { data: courses } = await query;
  return { courses, isAdmin, isManager };
};
```

---

## Client-Side Helpers

For use in Svelte components to conditionally render UI:

### `hasModule(modules, moduleName)`
Check if user has ANY level of a module (for namespaced modules).
```svelte
<script>
  import { hasModule } from '$lib/server/auth';

  let { data } = $props();
</script>

{#if hasModule(data.profile.modules, 'users')}
  <button>Manage Users</button>
{/if}

{#if hasModule(data.profile.modules, 'courses')}
  <NavItem href="/admin/courses">Course Admin</NavItem>
{/if}
```

### `hasModuleLevel(modules, moduleLevel)`
Check for exact module.level match.
```typescript
const canParticipate = hasModuleLevel(profile.modules, 'courses.participant');
const canManageAll = hasModuleLevel(profile.modules, 'courses.admin');
```

### `hasAnyModule(modules, requiredModules)`
Check if user has ANY of the specified modules.
```typescript
const hasAnyManagement = hasAnyModule(profile.modules, [
  'users',
  'courses.manager',
  'courses.admin',
  'editor',
  'dgr'
]);
```

### `hasAllModules(modules, requiredModules)`
Check if user has ALL of the specified modules.
```typescript
const hasFullAccess = hasAllModules(profile.modules, ['users', 'editor']);
```

---

## Best Practices

### ✅ DO

- Use the unified auth system from `$lib/server/auth.ts`
- Use `mode: 'redirect'` for page routes
- Use default mode (throw_error) for API routes
- Check auth in `+page.server.ts` or `+server.ts` (server-side)
- Use client-side helpers for conditional UI rendering
- Combine modules freely for flexible permissions

### ❌ DON'T

- Don't check auth only client-side (security risk)
- Don't duplicate auth logic
- Don't hardcode redirect paths (use the redirectTo option)
- Don't assume hierarchical module relationships
- Don't use `profile.role` (column removed - use modules instead)

---

## Security Notes

1. **Server-side validation is mandatory** - All auth checks happen server-side
2. **Modules control UI visibility** - RLS policies provide database-level security
3. **Course access requires enrollment** - Modules don't grant course content access
4. **RLS policies** in Supabase provide additional database-level security
5. **Session management** is handled by SvelteKit hooks

---

## Troubleshooting

### "Forbidden - Requires [module] module access"
- User needs module in `user_profiles.modules` array
- Check with: `SELECT modules FROM user_profiles WHERE id = 'user-id';`
- Grant via user management UI or invitation flow

### "Forbidden - Requires [role] role in this course"
- User needs enrollment in `courses_enrollments` with correct role
- Or user needs `courses.admin` module for platform-wide access
- Check with:
  ```sql
  SELECT ce.role
  FROM courses_enrollments ce
  JOIN courses_cohorts cc ON ce.cohort_id = cc.id
  JOIN courses_modules cm ON cc.module_id = cm.id
  JOIN courses c ON cm.course_id = c.id
  WHERE ce.user_profile_id = 'user-id'
    AND c.slug = 'course-slug';
  ```

### "Can't see My Courses nav item"
- User needs `courses.participant` module
- Grant via course invitation flow (auto-adds module)

### "Can't see Course Admin nav item"
- User needs `courses.manager` or `courses.admin` module
- Grant via staff invitation at `/users`

---

## Summary

- **One auth system** using modules only (`$lib/server/auth.ts`)
- **Two response modes** - errors for APIs, redirects for pages
- **Two permission types** - platform modules + course enrollments
- **Namespaced modules** - `module.level` format for hierarchy
- **Flexible combinations** - mix any modules for custom permissions

For implementation examples, see:
- `src/routes/(internal)/admin/users/+page.server.ts` - Module-based auth with redirect
- `src/routes/courses/[slug]/admin/+page.server.ts` - Course admin auth
- `src/routes/my-courses/+page.server.ts` - Participant access
- `src/routes/api/admin/users/+server.ts` - API auth with errors
