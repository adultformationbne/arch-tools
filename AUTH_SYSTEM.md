# Authentication & Authorization System

## Overview

The arch-tools platform uses a **unified authentication system** (`$lib/server/auth.ts`) that handles all authentication and authorization with flexible response modes for different route types.

## System Architecture

### Single Unified Auth Library

**Location:** `$lib/server/auth.ts`

**Features:**
- Platform-level authorization (admin, modules)
- Course-level authorization (per-course roles)
- Flexible response modes (errors vs redirects)
- Automatic admin access to all modules
- Clean, consistent API

---

## Response Modes

The auth system supports two response modes via the `options` parameter:

### 1. `throw_error` (Default)
Returns HTTP 401/403 errors - perfect for API routes:
```typescript
// Will throw error(401) or error(403)
await requirePlatformAdmin(event);
```

### 2. `redirect`
Returns 303 redirects - perfect for page routes:
```typescript
// Will throw redirect(303, '/profile')
await requirePlatformAdmin(event, { mode: 'redirect', redirectTo: '/profile' });
```

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

#### `requirePlatformAdmin(event, options?)`
Requires user to have `admin` role in `user_profiles`.
```typescript
const { user, profile } = await requirePlatformAdmin(event);
// For page routes:
const { user, profile } = await requirePlatformAdmin(event, { mode: 'redirect' });
```

#### `requirePlatformRole(event, allowedRoles, options?)`
Requires user to have one of the specified platform roles.
```typescript
const { user, profile } = await requirePlatformRole(event, ['admin', 'hub_coordinator']);
```

#### `requireModule(event, moduleName, options?)`
Requires user to have specific module access. **Admins automatically pass**.
```typescript
const { user, profile } = await requireModule(event, 'user_management');
const { user, profile } = await requireModule(event, 'dgr', { mode: 'redirect' });
const { user, profile } = await requireModule(event, 'editor');
```

---

## Course-Level Authorization

Course-level permissions are based on enrollments in `courses_enrollments`. Platform admins automatically have access to all courses.

### Functions

#### `requireCourseAccess(event, courseSlug, options?)`
Requires user to be enrolled in the course (any role: admin, student, or coordinator).
```typescript
const courseSlug = event.params.slug;
const { user, profile, enrollment } = await requireCourseAccess(event, courseSlug);
```

#### `requireCourseAdmin(event, courseSlug, options?)`
Requires user to have admin role in the course (or be a platform admin).
```typescript
const { user, enrollment, isPlatformAdmin } = await requireCourseAdmin(event, courseSlug);
```

#### `requireCourseRole(event, courseSlug, allowedRoles, options?)`
Requires user to have one of the specified roles in the course.
```typescript
// Allow both admin and coordinator
const { user, enrollment } = await requireCourseRole(event, courseSlug, ['admin', 'coordinator']);
```

---

## Role System

### Platform Roles
Stored in `user_profiles.role`:

| Role | Description |
|------|-------------|
| `admin` | Full platform access, automatic access to all modules and courses |
| `student` | Regular user, enrolls in courses |
| `hub_coordinator` | Manages hubs |

### Course Roles
Stored in `courses_enrollments.role` (per user per course):

| Role | Description |
|------|-------------|
| `admin` | Can manage this specific course |
| `student` | Enrolled student in this course |
| `coordinator` | Hub coordinator for this course |

### Module Permissions
Stored in `user_profiles.modules` (array):

- `user_management` - User administration
- `dgr` - Daily Gospel Reflections management
- `editor` - Content editor access

**Note:** Platform admins automatically have access to all modules without needing them listed.

---

## Usage Examples

### Example 1: (internal) Page Route - Redirect on Failure
```typescript
// src/routes/(internal)/admin/users/+page.server.ts
import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  // Redirects to /profile if user doesn't have access
  const { user, profile } = await requireModule(event, 'user_management', {
    mode: 'redirect',
    redirectTo: '/profile'
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
  const { user } = await requireModule(event, 'user_management');

  // ... create user
  return json({ success: true });
}
```

### Example 3: Course Admin Page
```typescript
// src/routes/courses/[slug]/admin/+page.server.ts
import type { PageServerLoad } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  const courseSlug = event.params.slug;

  // Platform admins OR course admins can access
  const { user, enrollment, isPlatformAdmin } = await requireCourseAdmin(event, courseSlug);

  // ... fetch course data
  return { courseData };
};
```

### Example 4: Course Student Page
```typescript
// src/routes/courses/[slug]/dashboard/+page.server.ts
import type { PageServerLoad } from './$types';
import { requireCourseAccess } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  const courseSlug = event.params.slug;

  // Any enrolled user (admin, student, coordinator) can access
  const { user, enrollment } = await requireCourseAccess(event, courseSlug);

  // ... fetch dashboard data
  return { dashboardData };
};
```

---

## Client-Side Helpers

For use in Svelte components to conditionally render UI:

### `hasAnyModule(modules, requiredModules)`
```svelte
<script>
  import { hasAnyModule } from '$lib/server/auth';

  let { data } = $props();
  let canEdit = $derived(hasAnyModule(data.userProfile?.modules, ['editor', 'admin']));
</script>

{#if canEdit}
  <button>Edit Content</button>
{/if}
```

### `hasAllModules(modules, requiredModules)`
```typescript
const hasFullAccess = hasAllModules(profile.modules, ['user_management', 'editor']);
```

### `isPlatformAdmin(role)`
```typescript
const isAdmin = isPlatformAdmin(profile.role);
```

---

## Migration from Old System

### Old Pattern (REMOVED)
```typescript
// ❌ OLD - Don't use
import { requireAdmin } from '$lib/utils/auth-helpers';

const { session, user } = await safeGetSession();
if (!session) throw redirect(303, '/auth');
const profile = await requireAdmin(supabase, user.id);
```

### New Pattern
```typescript
// ✅ NEW - Use this
import { requirePlatformAdmin } from '$lib/server/auth';

const { user, profile } = await requirePlatformAdmin(event, { mode: 'redirect' });
```

---

## Best Practices

### ✅ DO

- Use the unified auth system from `$lib/server/auth.ts`
- Use `mode: 'redirect'` for page routes
- Use default mode (throw_error) for API routes
- Let platform admins access everything automatically
- Check auth in `+page.server.ts` or `+server.ts` (server-side)
- Use client-side helpers for conditional UI rendering

### ❌ DON'T

- Don't check auth only client-side (security risk)
- Don't duplicate auth logic
- Don't forget platform admins have automatic access
- Don't hardcode redirect paths (use the redirectTo option)

---

## Security Notes

1. **Server-side validation is mandatory** - All auth checks happen server-side
2. **Platform admins bypass module checks** - They have access to everything
3. **Course admins are course-specific** - Not the same as platform admins
4. **RLS policies** in Supabase provide additional database-level security
5. **Session management** is handled by SvelteKit hooks

---

## Troubleshooting

### "Forbidden - Admin access required"
- User needs `role: 'admin'` in `user_profiles` table
- Check with: `SELECT role FROM user_profiles WHERE id = 'user-id';`

### "Forbidden - Requires [module] module access"
- User needs module in `user_profiles.modules` array
- Or user needs `role: 'admin'` (admins bypass module checks)
- Check with: `SELECT modules FROM user_profiles WHERE id = 'user-id';`

### "Forbidden - Requires [role] role in this course"
- User needs enrollment in `courses_enrollments` with correct role
- Or user needs platform admin (`user_profiles.role = 'admin'`)
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

---

## Summary

- **One auth system** to rule them all (`$lib/server/auth.ts`)
- **Two response modes** - errors for APIs, redirects for pages
- **Three permission levels** - platform, module, course
- **Admins are powerful** - automatic access to everything
- **Course-scoped roles** - different permissions per course

For implementation examples, see:
- `src/routes/(internal)/admin/users/+page.server.ts` - Module-based auth with redirect
- `src/routes/courses/[slug]/admin/+page.server.ts` - Course admin auth
- `src/routes/courses/[slug]/dashboard/+page.server.ts` - Course access auth
- `src/routes/api/admin/users/+server.ts` - API auth with errors
