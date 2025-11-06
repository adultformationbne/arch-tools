# Authentication & Authorization System

## Overview

The arch-tools platform uses a **unified module-based authentication system** (`$lib/server/auth.ts`) that handles all authentication and authorization using namespaced module permissions. All authentication flows use **modern PKCE flow with token_hash** for security and compliance with Supabase standards.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Authentication Flows](#authentication-flows)
3. [Module-Based Permissions](#module-based-permissions)
4. [Authorization Functions](#authorization-functions)
5. [Usage Examples](#usage-examples)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)

---

## System Architecture

### Single Unified Auth Library

**Location:** `$lib/server/auth.ts`

**Features:**
- Module-based authorization (namespaced permissions)
- Course-level authorization (per-course roles via enrollments)
- Flexible response modes (errors vs redirects)
- Clean, consistent API
- PKCE flow with token_hash for all email-based auth

### Response Modes

The auth system supports two response modes via the `options` parameter:

#### 1. `throw_error` (Default)
Returns HTTP 401/403 errors - perfect for API routes:
```typescript
// Will throw error(401) or error(403)
await requireModule(event, 'users');
```

#### 2. `redirect`
Returns 303 redirects - perfect for page routes:
```typescript
// Will throw redirect(303, '/my-courses')
await requireModule(event, 'users', { mode: 'redirect', redirectTo: '/my-courses' });
```

---

## Authentication Flows

All email-based auth flows use **PKCE with token_hash**. The standard pattern is:

1. **Trigger** → Supabase sends email with link containing `token_hash`
2. **Email Link** → User clicks link to `/auth/confirm?token_hash=xxx&type={type}`
3. **Verification** → Server verifies token via `verifyOtp()` and establishes session
4. **Redirect** → User sent to appropriate page based on auth type

### 1. User Invitation Flow

**Purpose:** Admin invites new user to platform

**Trigger:** Admin uses `/users` page to invite user

**Email Template:** "Invite User" in Supabase Dashboard

**Link Format:**
```
https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=invite
```

**Flow:**
```
1. Admin invites user via /users page
2. POST /api/admin/users { email, full_name, modules }
3. Supabase sends invite email with token_hash link
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=invite
5. Server calls supabase.auth.verifyOtp({ token_hash, type: 'invite' })
6. Session established in HTTP-only cookies ✅
7. Redirect to /auth/setup-password
8. User sets password via supabase.auth.updateUser({ password })
9. Redirect to dashboard based on assigned modules
```

**Code:**
```javascript
// src/routes/api/admin/users/+server.js
await adminSupabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name, invited_by: user.email },
  redirectTo: `${PUBLIC_SITE_URL}/auth/confirm`
});
```

### 2. Password Reset Flow

**Purpose:** User forgot password and needs to reset it

**Trigger:** User requests password reset

**Email Template:** "Reset Password" in Supabase Dashboard

**Link Format:**
```
https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=recovery
```

**Flow:**
```
1. User requests password reset
2. Call supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/confirm' })
3. Supabase sends recovery email with token_hash link
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=recovery
5. Server verifies token and establishes session
6. Redirect to /auth/setup-password
7. User sets new password
8. Redirect to dashboard
```

**Code:**
```javascript
await supabase.auth.resetPasswordForEmail(resetEmail, {
  redirectTo: window.location.origin + '/auth/confirm'
});
```

### 3. Signup Confirmation Flow

**Purpose:** New user self-registration

**Trigger:** User signs up via `/auth` page

**Email Template:** "Confirm Signup" in Supabase Dashboard

**Link Format:**
```
https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=signup
```

**Flow:**
```
1. User signs up with email + password
2. Call supabase.auth.signUp({ email, password, options: { emailRedirectTo } })
3. Supabase sends confirmation email
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=signup
5. Server verifies token and establishes session
6. Redirect to dashboard based on user modules
```

**Code:**
```javascript
await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: window.location.origin + '/auth/confirm'
  }
});
```

### 4. Magic Link Login Flow

**Purpose:** Passwordless login

**Trigger:** User requests magic link

**Email Template:** "Magic Link" in Supabase Dashboard

**Code:**
```javascript
await supabase.auth.signInWithOtp({
  email,
  options: { shouldCreateUser: false }
});
```

### 5. Email Change Flow

**Purpose:** User updates their email address

**Trigger:** User changes email in profile

**Email Template:** "Email Change" in Supabase Dashboard

**Code:**
```javascript
await supabase.auth.updateUser({ email: newEmail });
```

### Central Auth Handler

All flows route through **`/auth/confirm`** which verifies tokens and establishes sessions:

```typescript
// src/routes/auth/confirm/+server.ts
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  if (token_hash && type) {
    // Verify and establish session
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash
    });

    if (!error) {
      // Route based on type
      if (type === 'invite' || type === 'recovery') {
        redirect(303, '/auth/setup-password');
      } else if (type === 'signup') {
        redirect(303, '/dashboard'); // or based on modules
      }
      // ... etc
    }
  }

  redirect(303, '/auth/error');
};
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
| `courses.manager` | Manage assigned courses | `/courses/[slug]/admin` | Manage specific courses (via `assigned_course_ids`) |
| `courses.admin` | Manage all courses | `/courses/[slug]/admin` | Platform-wide course management (no assignment needed) |

**Key Principles:**
- **courses.participant** and **courses.manager** are independent (not hierarchical)
- Staff can have `courses.manager` WITHOUT `courses.participant`
- Some staff may have BOTH to participate AND manage
- **Course managers are assigned to specific courses via `user_profiles.assigned_course_ids`**
- **Course admins and managers are NOT enrolled in cohorts**—they manage via platform modules
- `courses.admin` can manage ALL courses without any assignment

### Course Enrollment Roles (participants only)

**CRITICAL:** Cohort enrollments are for participants only. Stored in `courses_enrollments.role`:

| Role | Description |
|------|-------------|
| `student` | Regular course participant |
| `coordinator` | Hub coordinator for this course |

**Important Notes:**
- Hub coordination is per-course via `enrollment.role`, NOT a platform module
- Course managers and admins are NOT enrolled—management is via platform modules
- Only participants (students and coordinators) appear in cohort enrollments

### Module Lifecycle

#### Default User
- New users have NO modules (must be invited)
- No access to any section until modules granted

#### Staff Invitation (via `/users`)
- Admin selects which modules to grant
- Example: `['users', 'courses.manager', 'dgr']`
- Invitation email sent with magic link to set password
- User sets password and gains immediate access

#### Participant Invitation (via course cohort)
- Auto-grants `['courses.participant']`
- Creates enrollment with role (student/coordinator)

#### Module Independence
Modules can be combined freely. Common combos:
- `['courses.participant']` - Participant only
- `['users', 'courses.manager']` - Staff (no participation)
- `['users', 'courses.participant', 'courses.manager']` - Staff who also participates

---

## Authorization Functions

### Platform-Level Authorization

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

#### `requireAnyModule(event, moduleNames, options?)`
Requires user to have at least one of the provided modules.
```typescript
const { user, profile } = await requireAnyModule(event, ['courses.admin', 'courses.manager']);
```

### Course-Level Authorization

Course-level permissions are based on enrollments in `courses_enrollments`. Module access determines which management UIs are visible, but course content access requires enrollment.

#### `requireCourseAccess(event, courseSlug, options?)`
Requires user to be enrolled in the course (any role).
```typescript
const courseSlug = event.params.slug;
const { user, enrollment } = await requireCourseAccess(event, courseSlug);
// Everyone must be enrolled - including courses.admin users
```

#### `requireCourseAdmin(event, courseSlug, options?)`
Requires user to have course management access via:
- `courses.admin` module (can manage ALL courses platform-wide), OR
- `courses.manager` module + course ID in their `assigned_course_ids` array

```typescript
const { user, profile, viaModule } = await requireCourseAdmin(event, courseSlug);
// viaModule: 'courses.admin' if platform admin, 'courses.manager' if assigned manager
// Note: No enrollment object - managers are NOT enrolled in cohorts
```

#### `requireCourseRole(event, courseSlug, allowedRoles, options?)`
Requires user to have one of the specified enrollment roles (participants only).
```typescript
// Allow only hub coordinators
const { user, enrollment } = await requireCourseRole(event, courseSlug, ['coordinator']);

// Valid roles: 'student', 'coordinator'
```

### Client-Side Helpers

For use in Svelte components to conditionally render UI:

#### `hasModule(modules, moduleName)`
Check if user has ANY level of a module (for namespaced modules).
```svelte
<script>
  import { hasModule } from '$lib/server/auth';
  let { data } = $props();
</script>

{#if hasModule(data.profile.modules, 'users')}
  <button>Manage Users</button>
{/if}
```

#### `hasModuleLevel(modules, moduleLevel)`
Check for exact module.level match.
```typescript
const canParticipate = hasModuleLevel(profile.modules, 'courses.participant');
const canManageAll = hasModuleLevel(profile.modules, 'courses.admin');
```

#### `hasAnyModule(modules, requiredModules)`
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

#### `hasAllModules(modules, requiredModules)`
Check if user has ALL of the specified modules.
```typescript
const hasFullAccess = hasAllModules(profile.modules, ['users', 'editor']);
```

---

## Usage Examples

### Example 1: User Management Page (Staff Only)
```typescript
// src/routes/users/+page.server.ts
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

  // courses.admin OR (courses.manager + assigned to this course)
  const { user, profile, viaModule } = await requireCourseAdmin(event, courseSlug, {
    mode: 'redirect'
  });

  // ... fetch course data
  return { courseData, canManageAll: viaModule === 'courses.admin' };
};
```

---

## Configuration

### Supabase Dashboard Setup

**Required for production:**

#### 1. Authentication → URL Configuration

- **Site URL**: `https://app.archdiocesanministries.org.au`
- **Redirect URLs**: Add `https://app.archdiocesanministries.org.au/auth/confirm`

#### 2. Authentication → Email Templates

Update each template to use `/auth/confirm` with `token_hash`:

**Invite User Template:**
```html
<h2>You've been invited!</h2>
<p>Click here to set up your account:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Accept Invitation</a></p>
```

**Reset Password Template:**
```html
<h2>Reset Your Password</h2>
<p>Click here to reset your password:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
```

**Confirm Signup Template:**
```html
<h2>Confirm Your Email</h2>
<p>Click here to confirm your email:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm Email</a></p>
```

**Magic Link Template:**
```html
<h2>Your Magic Link</h2>
<p>Click here to sign in:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">Sign In</a></p>
```

### Environment Variables

```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PUBLIC_SITE_URL=https://app.archdiocesanministries.org.au
```

### Local Development

For local development, emails are caught by Inbucket at `http://localhost:54324`.

---

## Security Features

### 1. PKCE Flow
- Modern OAuth 2.0 standard
- Uses `token_hash` instead of plaintext tokens in URLs
- 5-minute token expiry
- Single-use tokens (cannot be reused)

### 2. Server-Side Verification
- All tokens verified server-side via `verifyOtp()`
- Session established in secure HTTP-only cookies
- No client-side auth bypass possible
- Server-side validation mandatory for all protected routes

### 3. Token Security
- Tokens are hashed before being sent in URLs
- Prevents token interception and replay attacks
- Compliant with OAuth 2.0 security best practices

### 4. Session Management
- Handled by SvelteKit hooks (`hooks.server.ts`)
- Uses `@supabase/ssr` for secure cookie handling
- Automatic session refresh

### 5. Row-Level Security (RLS)
- Database-level security via Supabase RLS policies
- Enforced regardless of client-side code
- Provides defense-in-depth

---

## Best Practices

### ✅ DO

- Use the unified auth system from `$lib/server/auth.ts`
- Use `mode: 'redirect'` for page routes
- Use default mode (throw_error) for API routes
- Check auth in `+page.server.ts` or `+server.ts` (server-side)
- Use client-side helpers for conditional UI rendering
- Combine modules freely for flexible permissions
- Always use `/auth/confirm` for email redirect URLs
- Set `emailRedirectTo` in all auth methods that send emails

### ❌ DON'T

- Don't check auth only client-side (security risk)
- Don't duplicate auth logic
- Don't hardcode redirect paths (use the redirectTo option)
- Don't assume hierarchical module relationships
- Don't use `profile.role` (column removed - use modules instead)
- Don't use `/auth/callback` for new code (legacy route)
- Don't include tokens in query parameters (use token_hash)

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

### "Auth session missing!" at /auth/setup-password
- **Cause**: Session not established before accessing protected page
- **Solution**: Ensure user came through `/auth/confirm` route which establishes session
- Check that email template uses correct link format with `token_hash`

### "Invalid token_hash"
- **Cause**: Token expired (>5 minutes) or already used
- **Solution**: Request new invitation/reset email

### Redirect Loop
- **Cause**: Misconfigured redirect URLs in Supabase Dashboard
- **Solution**: Verify Site URL and Redirect URLs match your domain exactly

### Email Not Arriving
- **Local Dev**: Check Inbucket at `http://localhost:54324`
- **Production**: Check Supabase logs for email delivery errors
- Verify email templates are configured correctly in Supabase Dashboard

---

## Testing

### Test Page

Use `/test-emails` page to test all auth flows:
- User Invitation
- Magic Link Login
- Password Reset
- Email Change

### Manual Testing Checklist

```bash
# 1. Test User Invitation
POST /api/admin/users
{
  "email": "test@example.com",
  "full_name": "Test User",
  "modules": ["courses.participant"]
}

# 2. Check email inbox (Inbucket for local dev)
# 3. Click invitation link
# 4. Verify redirect to /auth/setup-password
# 5. Set password
# 6. Verify redirect to appropriate dashboard
# 7. Confirm user can access their modules
```

---

## Summary

- **One auth system** using modules only (`$lib/server/auth.ts`)
- **PKCE flow** with `token_hash` for all email-based auth
- **Central handler** at `/auth/confirm` for all verification
- **Two response modes** - errors for APIs, redirects for pages
- **Two permission types** - platform modules + course enrollments
- **Namespaced modules** - `module.level` format for hierarchy
- **Flexible combinations** - mix any modules for custom permissions
- **Server-side security** - all auth checks happen server-side

---

## Related Documentation

- **AUTH_FLOWS.md** - Detailed flow diagrams for each auth type (archived)
- **EMAIL_SYSTEM.md** - Email templates and sending
- **COURSES.md** - Course system architecture
- **AGENTS.MD** - Database migrations via Supabase MCP

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/server/auth.ts` | Core auth functions |
| `src/routes/auth/confirm/+server.ts` | Central auth verification handler |
| `src/routes/auth/setup-password/+page.svelte` | Password setup UI |
| `src/routes/auth/+page.svelte` | Login/signup page |
| `src/routes/api/admin/users/+server.js` | User invitation API |
| `src/hooks.server.ts` | SvelteKit auth hooks |

---

*Last Updated: November 2025*
*Version: 2.0 - PKCE Flow*
*Maintainer: Development Team*
