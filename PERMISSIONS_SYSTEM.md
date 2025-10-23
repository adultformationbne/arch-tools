# Permissions System Documentation

## Overview
The arch-tools platform uses a **role-based permissions system with modular access control**. Users are assigned a role (admin, student, or hub_coordinator) and then granted access to specific modules based on their responsibilities.

## User Roles

### Admin (`role = 'admin'`)
- Access to the `/admin` dashboard
- Can access one or more modules based on their permissions
- Created through the User Management interface (`/admin/users`)
- Has Supabase auth account

### Student (`role = 'student'`)
- Access to the ACCF student platform (`/dashboard`, `/materials`, `/reflections`)
- No admin module access
- Created when enrolled in an ACCF cohort
- Has Supabase auth account (after accepting invitation)

### Hub Coordinator (`role = 'hub_coordinator'`)
- Access to ACCF platform with additional coordinator features
- Can mark attendance for their hub
- No admin module access
- Created when assigned as hub coordinator

## Available Modules

Admins can be granted access to one or more of these modules:

| Module | ID | Description |
|--------|-----|-------------|
| **User Management** | `user_management` | Create and manage admin users, assign permissions |
| **Daily Gospel Reflections** | `dgr` | Manage DGR contributors, schedule, and publishing |
| **Content Editor** | `editor` | Edit books, blocks, and chapters |
| **Courses** | `courses` | Manage course content (future) |
| **ACCF Admin** | `accf_admin` | Manage ACCF cohorts, students, and reflections |

## Permission Schema

### Database Structure

```sql
user_profiles:
  - role: TEXT ('admin' | 'student' | 'hub_coordinator')
  - modules: JSONB array of module IDs
```

### Examples

```javascript
// Super admin with all modules
{
  "role": "admin",
  "modules": ["user_management", "dgr", "editor", "courses", "accf_admin"]
}

// DGR-only admin
{
  "role": "admin",
  "modules": ["dgr"]
}

// ACCF admin with user management
{
  "role": "admin",
  "modules": ["user_management", "accf_admin"]
}

// ACCF student
{
  "role": "student",
  "modules": []
}

// Hub coordinator
{
  "role": "hub_coordinator",
  "modules": []
}
```

## Helper Functions

### Database Functions

```sql
-- Check if user has access to a specific module
has_module_access(user_id UUID, module_name TEXT) RETURNS BOOLEAN

-- Check if user is an admin
is_admin_user(user_id UUID) RETURNS BOOLEAN

-- Get user's modules array
get_user_modules(user_id UUID) RETURNS JSONB
```

### Frontend Utilities

Located in `/src/lib/utils/permissions.js`:

```javascript
import { hasModuleAccess, isAdmin, MODULES } from '$lib/utils/permissions.js';

// Check module access
if (hasModuleAccess(userProfile, MODULES.DGR)) {
  // User can access DGR module
}

// Check if admin
if (isAdmin(userProfile)) {
  // User is an admin
}

// Get default redirect
const path = getDefaultRedirectPath(userProfile);
```

## Login Flow

```
1. User logs in at /login (or /auth)
2. Fetch user_profiles for auth.uid()
3. Check role:

   role = 'admin'
     → Redirect to /admin
     → Dashboard shows modules in user.modules array

   role = 'student'
     → Redirect to /dashboard (ACCF student view)

   role = 'hub_coordinator'
     → Redirect to /dashboard (with coordinator features)
```

## User Creation

### Admin Users

**Location**: `/admin/users`

**Requirements**:
- Must have `user_management` module access
- Creates user with `role='admin'`
- Assigns one or more modules

**Process**:
1. Admin fills out form (email, password, name, modules)
2. API creates Supabase auth user
3. Creates `user_profiles` entry with selected modules
4. New admin can immediately login

### ACCF Students

**Location**: `/admin/cohorts` (enrollment management)

**Requirements**:
- Must have `accf_admin` module access
- Creates user with `role='student'`

**Process**:
1. Admin adds student to cohort (CSV or manual)
2. Creates `cohort_enrollments` entry
3. Sends invitation email with token
4. Student accepts → creates auth account + user_profile
5. Student can login to /dashboard

## RLS Policies

All RLS policies have been updated to use the new permission functions:

```sql
-- Example: DGR tables
CREATE POLICY "Admins can manage assignment rules" ON dgr_assignment_rules
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'dgr'));

-- Example: User management
CREATE POLICY "Only user management admins can delete profiles" ON user_profiles
  FOR DELETE TO authenticated
  USING (has_module_access(auth.uid(), 'user_management'));

-- Example: ACCF
CREATE POLICY "Admins can manage all reflection responses" ON reflection_responses
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'accf_admin'));
```

## Migration

The migration `clean_permissions_system` converts the old enum-based roles to the new module-based system:

- `admin` → `{ role: 'admin', modules: ['user_management', 'dgr', 'editor', 'accf_admin', 'courses'] }`
- `editor` → `{ role: 'admin', modules: ['dgr', 'editor'] }`
- `contributor` → `{ role: 'admin', modules: ['dgr'] }`
- `accf_admin` → `{ role: 'admin', modules: ['accf_admin'] }`
- `accf_student` → `{ role: 'student', modules: [] }`
- `hub_coordinator` → `{ role: 'hub_coordinator', modules: [] }`

## Best Practices

1. **Principle of Least Privilege**: Only grant modules users actually need
2. **User Management Protection**: Be careful who gets `user_management` access
3. **Students Never Get Modules**: Students/coordinators should always have empty modules array
4. **Check Permissions Server-Side**: Always verify permissions in API endpoints and server loads
5. **Use Helper Functions**: Use the provided utilities instead of manually checking arrays

## Future Enhancements

- Role templates for common permission combinations
- Audit log for permission changes
- Time-limited module access
- Module-specific sub-permissions (e.g., DGR view-only vs full admin)

---

**Last Updated**: 2025-10-23
**Migration Applied**: `clean_permissions_system`
**Status**: ✅ Production Ready
