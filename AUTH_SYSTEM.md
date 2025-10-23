# Authentication & Authorization System

## Overview

The arch-tools platform has a **unified auth system** that handles both **(internal)** admin routes and **(accf)** student/course routes with different response patterns appropriate for each context.

## System Architecture

### Two Auth Helper Libraries

#### 1. **`$lib/server/auth.ts`** - For ACCF & API Routes
**Use for:** `(accf)` routes and API endpoints
**Behavior:** Throws HTTP errors (401/403) - proper for API responses
**Import:** `import { requireAuth, requireRole, requireAdmin } from '$lib/server/auth'`

#### 2. **`$lib/utils/auth-helpers.ts`** - For Internal Routes
**Use for:** `(internal)` admin routes
**Behavior:** Uses redirects (303) - user-friendly for browser navigation
**Import:** `import { requireModule, requireRole, requireAdmin } from '$lib/utils/auth-helpers'`

---

## Available Functions

### Server-Side Auth (`$lib/server/auth.ts`)

For use in `+page.server.ts` or `+server.ts` files in **(accf)** routes:

```typescript
// Basic authentication check
const { session, user } = await requireAuth(event);

// Check for specific roles
const { user, profile } = await requireRole(event, ['accf_admin', 'admin']);

// Require admin role (admin or accf_admin)
const { user, profile } = await requireAdmin(event);

// Require ACCF user (student, admin, or coordinator)
const { user, profile } = await requireAccfUser(event);

// Require specific module access
const { user, profile } = await requireModule(event, 'user_management');
```

**Example Usage:**
```typescript
// src/routes/(accf)/admin/+page.server.ts
import { requireAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  const { user, profile } = await requireAdmin(event);
  // ... rest of load function
};
```

### Client-Side Auth Helpers (`$lib/utils/auth-helpers.ts`)

For use in `+page.server.ts` files in **(internal)** routes:

```typescript
// Require specific module
const userProfile = await requireModule(supabase, user.id, 'dgr_admin');

// Require specific role
const userProfile = await requireRole(supabase, user.id, ['admin', 'editor']);

// Require admin role
const userProfile = await requireAdmin(supabase, user.id);

// Get user profile (no auth check)
const profile = await getUserProfile(supabase, user.id);
```

**Example Usage:**
```typescript
// src/routes/(internal)/admin/users/+page.server.ts
import { requireModule } from '$lib/utils/auth-helpers';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();

  if (!session) {
    throw redirect(303, '/auth');
  }

  const userProfile = await requireModule(supabase, user.id, 'user_management');
  // ... rest of load function
};
```

### Client-Side Helpers (Both Libraries)

For use in `.svelte` components:

```typescript
import { hasAnyModule, hasAllModules } from '$lib/server/auth';

// Check if user has ANY of the specified modules
const canEdit = hasAnyModule(userProfile.modules, ['editor', 'admin']);

// Check if user has ALL of the specified modules
const fullAccess = hasAllModules(userProfile.modules, ['dgr_admin', 'user_management']);
```

---

## Role Hierarchy

### Platform Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Platform administrator | Full platform access, all modules |
| `editor` | Content editor | Content editing access |
| `contributor` | Content contributor | Limited contribution access |
| `viewer` | Read-only user | View-only access |

### ACCF Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `accf_admin` | ACCF administrator | Full ACCF admin access |
| `accf_student` | ACCF course student | Student dashboard, materials, reflections |
| `hub_coordinator` | Hub coordinator | Hub management, attendance |

---

## Module System

Modules provide granular permissions within roles. Users can have multiple modules assigned.

### Available Modules

- `user_management` - User administration
- `dgr_admin` - Daily Gospel Reflection management
- `editor_access` - Content editor access
- `accf_admin` - ACCF administration

### Checking Module Access

```typescript
// Server-side (throws error/redirect if no access)
await requireModule(event, 'user_management');

// Client-side (returns boolean)
const hasAccess = hasAnyModule(profile.modules, ['user_management']);
```

---

## Layout Auth Flow

### (internal) Routes

```
Root Layout (+layout.server.ts)
  ↓
(internal) Layout (+layout.server.ts)
  ├─ Checks session exists
  ├─ Fetches user profile
  ├─ Returns: session, user, userProfile, userRole
  └─ Redirects to /auth if no session
    ↓
Page Load (+page.server.ts)
  ├─ Uses requireModule() or requireRole()
  └─ Redirects to /profile if unauthorized
```

### (accf) Routes

```
Root Layout (+layout.server.ts)
  ↓
(accf) Layout (+layout.server.ts)
  ├─ Gets user from parent
  ├─ Role-based route protection
  └─ Returns: userRole, userName
    ↓
Page Load (+page.server.ts)
  ├─ Uses requireAuth(), requireRole(), etc.
  └─ Throws 401/403 if unauthorized
```

---

## Common Patterns

### Pattern 1: Admin-Only Page (Internal)

```typescript
// +page.server.ts
import { redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/utils/auth-helpers';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();

  if (!session) {
    throw redirect(303, '/auth');
  }

  await requireAdmin(supabase, user.id);

  return { /* data */ };
};
```

### Pattern 2: Module-Based Access (Internal)

```typescript
// +page.server.ts
import { redirect } from '@sveltejs/kit';
import { requireModule } from '$lib/utils/auth-helpers';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();

  if (!session) {
    throw redirect(303, '/auth');
  }

  const userProfile = await requireModule(supabase, user.id, 'dgr_admin');

  return { userProfile };
};
```

### Pattern 3: ACCF Admin Page

```typescript
// +page.server.ts
import { requireAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  const { user, profile } = await requireAdmin(event);

  return { /* data */ };
};
```

### Pattern 4: ACCF Student Page

```typescript
// +page.server.ts
import { requireAccfUser } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
  const { user, profile } = await requireAccfUser(event);

  return { /* data */ };
};
```

### Pattern 5: Conditional Access in Components

```svelte
<script>
  import { hasAnyModule } from '$lib/server/auth';

  let { data } = $props();
  let profile = $derived(data.userProfile);

  let canManageUsers = $derived(
    hasAnyModule(profile?.modules, ['user_management'])
  );
</script>

{#if canManageUsers}
  <UserManagementPanel />
{/if}
```

---

## Testing Auth

Test page available at: `/test-emails` (admin only)

This page demonstrates:
- Admin-only access pattern
- Email template testing
- Proper auth flow

---

## Best Practices

### ✅ DO

- Use `requireAuth()` / `requireRole()` for ACCF routes
- Use `requireModule()` / `requireAdmin()` for internal routes
- Check auth in `+page.server.ts` (server-side)
- Use client-side helpers (`hasAnyModule()`) for UI visibility
- Return meaningful user profile data in load functions

### ❌ DON'T

- Don't mix auth helper imports (use correct library for route type)
- Don't check auth only client-side (security risk)
- Don't duplicate auth checks (layout handles session)
- Don't forget to pass user profile to pages that need it

---

## Migration Guide

If you have existing pages with custom auth:

### Before (Custom Auth)
```typescript
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();

  if (!session) {
    throw redirect(303, '/auth');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, modules')
    .eq('id', user.id)
    .single();

  if (!profile?.modules?.includes('user_management')) {
    throw redirect(303, '/profile');
  }

  return { profile };
};
```

### After (Using Helpers)
```typescript
import { redirect } from '@sveltejs/kit';
import { requireModule } from '$lib/utils/auth-helpers';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session, user } = await safeGetSession();

  if (!session) {
    throw redirect(303, '/auth');
  }

  const profile = await requireModule(supabase, user.id, 'user_management');

  return { profile };
};
```

---

## Summary

- **Two auth systems** for different contexts (ACCF vs Internal)
- **Server-side validation** in all `+page.server.ts` files
- **Module-based permissions** for granular access control
- **Consistent patterns** across the entire platform
- **Client-side helpers** for conditional UI rendering

For questions or issues, refer to this guide or check existing implementations in:
- `src/routes/(internal)/admin/users/+page.server.ts`
- `src/routes/(internal)/test-emails/+page.server.ts`
- `src/routes/(accf)/admin/+page.server.ts`
