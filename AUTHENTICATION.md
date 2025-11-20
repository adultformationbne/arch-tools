# Authentication & Authorization System

> **📌 Single Source of Truth** - This is the authoritative documentation for the authentication system. All previous docs (v1, security audits, changelogs) have been removed.

**Last Updated:** 2025-11-17
**Status:** ✅ Production Ready
**System Type:** Invite-Only with Email + OTP

---

## Overview

This is an **invite-only authentication system** where:
1. Admins pre-create user accounts (platform users OR course enrollments)
2. Users login with their email at `/login`
3. System sends 6-digit OTP to verify email ownership
4. New users set a password; existing users can use password or OTP

**No invitation codes or tokens** - users just need their email address.

**No automatic emails** - admins inform users directly via their preferred channel.

---

## Core Flow

### For New Users (Pending)

```
Admin creates user via /users OR bulk imports course enrollment
  ↓
Auth account created immediately (auth.users + user_profiles)
  ↓
Admin tells user: "Visit [site]/login with your email"
  ↓
User visits /login → Enters email → Clicks "Continue"
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
Redirect to dashboard based on modules/enrollments
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

## User Creation Methods

### Method 1: Platform Users (`/users` page)

**Who:** Platform admins with `users` module
**Creates:** Users with platform-level modules (users, editor, dgr, courses.admin, etc.)

**Process:**
1. Admin clicks "Add User"
2. Enters email, name, modules
3. Clicks "Send Invitation" (creates auth account, no email sent)
4. User created with status: pending (no password)
5. Admin informs user directly: "Login at [site]/login with: youremail@example.com"

### Method 2: Course Enrollments (Bulk CSV Import)

**Who:** Course admins
**Creates:** Users enrolled in specific courses with `courses.participant` module

**Process:**
1. Admin uploads CSV with email, full_name, hub, cohort
2. System creates auth accounts for all new emails
3. System creates user_profiles with `courses.participant` module
4. System creates course enrollments linked to user_profile_id
5. Admin informs students: "Login at [site]/login with your email"

**Both methods create users the same way** - auth.users account immediately, no emails, users login via `/login`.

---

## Security Model

### 1. Pre-Invited Accounts Only
- Users **must** be pre-created by admins
- No self-registration
- Admin controls who has access
- Two creation methods: platform users or course enrollments

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
- `full_name` (TEXT) - User's full name
- `modules` (TEXT[]) - Permission modules
- `assigned_course_ids` (JSONB) - For courses.manager module

### `auth.users` (Supabase Auth)
- `email` - User email
- `encrypted_password` - NULL if no password set yet (pending user)
- Managed by Supabase Auth

### `courses_enrollments`
- `user_profile_id` (UUID) - Links to user_profiles
- `email` (TEXT) - Denormalized for performance
- `full_name` (TEXT) - User's name
- `cohort_id` (UUID) - Which cohort they're in
- `role` (TEXT) - 'student', 'admin', 'coordinator'
- `status` (TEXT) - 'pending', 'active', 'completed', 'withdrawn'

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

### `POST /api/admin/users`
**Purpose:** Create platform user
**Auth:** Requires `users` module
**Creates:** auth.users + user_profiles with specified modules

### `POST /admin/courses/[slug]/api` (action: upload_csv)
**Purpose:** Bulk import course enrollments
**Auth:** Requires course admin access
**Creates:** auth.users + user_profiles + courses_enrollments

---

## Module-Based Authorization

### Platform Modules (in `user_profiles.modules`)

| Module | Access |
|--------|--------|
| `users` | **Platform admin** - Manage all users, create users, manage all permissions (highest platform privilege) |
| `editor` | Content editor access |
| `dgr` | Daily Gospel Reflections management |
| `courses.participant` | Access enrolled courses (auto-assigned on course import) |
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

### Creating Platform Users (`/users` page)

1. Click "Add User"
2. Enter email, name, modules
3. Click "Send Invitation"
4. User created in pending state (no password)
5. **No automatic email sent** - Admins communicate directly
6. Admin tells user: "Visit [site]/login and sign in with your email address"

### Enrolling Course Students (Bulk CSV Import)

1. Navigate to course cohort management
2. Click "Add Participants"
3. Upload CSV with: email, full_name, hub (optional)
4. System processes each row:
   - Creates auth account if user doesn't exist
   - Creates user_profiles if doesn't exist
   - Assigns `courses.participant` module
   - Creates enrollment record
5. **No automatic email sent** - Admins communicate directly
6. Admin tells students: "Login at [site]/login with your email"

**Key Point:** Both methods create real auth accounts immediately. Users can login right away at `/login`.

---

## Known Limitations & Trade-offs

### 1. Email Enumeration
**Reality:** The system reveals if an email exists or not.

**Why it's acceptable:** This is an invite-only B2B system where:
- Only pre-invited emails exist
- Target users are known staff/members/students
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

### 4. No Automatic Emails
**Reality:** System doesn't send invitation emails automatically.

**Why it's acceptable:**
- Admins control communication channels
- Avoids email delivery issues
- More flexible (SMS, in-person, phone, etc.)

**Future:** Optional email notifications can be added later.

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

### Backend - Platform Users
- `/src/lib/server/auth.ts` - Unified auth library
- `/src/routes/api/auth/check-email/+server.js` - Email check endpoint
- `/src/routes/api/admin/users/+server.js` - Platform user creation

### Backend - Course Enrollments
- `/src/routes/admin/courses/[slug]/api/+server.ts` - Bulk CSV import (upload_csv action)
- Creates auth accounts exactly like platform user creation

---

## Future Improvements

### Security
- [ ] Redis-based rate limiting for horizontal scaling
- [ ] Per-email OTP send rate limit (3 sends per 15 min)
- [ ] Add CAPTCHA on login after N failed attempts
- [ ] IP blocklist for known bad actors
- [ ] Reduce OTP expiry from 60 min to 10-30 min (stricter security)

### UX
- [ ] Optional "You've been invited" email on user creation
- [ ] Email templates with branded design
- [ ] Dedicated "Forgot Password" flow with email reset link
- [ ] Session activity log (login history per user)
- [ ] Password change interface in `/profile`

### Architecture
- [ ] Add comprehensive test suite for authentication flows
- [ ] Document admin password reset endpoint
- [ ] Consider moving rate limiting to Postgres for persistence

---

## Migration History

### v2 - Unified Authentication (2025-11-17)
1. ✅ Unified course enrollments with platform user auth
2. ✅ Course bulk imports now create auth accounts immediately
3. ✅ Removed `invitation_token` from courses_enrollments
4. ✅ Removed all email-sending on user creation
5. ✅ Removed `/signup` route
6. ✅ Deleted `sendBulkInvitations()` and invitation email functions
7. ✅ Everything through `/login` - single unified flow

### v1 Migration (2025-11-13)
1. ✅ Removed invitation code requirement
2. ✅ Simplified to: Email → OTP → Password (for new users)
3. ✅ Fixed RLS security bug (removed public SELECT on pending_invitations)
4. ✅ Fixed auto-OTP on failed password (now explicit button)
5. ✅ Dropped `platform_invitation_code` table
6. ✅ Dropped `pending_invitations` table
7. ✅ Removed all invitation code UI and API endpoints
8. ✅ Removed `/login/invite` route

---

## Summary

**One System. One Flow. One Source of Truth.**

- Platform users (via `/users`) → auth account created → admin tells user → `/login`
- Course students (via CSV import) → auth account created → admin tells user → `/login`
- No invitation tokens
- No automatic emails
- Everything goes through `/login`

Simple. Consistent. Production-ready. 🎯

---

**End of Documentation**
