# Authentication & Authorization System

> **📌 Single Source of Truth** - This is the authoritative documentation for the authentication system. All previous docs (v1, security audits, checklogs) have been removed.

**Last Updated:** 2025-11-13
**Status:** ✅ Production Ready
**System Type:** Invite-Only with Email + OTP

---

## Overview

This is an **invite-only authentication system** where:
1. Admins pre-create user accounts
2. Users login with their email
3. System sends 6-digit OTP to verify email ownership
4. New users set a password; existing users can use password or OTP

**No invitation codes required** - users just need their email address.

---

## Core Flow

### For New Users (Pending)

```
Admin creates user via /users
  ↓
User visits /login
  ↓
User enters email → clicks "Continue"
  ↓
System checks: User exists? Has password?
  → User exists, no password → Send OTP
  ↓
User enters 6-digit OTP from email
  ↓
User redirected to /login/setup-password
  ↓
User creates password
  ↓
Redirect to dashboard based on modules
```

### For Existing Users

```
User visits /login
  ↓
User enters email → clicks "Continue"
  ↓
System checks: User has password?
  → Yes → Show password field
  ↓
User enters password → clicks "Sign in"
  ↓
Success → Redirect to dashboard

OR (if password forgotten/failed):
  ↓
User clicks "Send me a login code instead"
  ↓
OTP sent to email
  ↓
User enters OTP → Redirect to dashboard
```

---

## Security Model

### 1. Pre-Invited Accounts Only
- Users **must** be pre-created by admins
- No self-registration
- Admin controls who has access

### 2. Email Verification
- OTP sent to email proves ownership
- 6-digit code, 60-minute expiration (configurable to 10-30 min for higher security)
- **OTP Send Rate Limiting:**
  - Application-level: 5 requests/min per IP (in-memory)
  - Supabase-level: Built-in verification rate limiting
  - Current implementation accepts multiple OTP sends per legitimate email check
  - **Future consideration:** Add per-email send limit (e.g., 3 sends per 15 min) to prevent mis-click spam

### 3. Password Detection
- Uses `encrypted_password` field to determine if password exists
- Pending users (no password) → OTP flow
- Active users (with password) → Password flow

### 4. Database Security
- All user and authentication-related data is protected by Row Level Security (RLS)
- No public SELECT policies on user tables
- All authentication queries go through server endpoints
- Email addresses are never exposed in client-side queries or API responses

### 5. Rate Limiting
- In-memory per-IP rate limiting: 5 req/min
- **Note:** This is per-node and resets on restart
- For production at scale, consider Redis/Postgres-based limiting

---

## Database Schema

### `user_profiles`
- `id` (UUID) - Matches auth.users.id
- `email` (TEXT) - User email
- `modules` (TEXT[]) - Permission modules
- `assigned_course_ids` (JSONB) - For courses.manager role

### `auth.users` (Supabase Auth)
- `email` - User email
- `encrypted_password` - NULL if no password set yet (pending user)
- Managed by Supabase Auth

**Note:** All users (pending and active) are stored in the same tables. Status is implicit:
- Pending user: `encrypted_password` is NULL
- Active user: `encrypted_password` exists

---

## API Endpoints

### `POST /api/auth/check-email`
**Purpose:** Determine authentication path for email

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (existing user with password):**
```json
{
  "exists": true,
  "nextStep": "password",
  "hasPassword": true,
  "message": "Enter your password to continue"
}
```

**Response (pending user, no password):**
```json
{
  "exists": true,
  "nextStep": "otp",
  "hasPassword": false,
  "message": "A verification code will be sent to your email"
}
```

**Response (user doesn't exist):**
```json
{
  "exists": false,
  "nextStep": "error",
  "message": "No account found. Please contact your administrator."
}
```

---

## Module-Based Authorization

### Platform Modules (in `user_profiles.modules`)

| Module | Access |
|--------|--------|
| `users` | User management, invitations, permissions |
| `editor` | Content editor access |
| `dgr` | Daily Gospel Reflections management |
| `courses.participant` | Access enrolled courses via /my-courses |
| `courses.manager` | Manage assigned courses (via assigned_course_ids) |
| `courses.admin` | Manage ALL courses platform-wide |

### Auth Helper Functions (`$lib/server/auth.ts`)

```typescript
// Platform-level
await requireModule(event, 'users');
await requireModuleLevel(event, 'courses.admin');
await requireAnyModule(event, ['courses.manager', 'courses.admin']);

// Course-level
await requireCourseAdmin(event, courseSlug);
await requireCourseAccess(event, courseSlug);
await requireCourseRole(event, courseSlug, ['admin', 'coordinator']);
```

**Response Modes:**
- `mode: 'throw_error'` - Returns HTTP 401/403 (for API routes)
- `mode: 'redirect'` - Returns 303 redirect (for page routes)

---

## User Experience

### `/login` Page - Email-First Interface

**Step 1: Email**
```
Enter email → Continue
```

**Step 2a: Password (if user has one)**
```
Enter password → Sign in
OR
Send me a login code instead (button)
```

**Step 2b: OTP (if pending or code requested)**
```
Enter 6-digit code → Verify
```

**Step 3: Setup Password (new users only)**
```
Enter new password → Confirm → Set Password
```

---

## Admin Experience

### Creating Users (`/users` page)

1. Click "Add User"
2. Enter email, name, modules
3. Click "Send Invitation"
4. User created in pending state (no password)
5. **No automatic email sent** - Admins are responsible for informing users
6. Admin tells user: "Visit [site]/login and sign in with your email address"

**Note:** Automatic "You've been invited" emails are a planned future enhancement. For now, admins communicate directly with new users via their preferred channel.

---

## Known Limitations & Trade-offs

### 1. Email Enumeration
**Reality:** The system reveals if an email exists or not.

**Why it's acceptable:** This is an invite-only B2B system where:
- Only pre-invited emails exist
- Target users are known staff/members
- Enumeration doesn't grant access (still need OTP)

### 2. In-Memory Rate Limiting
**Reality:** Rate limits are per-node and reset on restart.

**Why it's acceptable for now:**
- Small scale, single instance
- Move to Redis/Postgres when scaling horizontally

**Attack surface:** 5 req/min per IP makes brute force impractical for casual attackers, but distributed attacks could bypass this.

### 3. OTP Security
**Reality:** 6-digit codes = ~1M combinations, 60-minute window

**Why it's acceptable:**
- Supabase has built-in rate limiting on OTP verification
- Requires email access (2FA: something you know + something you have)
- Short expiration window (60 min)

---

## Password Reset Flow

**Current Implementation:**
Users who forget their password use the OTP fallback:
1. User goes to `/login` and enters email
2. System shows password field
3. User clicks "Send me a login code instead"
4. OTP sent to email
5. User enters OTP and logs in
6. User can change password in `/profile` (if implemented)

**Admin Reset:**
Admins with `users` module can reset passwords via `/users` page:
- Select user → Click "Reset Password" → Admin sets temporary password
- User logs in with temporary password and changes it

**Future Enhancement:**
Dedicated "Forgot Password" flow with email-based reset link (similar to standard password reset UX).

---

## Supabase Configuration

**CRITICAL:** Set these in Supabase Dashboard:

1. **Authentication → Providers → Email**
   - ✅ Enable "Email OTP" (not Magic Link)
   - ✅ Set OTP expiry to 3600 seconds (60 minutes)
   - ✅ Disable "Confirm Email" (we handle via OTP)

2. **Authentication → Email Templates**
   - Update "Magic Link" template (used for OTP)
   - Use `{{ .Token }}` variable for 6-digit code

3. **Authentication → URL Configuration**
   - Site URL: `https://yourdomain.com`
   - Redirect URLs: Include /login, /login/callback

---

## Implementation Files

### Frontend
- `/src/routes/login/+page.svelte` - Main login UI
- `/src/routes/login/setup-password/+page.svelte` - Password creation

### Backend
- `/src/lib/server/auth.ts` - Unified auth library (363 lines)
- `/src/routes/api/auth/check-email/+server.js` - Email check endpoint
- `/src/routes/api/admin/users/+server.js` - User creation

---

## Future Improvements

### Security
- [ ] Redis-based rate limiting for horizontal scaling
- [ ] Per-email OTP send rate limit (3 sends per 15 min)
- [ ] Add CAPTCHA on login after N failed attempts
- [ ] IP blocklist for known bad actors
- [ ] Reduce OTP expiry from 60 min to 10-30 min (stricter security)

### UX
- [ ] Automatic "You've been invited" email on user creation
- [ ] Email templates with branded design
- [ ] Dedicated "Forgot Password" flow with email reset link
- [ ] Session activity log (login history per user)
- [ ] Password change interface in `/profile`

### Architecture
- [ ] Add comprehensive test suite for authentication flows
- [ ] Document admin password reset endpoint
- [ ] Consider moving rate limiting to Postgres for persistence

---

## Migration from v1

### What Changed
1. **Removed:** Invitation code requirement
2. **Simplified:** Email → OTP → Password (for new users)
3. **Fixed:** RLS security bug (removed public SELECT on pending_invitations)
4. **Fixed:** Auto-OTP on failed password (now explicit button)

### Migration Steps (All Complete ✅)
1. ✅ Updated `/api/auth/check-email` to allow pending users with OTP
2. ✅ Removed "Have an invitation code?" link from login page
3. ✅ Dropped public SELECT RLS policy on pending_invitations
4. ✅ Added explicit "Send me a login code instead" button
5. ✅ Updated AUTHENTICATION.md to reflect v2 flow
6. ✅ Dropped `platform_invitation_code` table via migration
7. ✅ Dropped `pending_invitations` table via migration
8. ✅ Removed all invitation code UI and API endpoints
9. ✅ Removed `/login/invite` route from public routes

---

**End of Documentation**
