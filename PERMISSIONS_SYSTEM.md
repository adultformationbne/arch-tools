# Permissions System Documentation

## Overview
The arch-tools platform uses a **module-based permissions system**. Users are granted access to specific modules based on their responsibilities. There are no platform-level roles - all permissions are controlled via modules.

## User Types

Users are differentiated by the modules they have access to, not by a platform role field:

### Platform Administrators
- Have `users` module (highest privilege)
- Can manage all users, invitations, and permissions
- Typically also have other management modules (editor, dgr, courses.admin)
- Access management interfaces at `/users`

### Staff/Managers
- Have specific management modules (editor, dgr, courses.manager, courses.admin)
- Can manage their assigned areas of the platform
- Access varies based on modules granted

### Course Participants (Students/Coordinators)
- Have `courses.participant` module
- Access enrolled courses via `/my-courses`
- Hub coordination is per-course via `courses_enrollments.role = 'coordinator'`
- Created when enrolled in a course

## Available Modules

Users can be granted access to one or more of these modules:

### Platform Modules

| Module | Description | Navigation |
|--------|-------------|-----------|
| **`users`** | **Platform admin** - Manage all users, invitations, and permissions (highest privilege) | `/users` |
| **`editor`** | Content editor access | `/editor` |
| **`dgr`** | Daily Gospel Reflections management | `/dgr` |

### Course Modules

| Module | Description | Navigation |
|--------|-------------|-----------|
| **`courses.participant`** | Access enrolled courses | `/my-courses` |
| **`courses.manager`** | Manage courses where enrolled as admin | `/courses/admin` |
| **`courses.admin`** | Manage ALL courses platform-wide | `/courses/admin` |

## Permission Schema

### Database Structure

```sql
user_profiles:
  - modules: TEXT[] array of module IDs
  - assigned_course_ids: JSONB (for courses.manager users)

courses_enrollments:
  - role: TEXT ('student' | 'coordinator' | 'admin') -- per-course role
```

**Note:** The `user_profiles.role` column has been removed. All permissions are now controlled via modules.

### Examples

```javascript
// Platform administrator with all modules
{
  "modules": ["users", "editor", "dgr", "courses.admin", "courses.participant"]
}

// DGR manager only
{
  "modules": ["dgr"]
}

// Course manager who can also participate in courses
{
  "modules": ["courses.manager", "courses.participant"],
  "assigned_course_ids": { "course_ids": ["uuid1", "uuid2"] }
}

// Course participant (student)
{
  "modules": ["courses.participant"]
}

// Hub coordinator (course participant with special enrollment role)
{
  "modules": ["courses.participant"]
}
-- Plus enrollment record with role = 'coordinator'
```

## Helper Functions

### Server-Side Auth Helpers

Located in `/src/lib/server/auth.ts`:

```typescript
// Platform module access
await requireModule(event, 'users');
await requireModuleLevel(event, 'courses.admin');
await requireAnyModule(event, ['courses.manager', 'courses.admin']);

// Course access
await requireCourseAccess(event, courseSlug);  // Must be enrolled
await requireCourseAdmin(event, courseSlug);   // courses.admin OR enrolled as admin
await requireCourseRole(event, courseSlug, ['admin', 'coordinator']);

// Module checking utilities
hasModule(modules, 'users')  // Check for module or any level (e.g., 'courses' matches 'courses.admin')
hasModuleLevel(modules, 'courses.participant')  // Check for exact module level
hasAnyModule(modules, ['users', 'editor'])  // Check if has any of the modules
```

### Database Functions

```sql
-- Check if user has specific module
has_module(user_id UUID, module TEXT) RETURNS BOOLEAN
```

## Login Flow

```
1. User logs in at /login
2. Fetch user_profiles for auth.uid()
3. Check modules and redirect based on hierarchy:

   Has 'users' module (platform admin)
     → Redirect to /users

   Has 'courses.admin' or 'courses.manager'
     → Redirect to /courses/admin

   Has 'editor' module
     → Redirect to /editor

   Has 'dgr' module
     → Redirect to /dgr

   Has only 'courses.participant'
     → Redirect to /my-courses

   No modules
     → Redirect to /profile
```

## User Creation

### Platform Users (Staff/Admins)

**Location**: `/users`

**Requirements**:
- Must have `users` module (platform admin access)

**Process**:
1. Platform admin creates user via `/users` interface
2. Selects modules to grant (users, editor, dgr, courses.admin, etc.)
3. System creates Supabase auth account + user_profile
4. New user can immediately login at `/login`

### Course Participants (Students)

**Location**: Course cohort management via bulk CSV import

**Requirements**:
- Must have `courses.admin` or `courses.manager` module access

**Process**:
1. Course admin uploads CSV with student information
2. System creates auth accounts for new users
3. Creates user_profiles with `courses.participant` module
4. Creates enrollment records linking users to courses
5. Users can login at `/login` and access `/my-courses`

## RLS Policies

All RLS policies use the `has_module()` function for permission checks:

```sql
-- Example: DGR tables
CREATE POLICY "Admins can manage assignment rules" ON dgr_assignment_rules
  FOR ALL TO authenticated
  USING (has_module(auth.uid(), 'dgr'));

-- Example: User management
CREATE POLICY "Only platform admins can delete profiles" ON user_profiles
  FOR DELETE TO authenticated
  USING (has_module(auth.uid(), 'users'));

-- Example: Course management
CREATE POLICY "Course admins can manage all courses" ON courses
  FOR ALL TO authenticated
  USING (
    has_module(auth.uid(), 'courses.admin')
    OR has_module(auth.uid(), 'courses.manager')
  );

-- Example: Course enrollment access (based on enrollment, not module)
CREATE POLICY "Users can view their enrollments" ON courses_enrollments
  FOR SELECT TO authenticated
  USING (user_profile_id = auth.uid());
```

## Migration History

The platform has completed a migration from role-based to module-based permissions:

### What Changed
- Removed `user_profiles.role` column
- All permissions now controlled via `user_profiles.modules` array
- Hub coordination moved to per-course `courses_enrollments.role`
- RLS policies updated to use `has_module()` function

### Module Mapping (from old system)
- Old platform admins → `['users', 'editor', 'dgr', 'courses.admin', 'courses.participant']`
- Old DGR/editor staff → Specific modules granted (e.g., `['dgr', 'editor']`)
- Old students → `['courses.participant']`
- Old hub coordinators → `['courses.participant']` + enrollment with `role = 'coordinator'`

See `PLAN.md` for complete migration details.

## Best Practices

1. **Principle of Least Privilege**: Only grant modules users actually need
2. **Platform Admin Protection**: Be very careful who gets `users` module access (highest privilege)
3. **Participants Get Minimal Modules**: Students/coordinators should only have `courses.participant`
4. **Check Permissions Server-Side**: Always verify permissions in API endpoints and server loads using auth helpers
5. **Use Helper Functions**: Use `requireModule()`, `hasModule()`, etc. instead of manually checking arrays
6. **Course Access vs Management**: Remember that `courses.participant` grants access to enrolled courses, while `courses.manager` and `courses.admin` grant management capabilities

## Future Enhancements

- Role templates for common permission combinations
- Audit log for permission changes
- Time-limited module access
- Module-specific sub-permissions (e.g., DGR view-only vs full admin)

---

**Last Updated**: 2025-11-20
**Migration Status**: ✅ Complete - Module-based system in production
**Status**: ✅ Production Ready
