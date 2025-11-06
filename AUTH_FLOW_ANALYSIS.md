# Authentication Flow Analysis - Gaps & Fixes

**Date:** 2025-11-07
**Status:** 🔴 Critical gaps found

---

## Entry Points

| Route | Purpose | Status |
|-------|---------|--------|
| `/auth` | Main login (password or OTP) | ⚠️ Has gaps |
| `/auth/invite?code=ABC-123` | Redeem invite code | ✅ Working |
| `/auth/confirm?token_hash=...` | PKCE email confirmation | ⚠️ Not tested with OTP |
| `/auth/setup-password` | Set password for new users | ⚠️ Needs auth check |
| `/auth/callback` | OAuth callback | ❓ Unknown status |
| `/users` (admin) | Create new invitations | ✅ Working |

---

## User Journey Flows

### Flow 1: Admin Invites New User ✅ MOSTLY WORKING

**Admin side:**
1. Admin goes to `/users`
2. Creates new user with email + modules
3. Backend creates:
   - Auth user (email_confirm: false)
   - User profile with modules
   - Pending invitation with code
   - Sends OTP email
4. Returns invite code to admin (e.g., `ABC-123`)

**User side - Path A: Using OTP from email ✅**
1. User receives 6-digit OTP in email
2. User goes to `/auth`
3. User clicks "Have an invitation code?" → Shows OTP input
4. User enters email + OTP
5. Verifies OTP → Session created
6. Marks invitation as accepted
7. Redirects to `/auth/setup-password` (confirmed_at is null)
8. User sets password
9. Redirects to dashboard

**User side - Path B: Using invite code ✅**
1. User receives invite code `ABC-123` (via Slack, QR, etc.)
2. User goes to `/auth/invite?code=ABC-123`
3. Code validated → OTP sent
4. Redirects to `/auth?email=user@email.com&mode=otp`
5. User enters OTP
6. Same as Path A from step 5

**User side - Path C: Email link (if admin emails the invite URL) ✅**
1. User clicks link: `https://site.com/auth/invite?code=ABC-123`
2. Same as Path B from step 2

---

### Flow 2: Existing User Logs In ✅ WORKING

1. User goes to `/auth`
2. Enters email + password
3. Verifies password → Session created
4. Redirects to dashboard based on modules

---

### Flow 3: User Tries Wrong Password 🔴 BROKEN

**Current behavior:**
1. User goes to `/auth`
2. Enters email + wrong password
3. Password fails → Shows OTP input
4. Message says "Please enter the 6-digit code sent to your email"
5. **BUT NO OTP WAS SENT!** 🔴
6. User has nothing to enter

**Gap location:** `/auth/+page.svelte:136-143`

```javascript
if (error.message.includes('Invalid login credentials')) {
    showOtpInput = true;
    errorMessage = 'Please enter the 6-digit code sent to your email';
    loading = false;
    return;  // ❌ Never calls signInWithOtp!
}
```

**Fix needed:**
- Actually send OTP when password fails
- OR just show error and don't switch to OTP mode

---

### Flow 4: Pending User Tries to Login 🔴 BROKEN

**Scenario:** User was invited but hasn't set password yet. They try to login.

1. User goes to `/auth`
2. Enters email + any password
3. Password fails (no password set)
4. Same broken flow as Flow 3
5. User stuck with no OTP to enter

**Fix needed:**
- Send OTP automatically when detecting pending user
- Or detect pending user and show specific message

---

### Flow 5: "Have an invitation code?" Button ⚠️ CONFUSING

**Current behavior:**
1. User on `/auth` page
2. Clicks "Have an invitation code?"
3. Toggles to OTP input mode
4. User expected to enter invite code here? Or OTP?
5. Confusing UX

**Gap location:** `/auth/+page.svelte:269-275`

```svelte
<button onclick={toggleOtpInput}>
    {showOtpInput ? 'Back to password login' : 'Have an invitation code?'}
</button>
```

**Fix needed:**
- Change button to redirect to `/auth/invite`
- OR rename to "Use email code instead"

---

### Flow 6: Direct Navigate to `/auth/setup-password` ⚠️ NEEDS AUTH CHECK

**Current behavior:**
- Anyone can navigate to `/auth/setup-password`
- Should require active session

**Fix needed:**
- Add session check in `+page.server.ts`
- Redirect to `/auth` if not authenticated

---

### Flow 7: Resend OTP ❌ NOT IMPLEMENTED

**Scenario:** User on OTP screen but didn't receive code

**Gap:**
- No "Resend code" button
- User has no way to request new OTP

**Fix needed:**
- Add "Resend code" button to OTP input UI
- Call `signInWithOtp()` again

---

### Flow 8: Invitation Already Accepted ⚠️ UNCLEAR

**Scenario:** User tries to redeem already-used code

1. User goes to `/auth/invite?code=ABC-123`
2. Code was already redeemed (status='accepted')
3. Query fails: `.eq('status', 'pending')`
4. Error: "Invalid or expired invitation code"

**Current behavior:** Generic error

**Better UX:**
- Specific message: "This invitation has already been used. Please login with your password."
- Link to `/auth`

---

### Flow 9: Expired Invitation ⚠️ UNCLEAR

**Scenario:** Code is valid but past 30 day expiry

**Current behavior:** Generic error

**Better UX:**
- Specific message: "This invitation has expired. Please contact your administrator."
- No next action (admin needs to resend)

---

### Flow 10: Password Reset ❌ NOT IMPLEMENTED

**Scenario:** User forgot password

**Gap:**
- No "Forgot password?" link on `/auth`
- No password reset flow

**Fix needed:**
- Add forgot password UI
- Implement password reset via Supabase

---

### Flow 11: Email Confirmation via `/auth/confirm` ⚠️ UNTESTED

**Scenario:** User clicks link in signup confirmation email (PKCE flow)

**Status:**
- Endpoint exists at `/auth/confirm/+server.ts`
- Uses `token_hash` verification
- Untested with new OTP system

**Needs:**
- Testing to ensure compatibility

---

## Critical Gaps Summary

### 🔴 High Priority (Breaks user flow)

1. **No OTP sent when password fails** (Flow 3, 4)
   - File: `/auth/+page.svelte:136-143`
   - Impact: Users can't login if they don't have password

2. **"Have invitation code?" button doesn't work as expected** (Flow 5)
   - File: `/auth/+page.svelte:269-275`
   - Impact: Confusing UX

### ⚠️ Medium Priority (Poor UX)

3. **No "Resend code" button** (Flow 7)
   - Impact: User stuck if email doesn't arrive

4. **Generic error messages for expired/used invitations** (Flow 8, 9)
   - Impact: User doesn't know what to do next

5. **No auth check on `/auth/setup-password`**
   - Impact: Security concern

### 📋 Low Priority (Missing features)

6. **No password reset flow** (Flow 10)
   - Impact: Users can't recover forgotten passwords

7. **No email deliverability tracking**
   - Impact: Can't debug email issues

---

## Recommended Fixes (Priority Order)

### Fix 1: Send OTP when password fails 🔴

**Location:** `/auth/+page.svelte:136-143`

**Change:**
```javascript
if (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed')) {
    // Send OTP to user
    const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
    });

    if (otpError) {
        errorMessage = 'Failed to send verification code. Please try again.';
    } else {
        showOtpInput = true;
        errorMessage = 'A 6-digit code has been sent to your email';
    }
    loading = false;
    return;
}
```

### Fix 2: Change "Have invitation code?" behavior 🔴

**Option A: Redirect to `/auth/invite`**
```svelte
<a href="/auth/invite" class="text-sm text-blue-600 hover:text-blue-500">
    Have an invitation code?
</a>
```

**Option B: Rename and keep toggle**
```svelte
<button onclick={toggleOtpInput}>
    {showOtpInput ? 'Use password instead' : 'Use email code instead'}
</button>
```

### Fix 3: Add resend OTP button ⚠️

**Location:** `/auth/+page.svelte` (in OTP input section)

```svelte
{#if showOtpInput && !isSignUp}
    <div>
        <input type="text" bind:value={otp} ... />
        <button
            type="button"
            onclick={resendOtp}
            class="text-xs text-blue-600 mt-2"
        >
            Didn't receive code? Resend
        </button>
    </div>
{/if}
```

### Fix 4: Add auth guard to setup-password ⚠️

**Create:** `/auth/setup-password/+page.server.ts`

```typescript
export async function load({ locals: { safeGetSession } }) {
    const { session } = await safeGetSession();

    if (!session) {
        throw redirect(303, '/auth');
    }

    return { session };
}
```

### Fix 5: Improve error messages ⚠️

**Location:** `/api/auth/redeem-invite/+server.js:68-84`

```javascript
const { data, error } = await supabaseAdmin
    .from('pending_invitations')
    .select('*')
    .eq('code', normalizedCode)
    .single();

if (error || !data) {
    throw error(400, 'Invalid invitation code');
}

// Check status
if (data.status === 'accepted') {
    throw error(400, 'This invitation has already been used. Please login with your password.');
}

if (data.status === 'cancelled') {
    throw error(400, 'This invitation has been cancelled. Please contact your administrator.');
}

// Check expiry
if (new Date(data.expires_at) < new Date()) {
    throw error(400, 'This invitation has expired. Please contact your administrator for a new one.');
}

if (data.status !== 'pending') {
    throw error(400, 'Invalid invitation code');
}
```

---

## Testing Checklist

Before marking complete, test each flow:

- [ ] **Flow 1A:** New user with OTP from email
- [ ] **Flow 1B:** New user with invite code
- [ ] **Flow 1C:** New user with emailed invite link
- [ ] **Flow 2:** Existing user with correct password
- [ ] **Flow 3:** User with wrong password → OTP sent
- [ ] **Flow 4:** Pending user trying to login → OTP sent
- [ ] **Flow 5:** "Have invitation code?" button behavior
- [ ] **Flow 6:** Direct navigate to setup-password → redirected
- [ ] **Flow 7:** Resend OTP button works
- [ ] **Flow 8:** Already accepted invitation → clear error
- [ ] **Flow 9:** Expired invitation → clear error
- [ ] **Flow 10:** Password reset flow (if implemented)
- [ ] **Flow 11:** PKCE confirmation callback

---

## Edge Cases to Handle

1. **User exists in auth but not in profiles**
   - Currently handled in admin user creation
   - Should also handle on login

2. **Multiple pending invitations for same email**
   - Which one gets accepted?
   - Should we enforce one active invitation per email?

3. **OTP expires (60 min)**
   - User tries to use old OTP
   - Error should suggest requesting new code

4. **Rate limiting**
   - Too many OTP requests
   - Should implement rate limiting

5. **Email bounces**
   - User email invalid
   - Need bounce tracking

---

**Next Steps:**
1. Fix critical gaps (Fix 1, 2)
2. Test all flows
3. Implement medium priority improvements
4. Document final flows in AUTH_SYSTEM.md
