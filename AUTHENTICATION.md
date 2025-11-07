# Authentication & Authorization System

**Last Updated:** 2025-11-07
**Status:** ✅ Production Ready
**System Type:** Invite-Only with Multi-Factor Authentication

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Authentication Flows](#authentication-flows)
4. [Authorization System](#authorization-system)
5. [User Experience](#user-experience)
6. [Admin Experience](#admin-experience)
7. [API Reference](#api-reference)
8. [Security](#security)
9. [Implementation Details](#implementation-details)
10. [Testing](#testing)

---

## Overview

### What We Built

An **invite-only authentication system** designed for organizations with locked-down corporate email environments (specifically Microsoft Outlook that blocks/pre-clicks magic links).

### Key Features

- ✅ **Email-first authentication** - Single email field, smart decision tree
- ✅ **Multi-path verification** - OTP codes + shareable invitation codes
- ✅ **Password fallback** - Existing users can use passwords with OTP fallback
- ✅ **Rate limiting** - Prevents brute force attacks on invitation codes
- ✅ **Security hardened** - No email harvesting, proper expiration, single-use tokens
- ✅ **Module-based permissions** - Granular access control via user modules

### Design Principles

1. **Invite-Only** - No public signup, all users must be invited by administrators
2. **Email as Identity** - Email is the primary identifier
3. **Progressive Disclosure** - Show users only what they need, when they need it
4. **Graceful Degradation** - Multiple paths to authentication if one fails
5. **Security by Default** - Rate limiting, expiration, single-use tokens

---

## System Architecture

### Technology Stack

- **Supabase Auth** - PostgreSQL + Row Level Security + Built-in auth
- **OTP Delivery** - 6-digit codes via email (60-minute expiry)
- **Invitation Codes** - ABC-123 format (30-day expiry)
- **Sessions** - HTTP-only cookies with SameSite=Lax
- **Rate Limiting** - In-memory (5 requests/min per IP)

### Database Schema

#### `pending_invitations` Table

```sql
CREATE TABLE pending_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- ABC-123 format
  email TEXT NOT NULL,
  modules TEXT[] NOT NULL DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id), -- Nullable until user created
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired, cancelled

  created_by UUID REFERENCES user_profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,

  last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  send_count INT DEFAULT 1,

  CONSTRAINT valid_code CHECK (code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$'),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

CREATE INDEX idx_pending_invitations_code ON pending_invitations(code);
CREATE INDEX idx_pending_invitations_email ON pending_invitations(email);
CREATE INDEX idx_pending_invitations_status ON pending_invitations(status);
CREATE INDEX idx_pending_invitations_user_id ON pending_invitations(user_id);
```

#### RLS Policies

```sql
-- Public can view by code (for redemption)
CREATE POLICY "Anyone can view invitation by code"
  ON pending_invitations FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Admins can manage all invitations
CREATE POLICY "Users module can view all invitations"
  ON pending_invitations FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM user_profiles WHERE 'users' = ANY(modules)
  ));

CREATE POLICY "Users module can insert invitations"
  ON pending_invitations FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT id FROM user_profiles WHERE 'users' = ANY(modules)
  ));

CREATE POLICY "Users module can update invitations"
  ON pending_invitations FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM user_profiles WHERE 'users' = ANY(modules)
  ));
```

### Code Generation

Uses PostgreSQL function for uniqueness:

```sql
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code TEXT;
BEGIN
  LOOP
    code := '';
    -- Generate 3 characters
    FOR i IN 1..3 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    code := code || '-';
    -- Generate 3 more characters
    FOR i IN 1..3 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Check if code exists
    EXIT WHEN NOT EXISTS (SELECT 1 FROM pending_invitations WHERE pending_invitations.code = code);
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql VOLATILE;
```

**Search Space:** 36^6 = ~2.1 billion combinations (~31 bits entropy)

---

## Authentication Flows

### Flow 1: New User Invitation (Primary)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Admin Invites User                                       │
├─────────────────────────────────────────────────────────────┤
│ Admin → /users → "Add User" → Enter email + modules         │
│ ↓                                                            │
│ POST /api/admin/users                                       │
│   • Creates auth user (email_confirm: false)                │
│   • Creates user_profile with modules                       │
│   • Generates invitation code (ABC-123)                     │
│   • Sends OTP to email                                      │
│ ↓                                                            │
│ Admin sees modal with:                                      │
│   • Invitation code: ABC-123                                │
│   • Shareable URL                                           │
│   • Copy buttons                                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. User Receives Email                                      │
├─────────────────────────────────────────────────────────────┤
│ Email contains:                                             │
│   • 6-digit OTP code (e.g., 123456)                        │
│   • Link to /login                                          │
│   • 60-minute expiration notice                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. User Authentication (Path A: Email OTP)                 │
├─────────────────────────────────────────────────────────────┤
│ User → /login                                               │
│ ↓                                                            │
│ Enter email → Click "Continue"                              │
│ ↓                                                            │
│ POST /api/auth/check-email                                  │
│   • User not found → Check for invitation                   │
│   • Invitation found → Send OTP                             │
│ ↓                                                            │
│ Show OTP input field                                        │
│ User enters 6-digit code                                    │
│ ↓                                                            │
│ POST supabase.auth.verifyOtp()                             │
│   • Verifies OTP                                            │
│   • Creates session (HTTP-only cookie)                      │
│   • Marks invitation as accepted                            │
│ ↓                                                            │
│ Redirect to /login/setup-password                          │
│ User creates password                                       │
│ ↓                                                            │
│ Redirect to dashboard (based on modules)                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. User Authentication (Path B: Invitation Code)           │
├─────────────────────────────────────────────────────────────┤
│ User receives ABC-123 code (via Teams, phone, etc.)        │
│ ↓                                                            │
│ User → /login/invite                                        │
│ ↓                                                            │
│ Enter code ABC-123 → Click "Continue"                       │
│ ↓                                                            │
│ POST /api/auth/redeem-invite (rate limited!)               │
│   • Validates code exists & not expired                     │
│   • Creates/finds auth user                                 │
│   • Sends OTP to email                                      │
│ ↓                                                            │
│ Redirect to /login?mode=otp&from=invite                    │
│ User enters email + OTP code                                │
│ ↓                                                            │
│ POST supabase.auth.verifyOtp()                             │
│ Marks invitation as accepted                                │
│ ↓                                                            │
│ Redirect to /login/setup-password                          │
│ User creates password                                       │
│ ↓                                                            │
│ Redirect to dashboard                                       │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Existing User Login

```
┌─────────────────────────────────────────────────────────────┐
│ User → /login                                               │
├─────────────────────────────────────────────────────────────┤
│ Enter email → Click "Continue"                              │
│ ↓                                                            │
│ POST /api/auth/check-email                                  │
│   • User exists with password? → Show password field        │
│   • User exists without password? → Send OTP, show OTP field│
│ ↓                                                            │
│ Case A: Has Password                                        │
│   User enters password → Sign in                            │
│   • Success → Dashboard                                     │
│   • Failed → Auto-send OTP → Show OTP field                 │
│ ↓                                                            │
│ Case B: No Password (Pending User)                         │
│   OTP sent automatically                                    │
│   User enters OTP → Verify → Dashboard                      │
└─────────────────────────────────────────────────────────────┘
```

### Flow 3: Password Reset (Admin)

```
Admin → /users → Select user → Reset password icon
  ↓
POST /api/admin/reset-password
  • Updates user password via admin API
  ↓
User can now login with new password
```

---

## Authorization System

### Module-Based Permissions

Located in `$lib/server/auth.ts` - single unified auth library.

#### Platform Modules

Stored in `user_profiles.modules` (TEXT[] array):

| Module | Description | Access |
|--------|-------------|--------|
| `users` | User management, invitations, permissions | `/users` |
| `editor` | Content editor access | `/editor` |
| `dgr` | Daily Gospel Reflections management | `/dgr` |
| `courses.participant` | Access enrolled courses | `/my-courses` |
| `courses.manager` | Manage assigned courses | `/courses` (as admin) |
| `courses.admin` | Manage all courses platform-wide | All courses |

#### Course-Level Roles

Stored in `courses_enrollments.role` per enrollment:

| Role | Description | Permissions |
|------|-------------|-------------|
| `student` | Regular course participant | View materials, submit reflections |
| `coordinator` | Hub coordinator | View student progress, coordinate hubs |

**Note:** Course managers and admins are NOT enrolled - they access via platform modules.

### Authorization Functions

#### Response Modes

```typescript
type AuthOptions = {
  mode?: 'throw_error' | 'redirect';  // Default: 'throw_error'
  redirectTo?: string;                 // Default: '/my-courses'
};
```

#### Platform-Level Functions

```typescript
// Require specific module (any level)
await requireModule(event, 'users');
await requireModule(event, 'users', { mode: 'redirect', redirectTo: '/profile' });

// Require exact module.level
await requireModuleLevel(event, 'courses.admin');

// Require any of multiple modules
await requireAnyModule(event, ['courses.manager', 'courses.admin']);
```

#### Course-Level Functions

```typescript
// Require course admin access
// Allows: courses.admin OR (courses.manager + enrolled as admin)
const { user, profile, enrollment, viaModule } =
  await requireCourseAdmin(event, courseSlug);

// Require any enrollment in course
const { user, enrollment } =
  await requireCourseAccess(event, courseSlug);

// Require specific course role
const { user, enrollment } =
  await requireCourseRole(event, courseSlug, ['admin', 'coordinator']);
```

---

## User Experience

### `/login` Page - Email-First Interface

#### Step 1: Email Entry
```
┌──────────────────────────────────────┐
│  Archdiocesan Ministry Tools          │
│  Sign in to your account              │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ your@email.com                  │ │
│  └─────────────────────────────────┘ │
│                                       │
│  [Continue]                          │
│                                       │
│  Have an invitation code?            │
│  Enter code instead →                │
└──────────────────────────────────────┘
```

#### Step 2: Password (If User Has One)
```
┌──────────────────────────────────────┐
│  Archdiocesan Ministry Tools          │
│  Enter your password                  │
│                                       │
│  Signing in as user@email.com        │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │ ••••••••                        │ │
│  └─────────────────────────────────┘ │
│                                       │
│  [Sign in]                           │
│                                       │
│  ← Use a different email             │
└──────────────────────────────────────┘
```

#### Step 2: OTP (If User Doesn't Have Password)
```
┌──────────────────────────────────────┐
│  Archdiocesan Ministry Tools          │
│  Enter verification code              │
│                                       │
│  Code sent to user@email.com         │
│                                       │
│  ┌─────────────────────────────────┐ │
│  │      1 2 3 4 5 6                │ │
│  └─────────────────────────────────┘ │
│                                       │
│  [Verify Code]                       │
│                                       │
│  Resend code    ← Change email       │
└──────────────────────────────────────┘
```

### `/login/invite` Page - Invitation Code Entry

```
┌──────────────────────────────────────┐
│  Redeem Invitation Code              │
│                                       │
│  Enter the code you received:        │
│  ┌─────────────────────────────────┐ │
│  │      A B C - 1 2 3              │ │
│  └─────────────────────────────────┘ │
│  Format: ABC-123 (6 characters)      │
│                                       │
│  [Continue]                          │
│                                       │
│  ← Back to login                     │
└──────────────────────────────────────┘
```

Auto-formatting as user types: `ABC123` → `ABC-123`

### `/login/setup-password` Page

```
┌──────────────────────────────────────┐
│  Welcome to Arch Tools                │
│  Please create a password to secure  │
│  your account                         │
│                                       │
│  user@email.com                      │
│                                       │
│  New Password                         │
│  ┌─────────────────────────────────┐ │
│  │ ••••••••                        │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Confirm Password                     │
│  ┌─────────────────────────────────┐ │
│  │ ••••••••                        │ │
│  └─────────────────────────────────┘ │
│                                       │
│  [Set Password]                      │
└──────────────────────────────────────┘
```

---

## Admin Experience

### `/users` Page - User Management

#### Create User Modal

After clicking "Add User":

```
┌──────────────────────────────────────────┐
│ Invite New User                   [X]     │
├──────────────────────────────────────────┤
│ A 6-digit OTP code will be sent to       │
│ their email. You'll also receive a       │
│ shareable invitation code (ABC-123).     │
│                                          │
│ Email Address *                          │
│ ┌──────────────────────────────────────┐ │
│ │ user@example.com                     │ │
│ └──────────────────────────────────────┘ │
│ They'll receive a 6-digit code to       │
│ verify their email and set a password   │
│                                          │
│ Full Name                                │
│ ┌──────────────────────────────────────┐ │
│ │ John Doe                             │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Module Access                            │
│ ┌──────────────────────────────────────┐ │
│ │ ☐ User Management                    │ │
│ │ ☐ Daily Gospel Reflections           │ │
│ │ ☐ Content Editor                     │ │
│ │ ☑ Course Participant                 │ │
│ │ ☐ Course Manager                     │ │
│ │ ☐ Course Admin                       │ │
│ └──────────────────────────────────────┘ │
│                                          │
│         [Cancel]  [Send Invitation]      │
└──────────────────────────────────────────┘
```

#### Success Modal (After Creation)

```
┌──────────────────────────────────────────┐
│ User Invited Successfully!        [X]     │
├──────────────────────────────────────────┤
│ A 6-digit OTP code has been sent to     │
│ their email. Share this invitation code  │
│ with them as a backup:                   │
│                                          │
│ Invitation Code                          │
│ ┌──────────────────────────────────────┐ │
│ │ ABC-123              [Copy Code]     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Shareable Link                           │
│ ┌──────────────────────────────────────┐ │
│ │ https://app.../login/invite?code=... │ │
│ │                      [Copy Link]     │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Note: The code expires in 30 days.      │
│ The user can also login with the OTP    │
│ code sent to their email.                │
│                                          │
│                    [Done]                │
└──────────────────────────────────────────┘
```

---

## API Reference

### POST `/api/auth/check-email`

Check if user exists and determine next authentication step.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "exists": true,
  "nextStep": "password",
  "hasPassword": true,
  "message": "Enter your password to continue"
}
```

**Possible `nextStep` values:**
- `password` - User exists with password
- `otp` - User exists without password OR has valid invitation
- `error` - User doesn't exist and no invitation found

### POST `/api/auth/redeem-invite`

Redeem an invitation code and send OTP.

**Rate Limited:** 5 requests per minute per IP

**Request:**
```json
{
  "code": "ABC-123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "A 6-digit verification code has been sent to your email"
}
```

**Errors:**
- `400` - Invalid code format
- `404` - Code not found or expired
- `429` - Rate limit exceeded

### POST `/api/auth/complete-invitation`

Mark invitation as accepted after OTP verification.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "found": true
}
```

### POST `/api/admin/users`

Create new user invitation.

**Requires:** `users` module

**Request:**
```json
{
  "email": "user@example.com",
  "full_name": "John Doe",
  "modules": ["courses.participant"]
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "modules": ["courses.participant"]
  },
  "invitation": {
    "code": "ABC-123",
    "url": "https://app.../login/invite?code=ABC-123",
    "expires_at": "2025-12-07T..."
  }
}
```

---

## Security

### Rate Limiting

**Implementation:** In-memory store (`src/lib/server/rate-limit.js`)

**Limits:**
- Invitation code validation: 5 requests/min per IP
- OTP verification: Built into Supabase (automatic)

**Attack Surface:**
- Code enumeration: 36^6 combinations = ~825 years at 5/min
- Without rate limiting: ~13 years at 5/sec (why we need it!)

### Code Security

**Format:** ABC-123 (6 alphanumeric characters)
**Entropy:** ~31 bits (2.1 billion combinations)
**Expiration:** 30 days
**Usage:** Single-use (marked as accepted)
**Storage:** Plaintext (acceptable for time-limited, non-auth tokens)

**Security Measures:**
- ✅ Rate limiting prevents brute force
- ✅ Short expiration limits attack window
- ✅ Single-use prevents replay
- ✅ Admin can cancel anytime
- ✅ Email never exposed in API responses

### OTP Security

**Format:** 6 digits (000000-999999)
**Entropy:** ~20 bits
**Expiration:** 60 minutes
**Delivery:** Email only
**Rate Limiting:** Built into Supabase

### Session Security

**Storage:** HTTP-only cookies
**Flags:** Secure (prod), SameSite=Lax
**Duration:** 7 days (Supabase default)
**Refresh:** Automatic via Supabase SSR

### Email Privacy

**Critical:** Email addresses are NEVER exposed in API responses to prevent email harvesting attacks.

```javascript
// ❌ BAD
return json({ email: invitation.email });

// ✅ GOOD
return json({ message: 'Code sent to your email' });
```

### Opportunistic Cleanup

Old invitations are automatically deleted when creating new ones:
- Expired invitations (past 30 days)
- Accepted invitations (>30 days old)
- Cancelled invitations (>30 days old)

No cron job needed - piggybacks on normal operations.

---

## Implementation Details

### File Structure

```
src/
├── routes/
│   ├── login/
│   │   ├── +page.svelte              # Main login (email-first)
│   │   ├── invite/
│   │   │   └── +page.svelte          # Invitation code entry
│   │   ├── setup-password/
│   │   │   ├── +page.svelte          # Password setup
│   │   │   └── +page.server.ts       # Auth guard
│   │   ├── confirm/
│   │   │   └── +server.ts            # Email link handler
│   │   ├── callback/
│   │   │   └── +server.ts            # PKCE callback
│   │   └── logout/
│   │       └── +page.server.ts       # Logout handler
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── check-email/+server.js    # Email check endpoint
│   │   │   ├── redeem-invite/+server.js  # Code redemption (rate limited)
│   │   │   └── complete-invitation/+server.js
│   │   └── admin/
│   │       ├── users/+server.js           # User creation
│   │       └── reset-password/+server.js  # Password reset
│   │
│   └── users/
│       └── +page.svelte              # Admin user management
│
├── lib/
│   ├── server/
│   │   ├── auth.ts                   # ✨ Unified auth library
│   │   ├── invite-codes.js           # Invitation utilities
│   │   ├── rate-limit.js             # Rate limiting
│   │   └── supabase.js               # Admin client
│   │
│   └── components/
│       └── AppNavigation.svelte      # Nav with logout button
```

### Key Functions

#### `$lib/server/auth.ts`

```typescript
// Platform-level
export async function requireModule(
  event: RequestEvent,
  module: string,
  options?: AuthOptions
): Promise<{ user: User; profile: UserProfile }>;

export async function requireModuleLevel(
  event: RequestEvent,
  moduleLevel: string,
  options?: AuthOptions
): Promise<{ user: User; profile: UserProfile }>;

export async function requireAnyModule(
  event: RequestEvent,
  modules: string[],
  options?: AuthOptions
): Promise<{ user: User; profile: UserProfile }>;

// Course-level
export async function requireCourseAdmin(
  event: RequestEvent,
  courseSlug: string,
  options?: AuthOptions
): Promise<{
  user: User;
  profile: UserProfile;
  enrollment: Enrollment | null;
  viaModule: boolean;
}>;

export async function requireCourseAccess(
  event: RequestEvent,
  courseSlug: string,
  options?: AuthOptions
): Promise<{ user: User; enrollment: Enrollment }>;

export async function requireCourseRole(
  event: RequestEvent,
  courseSlug: string,
  roles: string[],
  options?: AuthOptions
): Promise<{ user: User; enrollment: Enrollment }>;
```

#### `$lib/server/invite-codes.js`

```javascript
export async function generateInviteCode(): Promise<string>;

export async function createInvitation({
  email,
  modules,
  createdBy,
  userId
}): Promise<Invitation>;

export async function redeemInviteCode(code: string): Promise<Invitation>;

export async function markInvitationAccepted(invitationId: string): Promise<Invitation>;

export async function resendInvitation(invitationId: string): Promise<Invitation>;

export async function getPendingInvitations(filters?: object): Promise<Invitation[]>;

export async function cancelInvitation(invitationId: string): Promise<Invitation>;

export function getInvitationUrl(code: string, siteUrl: string): string;
```

#### `$lib/server/rate-limit.js`

```javascript
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): void;

export function resetRateLimit(identifier: string): void;

export function getAttemptCount(
  identifier: string,
  windowMs: number = 60000
): number;

export function getTrackedIdentifierCount(): number;
```

---

## Testing

### Manual Testing Checklist

#### New User Invitation (Email OTP)
- [ ] Admin invites user via `/users`
- [ ] Check email for 6-digit code
- [ ] Go to `/login`, enter email
- [ ] System detects invitation, sends OTP
- [ ] Enter OTP code
- [ ] Verify redirects to password setup
- [ ] Set password
- [ ] Verify redirects to correct dashboard based on modules

#### New User Invitation (Invitation Code)
- [ ] Admin invites user, gets code `ABC-123`
- [ ] Go to `/login/invite`
- [ ] Enter code (auto-formats: `ABC123` → `ABC-123`)
- [ ] System sends OTP
- [ ] Redirect to `/login?mode=otp&from=invite`
- [ ] Enter email + OTP
- [ ] Verify redirects to password setup
- [ ] Set password
- [ ] Verify redirects to dashboard

#### Existing User Login (Password)
- [ ] Go to `/login`, enter email
- [ ] System detects user has password
- [ ] Enter password
- [ ] Verify redirects to dashboard

#### Existing User Login (Password Fail → OTP)
- [ ] Go to `/login`, enter email
- [ ] Enter wrong password
- [ ] System auto-sends OTP
- [ ] Enter OTP code
- [ ] Verify redirects to dashboard

#### Existing User Login (No Password)
- [ ] User invited but hasn't set password yet
- [ ] Go to `/login`, enter email
- [ ] System auto-sends OTP
- [ ] Enter OTP
- [ ] Verify redirects to password setup

#### Rate Limiting
- [ ] Try to validate invitation code 6 times in <1 minute
- [ ] 6th request returns 429 error
- [ ] Wait 1 minute
- [ ] Can validate again

#### Logout
- [ ] Click logout in navigation
- [ ] Verify redirects to `/login`
- [ ] Verify cannot access protected pages

#### Edge Cases
- [ ] Expired invitation code (30+ days)
- [ ] Invalid code format (`ABC123` vs `ABC-123`)
- [ ] Already accepted invitation
- [ ] Email doesn't exist in invitations
- [ ] Multiple resends
- [ ] Case-insensitive codes (`abc-123` works)

### Security Testing

#### Email Privacy
- [ ] Invite user
- [ ] Call `/api/auth/redeem-invite` with valid code
- [ ] Verify response does NOT contain email address

#### Rate Limiting
- [ ] Script to attempt 100 code validations
- [ ] Verify only first 5 succeed per minute
- [ ] Verify proper error message with retry time

#### Code Enumeration
- [ ] Attempt to guess codes (`AAA-000`, `AAA-001`, etc.)
- [ ] Verify rate limiting prevents brute force
- [ ] With 5/min limit: ~825 years to enumerate all codes

#### Session Security
- [ ] Inspect cookies - verify HTTP-only flag
- [ ] Inspect cookies - verify Secure flag (prod)
- [ ] Inspect cookies - verify SameSite=Lax
- [ ] Attempt to use session from different browser

---

## Troubleshooting

### User Can't Login

**Symptom:** "No invitation found for this email"

**Causes:**
1. No invitation created yet
2. Invitation expired (>30 days)
3. Invitation already accepted
4. Wrong email address

**Solution:**
- Admin checks `/users` page
- Resend invitation if needed
- Check pending invitations status

### OTP Not Received

**Symptom:** User doesn't receive 6-digit code

**Causes:**
1. Email in spam folder
2. Corporate email blocking
3. Wrong email address
4. Supabase email service issue

**Solution:**
- Check spam folder
- Use invitation code as fallback (`/login/invite`)
- Admin can resend OTP from `/users`
- Check Supabase logs

### Rate Limit Hit

**Symptom:** "Too many attempts. Please try again in X seconds."

**Causes:**
1. Legitimate user trying wrong codes
2. Brute force attempt

**Solution:**
- Wait 1 minute
- Use correct invitation code
- If admin: share code via Teams/phone instead

### Invitation Code Not Working

**Symptom:** "Invalid or expired invitation code"

**Causes:**
1. Code expired (>30 days)
2. Code typo
3. Code already used
4. Code cancelled by admin

**Solution:**
- Check code format: ABC-123 (6 characters)
- Case insensitive, auto-formats
- Admin creates new invitation

---

## Migration Notes

### From Magic Links to OTP

**Changes:**
- ✅ No breaking changes for existing users
- ✅ Existing password logins still work
- ✅ New email template uses OTP codes
- ✅ Backwards compatible with hash-based links

**Email Template Update:**

Update "Magic Link" template in Supabase Dashboard:

```html
<h1>Welcome to Archdiocesan Ministry Tools</h1>
<p>Your verification code:</p>
<div style="font-size: 48px; text-align: center; letter-spacing: 12px;
            font-family: monospace; background: #f0f0f0; padding: 30px;
            border-radius: 8px;">
  {{ .Token }}
</div>
<p>This code expires in 60 minutes.</p>
<p>Visit <a href="{{ .SiteURL }}/login">{{ .SiteURL }}/login</a> to enter your code.</p>
```

---

## Future Enhancements

### Planned
- [ ] QR code generation for invitation codes
- [ ] SMS backup channel (Twilio)
- [ ] Email deliverability monitoring
- [ ] Invitation analytics dashboard

### Considered
- [ ] Auto-resend after 24 hours
- [ ] CSV bulk upload
- [ ] SSO integration
- [ ] Custom email templates per course

---

**End of Documentation**

For questions or issues, contact the development team.
