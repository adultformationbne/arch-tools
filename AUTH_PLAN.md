# Authentication System Overhaul - Implementation Plan

**Date:** November 2025
**Status:** In Progress
**Goal:** Create Slack-style invite system with QR codes for ACCF bulk invitations

---

## Problem Statement

### Current Issues:
1. **Email links don't work** - ACCF staff use locked-down Outlook that blocks/pre-clicks magic links
2. **Bulk invites fail** - Corporate email scanners break authentication links
3. **Confusing UX** - Users don't know if they're "new" or "existing"
4. **No fallback** - If email fails, there's no alternative path

### Target Users:
- **ACCF Staff** - Mix of Outlook (corporate) and personal emails
- **Bulk invitations** - Need to invite 50-100+ people at once
- **Non-technical users** - Need simple, foolproof process

---

## Solution: Three-Path Authentication

### Research-Based Design
Based on analysis of **Slack, Microsoft Teams, and Notion**, we're implementing:

1. **Primary Path:** Email with 6-digit OTP code
2. **Fallback Path:** Shareable invite codes (ABC-123)
3. **Mobile Path:** QR codes for phone-based signup

---

## Authentication Flows

### Flow 1: Email OTP (Primary)

```
Admin invites user
    ↓
System creates auth user + invitation record
    ↓
Email sent with 6-digit OTP code
    ↓
User goes to /auth
    ↓
User enters email + OTP
    ↓
System verifies OTP → Creates session
    ↓
├─ New user? → /auth/setup-password → Dashboard
└─ Existing user? → Dashboard directly
```

**Why OTP?**
- ✅ Works with Outlook email scanners (can't "click" a code)
- ✅ Familiar pattern (like 2FA)
- ✅ More secure than magic links
- ✅ Survives email forwarding/scanning

### Flow 2: Invite Code (Fallback)

```
Admin invites user
    ↓
System generates code: ABC-123
    ↓
Admin clicks "Get Code" or "Show QR"
    ↓
Admin shares via:
  ├─ Teams message
  ├─ Phone call
  ├─ In-person QR code scan
  └─ Printed handout
    ↓
User goes to /auth/invite
    ↓
User enters ABC-123
    ↓
System sends OTP to user's email
    ↓
User enters OTP
    ↓
Session created → Password setup → Dashboard
```

**Why Invite Codes?**
- ✅ Zero dependency on email delivery
- ✅ Can be shared via any channel
- ✅ Works when email completely fails
- ✅ Admin has full control

### Flow 3: QR Code (Mobile-First)

```
Admin invites user
    ↓
System generates QR code containing:
  https://app.domain.com/auth/invite?code=ABC-123
    ↓
Admin displays/prints/emails QR code
    ↓
User scans with phone
    ↓
Opens /auth/invite with pre-filled code
    ↓
Auto-sends OTP to email
    ↓
User enters OTP on phone
    ↓
Password setup on phone → Dashboard
```

**Why QR Codes?**
- ✅ Perfect for in-person onboarding
- ✅ No typing required
- ✅ Works when corporate computer blocks everything
- ✅ Can use personal phone

---

## Database Schema

### New Table: `pending_invitations`

```sql
create table public.pending_invitations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- ABC-123 format
  email text not null,
  modules text[] not null default '{}',
  user_id uuid references auth.users(id), -- Links to created auth user
  status text not null default 'pending', -- pending, accepted, expired, cancelled

  created_by uuid references public.user_profiles(id),
  created_at timestamptz default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_at timestamptz,

  last_sent_at timestamptz default now(), -- Last OTP/email send
  send_count int default 1,               -- Track resends

  constraint valid_code check (code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$')
);
```

**Indexes:**
- `code` (unique lookup)
- `email` (user search)
- `status` (pending invitations query)
- `created_by` (admin dashboard filter)

**Lifecycle:**
1. **Created** - When admin invites user
2. **Pending** - Awaiting user acceptance (30 days)
3. **Accepted** - User completed signup
4. **Expired** - Past 30 days
5. **Cancelled** - Admin revoked invitation

---

## Admin Experience

### Updated `/users` Page

**Current Features:**
- List all users
- Invite new user (sends OTP email)
- Edit user modules
- Delete user

**New Features:**

#### 1. Pending Invitations Section
```
┌─────────────────────────────────────────────────────────────────┐
│ Pending Invitations (23)                    [Filter ▼] [Resend All]│
├─────────────────────────────────────────────────────────────────┤
│ Email              │ Sent     │ Status      │ Actions            │
├─────────────────────────────────────────────────────────────────┤
│ user@company.com   │ 2d ago   │ Not opened  │ [Resend] [Code] [QR]│
│ admin@org.com      │ 5d ago   │ Bounced     │ [Resend] [Code] [QR]│
│ staff@diocese.com  │ 12h ago  │ Opened      │ [Resend] [Code] [QR]│
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Action Buttons

**Resend Button:**
- Sends new OTP email
- Increments `send_count`
- Updates `last_sent_at`
- Shows toast: "OTP resent to user@email.com"

**Get Code Button:**
- Copies `ABC-123` to clipboard
- Shows modal with:
  - Code in large text
  - Shareable URL: `https://app.domain.com/auth/invite?code=ABC-123`
  - Copy buttons for both
- Toast: "Code copied to clipboard"

**Show QR Button:**
- Generates QR code on-the-fly
- Shows modal with:
  - Large QR code image
  - "Scan with phone to sign up"
  - Download button (PNG)
  - Print button
- Can email QR code image

#### 3. Bulk Actions
```
[Select All]
☑ user1@email.com
☑ user2@email.com
☐ user3@email.com

[Resend Selected (2)] [Cancel Selected]
```

#### 4. Success Response Enhancement

When admin invites user, show immediate feedback:

```
✓ Invitation sent to user@company.com

📧 OTP code sent via email
🔗 Invite code: ABC-123 [Copy]
📱 [Show QR Code]

Share this code if email doesn't work.
Expires in 30 days.
```

---

## User Experience

### Updated `/auth` Page - Unified Interface

**Current:** Separate "Sign In" vs "Sign Up" toggle
**New:** Single email-first interface

```
┌──────────────────────────────────────┐
│  Welcome to Archdiocesan Ministry    │
│                                       │
│  Enter your email to continue         │
│  ┌─────────────────────────────────┐ │
│  │ your@email.com                  │ │
│  └─────────────────────────────────┘ │
│                                       │
│  Password (if you have one)          │
│  ┌─────────────────────────────────┐ │
│  │ ••••••••                        │ │
│  └─────────────────────────────────┘ │
│                                       │
│  [Continue]                          │
│                                       │
│  Have an invitation code?            │
│  [Enter code instead] →              │
└──────────────────────────────────────┘
```

**Backend Logic (Smart Detection):**

```javascript
// User clicks Continue
const { email, password } = formData;

// Check if user exists
const existingUser = await checkUserExists(email);

if (password) {
  // Has password → Try password login
  const { data, error } = await signInWithPassword({ email, password });

  if (error) {
    // Failed → Suggest OTP or invite code
    showError("Invalid password. Did you receive an invitation code?");
  } else {
    // Success → Dashboard
    redirectToDashboard();
  }
} else {
  // No password provided
  if (existingUser) {
    // Existing user without password → Send OTP
    await sendOTP(email);
    showOTPInput();
  } else {
    // New user → Check for invitation
    const invitation = await checkInvitation(email);

    if (invitation) {
      // Valid invite → Send OTP
      await sendOTP(email);
      showOTPInput();
    } else {
      // No invite → Show error
      showError("No invitation found. Contact your administrator.");
    }
  }
}
```

**Progressive Disclosure:**
- Start with email (optional password)
- If needed, show OTP input
- If needed, show password setup
- Minimize steps, maximize clarity

### New `/auth/invite` Page

Dedicated page for invite code redemption:

```
┌──────────────────────────────────────┐
│  Redeem Invitation Code              │
│                                       │
│  Enter the code you received:        │
│  ┌─────────────────────────────────┐ │
│  │      A B C - 1 2 3              │ │ (large, centered)
│  └─────────────────────────────────┘ │
│                                       │
│  [Continue]                          │
│                                       │
│  Don't have a code?                  │
│  Contact your administrator          │
└──────────────────────────────────────┘
```

**Auto-format as user types:**
- `ABC123` → `ABC-123`
- Uppercase automatically
- Max 6 characters + dash

**After code validation:**
- Send OTP to email
- Show OTP input on same page
- User enters 6-digit code
- Session created
- Redirect to password setup or dashboard

---

## Email Templates

### Magic Link Template (Used for OTP)

Update in Supabase Dashboard → Auth → Email Templates → Magic Link

```html
<h1>Welcome to Archdiocesan Ministry Tools</h1>

<p>You've been invited to join the platform.</p>

<p>Your verification code:</p>

<div style="font-size: 48px; text-align: center; letter-spacing: 12px;
            font-family: monospace; background: #f0f0f0; padding: 30px;
            border-radius: 8px; margin: 30px 0;">
  {{ .Token }}
</div>

<p style="text-align: center; color: #666;">
  This code expires in 60 minutes.
</p>

<p>
  Visit <a href="{{ .SiteURL }}/auth">{{ .SiteURL }}/auth</a>
  to enter your code.
</p>

<p style="font-size: 12px; color: #999;">
  If you didn't request this code, you can safely ignore this email.
</p>
```

**Variables Available:**
- `{{ .Token }}` - 6-digit OTP code
- `{{ .SiteURL }}` - Your app URL
- `{{ .Email }}` - Recipient email

---

## QR Code Implementation

### Technology: `qrcode` npm package

```bash
npm install qrcode
```

### Server-Side Generation

```javascript
// src/lib/server/qr-codes.js
import QRCode from 'qrcode';

export async function generateInviteQR(code, siteUrl) {
  const url = `${siteUrl}/auth/invite?code=${code}`;

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  return qrDataUrl;
}
```

### Admin UI Component

```svelte
<!-- QRCodeModal.svelte -->
<script>
  let { invitation, isOpen, onClose } = $props();
  let qrCode = $state('');

  async function loadQR() {
    const res = await fetch(`/api/invitations/${invitation.id}/qr`);
    const { qrDataUrl } = await res.json();
    qrCode = qrDataUrl;
  }

  $effect(() => {
    if (isOpen) loadQR();
  });
</script>

{#if isOpen}
  <Modal title="Invitation QR Code" {onClose}>
    <div class="text-center space-y-4">
      <p class="text-gray-600">
        Scan this code with a phone to sign up
      </p>

      {#if qrCode}
        <img src={qrCode} alt="QR Code" class="mx-auto" />
      {:else}
        <p>Loading...</p>
      {/if}

      <p class="text-sm text-gray-500 font-mono">
        Code: {invitation.code}
      </p>

      <div class="flex gap-2 justify-center">
        <button onclick={downloadQR}>Download PNG</button>
        <button onclick={printQR}>Print</button>
        <button onclick={emailQR}>Email QR Code</button>
      </div>
    </div>
  </Modal>
{/if}
```

---

## API Endpoints

### New/Modified Endpoints

#### `POST /api/admin/users`
**Change:** Now creates invitation record with code

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
    "url": "https://app.domain.com/auth/invite?code=ABC-123",
    "expires_at": "2025-12-07T..."
  }
}
```

#### `POST /api/auth/redeem-invite`
**New endpoint** for code redemption

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
  "email": "user@example.com",
  "otp_sent": true
}
```

#### `GET /api/invitations`
**New endpoint** for admin dashboard

**Response:**
```json
{
  "invitations": [
    {
      "id": "uuid",
      "code": "ABC-123",
      "email": "user@example.com",
      "status": "pending",
      "created_at": "...",
      "expires_at": "...",
      "send_count": 2,
      "last_sent_at": "..."
    }
  ]
}
```

#### `POST /api/invitations/{id}/resend`
**New endpoint** to resend OTP

**Response:**
```json
{
  "success": true,
  "message": "OTP resent successfully"
}
```

#### `GET /api/invitations/{id}/qr`
**New endpoint** to get QR code

**Response:**
```json
{
  "qrDataUrl": "data:image/png;base64,..."
}
```

---

## Implementation Phases

### ✅ Phase 1: Foundation (Completed)
- [x] Create `pending_invitations` table
- [x] Add invite code generation utilities
- [x] Update user invitation API to create codes
- [x] Basic `/auth/invite` page

### 🚧 Phase 2: Core Flows (In Progress)
- [ ] Complete `/auth/invite` with OTP verification
- [ ] Update `/auth` page with unified interface
- [ ] Add QR code generation
- [ ] Create admin pending invitations dashboard

### 📋 Phase 3: Admin UX (Next)
- [ ] Add "Get Code" and "Show QR" buttons to users page
- [ ] Build invitation success modal with code/QR
- [ ] Add resend functionality
- [ ] Bulk actions support

### 🔮 Phase 4: Polish (Future)
- [ ] Auto-resend after 24 hours (cron job)
- [ ] Email deliverability monitoring
- [ ] Invitation analytics (acceptance rate)
- [ ] CSV bulk upload

### 🚀 Phase 5: Advanced (Optional)
- [ ] SMS backup channel (Twilio)
- [ ] SSO integration
- [ ] Custom email templates per course

---

## Testing Checklist

### Manual Testing

**Email OTP Flow:**
- [ ] Admin invites new user
- [ ] Check email for 6-digit code
- [ ] Enter email + OTP at `/auth`
- [ ] Verify redirects to password setup
- [ ] Set password
- [ ] Verify redirects to correct dashboard

**Invite Code Flow:**
- [ ] Admin invites user, gets code `ABC-123`
- [ ] Go to `/auth/invite?code=ABC-123`
- [ ] Code auto-fills
- [ ] Submit and receive OTP
- [ ] Enter OTP
- [ ] Complete password setup

**QR Code Flow:**
- [ ] Admin shows QR code
- [ ] Scan with phone
- [ ] Opens `/auth/invite` with code
- [ ] Complete on phone

**Existing User Flow:**
- [ ] Existing user gets OTP
- [ ] Enters OTP
- [ ] Skips password setup
- [ ] Goes directly to dashboard

**Edge Cases:**
- [ ] Expired code (30+ days)
- [ ] Invalid code format
- [ ] Already accepted invitation
- [ ] Email doesn't exist in invitations
- [ ] Multiple resends
- [ ] Code works case-insensitive

---

## Security Considerations

### Code Security
- ✅ Codes are short but have 32^6 = ~1 billion combinations
- ✅ 30-day expiration limits attack window
- ✅ One-time use (marked as accepted)
- ✅ Can be cancelled by admin

### OTP Security
- ✅ 6-digit codes with 60-minute expiration
- ✅ Single-use tokens
- ✅ Rate limiting built into Supabase
- ✅ PKCE flow with `token_hash`

### Session Security
- ✅ HTTP-only cookies
- ✅ Secure flag in production
- ✅ SameSite=Lax
- ✅ Server-side verification

### RLS Policies
- ✅ Only users with `users` module can view invitations
- ✅ Public can view invitation by code (for redemption only)
- ✅ All mutations require `users` module
- ✅ Expired invitations not accessible

---

## Monitoring & Metrics

### Track These Metrics:

**Invitation Success Rate:**
- Total invitations sent
- Total accepted
- Average time to acceptance
- Bounce rate

**Channel Effectiveness:**
- OTP email success rate
- Invite code usage rate
- QR code scans
- Resend frequency

**User Behavior:**
- Time from invite to first login
- Password vs OTP usage
- Mobile vs desktop signups

**Admin Activity:**
- Invitations per admin
- Resend frequency
- Code sharing rate

### Alerts:

- ⚠️ Acceptance rate drops below 50%
- ⚠️ Bounce rate exceeds 10%
- ⚠️ Resend count exceeds 3 per invitation
- ⚠️ Multiple failed code attempts (possible attack)

---

## Migration Plan

### Existing Users:
- ✅ No changes required
- ✅ Can still use email + password
- ✅ Can use OTP as alternative
- ✅ Backward compatible

### Existing Pending Invites:
- Generate invite codes retroactively
- Send email with new code
- Extend expiration by 30 days

### Rollout Strategy:
1. Deploy to staging
2. Test with internal users
3. Pilot with 10 ACCF staff
4. Gather feedback
5. Full rollout to all users
6. Monitor for 1 week
7. Iterate based on feedback

---

## Success Criteria

### Must Have:
- ✅ 90%+ invitation acceptance rate
- ✅ Works in locked-down Outlook
- ✅ Admin can get code in <3 clicks
- ✅ User can sign up in <2 minutes
- ✅ Zero authentication-related support tickets

### Nice to Have:
- QR code usage >20%
- Auto-resend reduces manual resends
- SMS backup channel available
- Real-time analytics dashboard

---

## Known Limitations

1. **Email still required** - Even with codes, user needs email for OTP
2. **30-day expiration** - After 30 days, admin must re-invite
3. **No SMS yet** - Future enhancement
4. **Manual QR distribution** - Admin must share/print QR codes
5. **Single org only** - No multi-tenancy support yet

---

## References

### Research:
- [Slack Invite System](https://slack.com/help/articles/201330256-Invite-new-members-to-your-workspace)
- [Microsoft Teams Guest Access](https://learn.microsoft.com/en-us/microsoft-365/solutions/collaborate-as-team)
- [Auth0 Best Practices](https://auth0.com/docs/get-started/authentication-and-authorization-flow/which-oauth-2-0-flow-should-i-use)

### Documentation:
- [AUTH_SYSTEM.md](./AUTH_SYSTEM.md) - Current auth architecture
- [EMAIL_TEMPLATES.md](./EMAIL_TEMPLATES.md) - Email template library
- [COURSES.md](./COURSES.md) - Course system integration

---

**Last Updated:** 2025-11-07
**Owner:** Development Team
**Status:** 60% Complete - Core functionality working, UX polish needed
