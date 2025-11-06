# Authentication Flows - Complete Reference

## Overview

All authentication flows in arch-tools use **modern PKCE flow with token_hash** for security and compliance with Supabase standards.

---

## 🔐 Flow Summary

All email-based auth flows follow this pattern:

1. **Trigger** → Supabase sends email with link
2. **Email Link** → Contains `token_hash` and `type` parameters
3. **Verification** → `/auth/confirm` verifies token and establishes session
4. **Redirect** → User sent to appropriate page based on auth type

---

## 1. User Invitation Flow

### Trigger
Admin invites user via `/users` page or `/api/admin/users`

### Email Template
- **Supabase Template**: "Invite User"
- **Link Format**: `https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=invite`

### Flow
```
1. Admin clicks "Add User" → fills email + modules
2. POST /api/admin/users
3. Supabase sends invite email
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=invite
5. Server calls supabase.auth.verifyOtp({ token_hash, type: 'invite' })
6. Session established in cookies ✅
7. Redirect to /auth/setup-password
8. User sets password via supabase.auth.updateUser({ password })
9. Redirect to appropriate dashboard based on modules
```

### Code Locations
- **API**: `/src/routes/api/admin/users/+server.js` (lines 76-86)
- **Confirm Handler**: `/src/routes/auth/confirm/+server.ts` (lines 23-25)
- **Setup Page**: `/src/routes/auth/setup-password/+page.svelte`

### Configuration
```javascript
redirectTo: `${PUBLIC_SITE_URL}/auth/confirm`
```

---

## 2. Password Reset Flow

### Trigger
User requests password reset via forgot password form

### Email Template
- **Supabase Template**: "Reset Password"
- **Link Format**: `https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=recovery`

### Flow
```
1. User enters email in forgot password form
2. Call supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/confirm' })
3. Supabase sends recovery email
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=recovery
5. Server calls supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
6. Session established ✅
7. Redirect to /auth/setup-password
8. User sets new password
9. Redirect to dashboard
```

### Code Locations
- **Test Page**: `/src/routes/test-emails/+page.svelte` (lines 85-87)
- **Confirm Handler**: `/src/routes/auth/confirm/+server.ts` (lines 26-28)

### Configuration
```javascript
redirectTo: window.location.origin + '/auth/confirm'
```

---

## 3. Signup Confirmation Flow

### Trigger
New user signs up via `/auth` page

### Email Template
- **Supabase Template**: "Confirm Signup"
- **Link Format**: `https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=signup`

### Flow
```
1. User enters email + password → clicks "Sign Up"
2. Call supabase.auth.signUp({
     email,
     password,
     options: { emailRedirectTo: '/auth/confirm' }
   })
3. Supabase sends confirmation email
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=signup
5. Server calls supabase.auth.verifyOtp({ token_hash, type: 'signup' })
6. Session established ✅
7. Redirect to appropriate dashboard based on user modules
```

### Code Locations
- **Auth Page**: `/src/routes/auth/+page.svelte` (lines 51-58)
- **Confirm Handler**: `/src/routes/auth/confirm/+server.ts` (lines 29-59)

### Configuration
```javascript
emailRedirectTo: window.location.origin + '/auth/confirm'
```

---

## 4. Magic Link Login Flow

### Trigger
User requests magic link (passwordless login)

### Email Template
- **Supabase Template**: "Magic Link"
- **Link Format**: `https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=magiclink`

### Flow
```
1. User enters email → clicks "Send Magic Link"
2. Call supabase.auth.signInWithOtp({
     email,
     options: { shouldCreateUser: false }
   })
3. Supabase sends magic link email
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=magiclink
5. Server calls supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })
6. Session established ✅
7. Redirect to dashboard
```

### Code Locations
- **Test Page**: `/src/routes/test-emails/+page.svelte` (lines 60-64)
- **Confirm Handler**: `/src/routes/auth/confirm/+server.ts` (lines 60-63)

---

## 5. Email Change Confirmation

### Trigger
User changes their email address

### Email Template
- **Supabase Template**: "Email Change"
- **Link Format**: `https://app.archdiocesanministries.org.au/auth/confirm?token_hash={hash}&type=email_change`

### Flow
```
1. User updates email in profile
2. Call supabase.auth.updateUser({ email: newEmail })
3. Supabase sends confirmation to NEW email
4. User clicks link → GET /auth/confirm?token_hash=xxx&type=email_change
5. Server calls supabase.auth.verifyOtp({ token_hash, type: 'email_change' })
6. Email updated ✅
7. Redirect to profile
```

---

## 🔒 Security Features

### 1. **PKCE Flow**
- Modern OAuth standard
- Uses `token_hash` instead of plaintext tokens
- 5-minute token expiry
- Single-use tokens

### 2. **Server-Side Verification**
- All tokens verified server-side via `verifyOtp()`
- Session established in secure HTTP-only cookies
- No client-side auth bypass possible

### 3. **Token Hash**
- Tokens are hashed before being sent in URLs
- Prevents token interception
- Compliant with OAuth 2.0 security best practices

---

## 📋 Checklist: Supabase Dashboard Configuration

### Required Settings

**Authentication → URL Configuration:**
- ✅ Site URL: `https://app.archdiocesanministries.org.au`
- ✅ Redirect URLs: `https://app.archdiocesanministries.org.au/auth/confirm`

**Authentication → Email Templates:**

Each template should use this pattern:

```html
<!-- Invite User Template -->
<h2>You've been invited!</h2>
<p>Click here to set up your account:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Accept Invitation</a></p>

<!-- Reset Password Template -->
<h2>Reset Your Password</h2>
<p>Click here to reset your password:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>

<!-- Confirm Signup Template -->
<h2>Confirm Your Email</h2>
<p>Click here to confirm your email:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm Email</a></p>

<!-- Magic Link Template -->
<h2>Your Magic Link</h2>
<p>Click here to sign in:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">Sign In</a></p>

<!-- Email Change Template -->
<h2>Confirm Email Change</h2>
<p>Click here to confirm your new email:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change">Confirm Email Change</a></p>
```

---

## 🧪 Testing

### Test Endpoints

All auth flows can be tested via `/test-emails` page:

1. **Invite User** → Tests invitation flow
2. **Magic Link** → Tests passwordless login
3. **Reset Password** → Tests recovery flow
4. **Change Email** → Tests email update

### Manual Testing

```bash
# 1. Invite a user
POST /api/admin/users
{
  "email": "test@example.com",
  "full_name": "Test User",
  "modules": ["courses.participant"]
}

# 2. Check email (local dev: http://localhost:54324)
# 3. Click link in email
# 4. Should redirect to /auth/setup-password
# 5. Set password
# 6. Should redirect to appropriate dashboard
```

---

## 🐛 Troubleshooting

### "Auth session missing!"
- **Cause**: Session not established before accessing protected page
- **Solution**: Ensure `/auth/confirm` runs before `/auth/setup-password`

### "Invalid token_hash"
- **Cause**: Token expired (>5 minutes) or already used
- **Solution**: Request new invitation/reset email

### Redirect Loop
- **Cause**: Misconfigured redirect URLs in Supabase Dashboard
- **Solution**: Verify Site URL and Redirect URLs match production domain

### Email Not Arriving
- **Local Dev**: Check Inbucket at `http://localhost:54324`
- **Production**: Check Supabase logs for email delivery errors

---

## 📚 Related Documentation

- **AUTH_SYSTEM.md** - Module-based authorization system
- **EMAIL_SYSTEM.md** - Email templates and sending
- **AGENTS.MD** - Database migrations via Supabase MCP

---

## 🔄 Migration Notes

### Legacy vs Modern

**Old (Hash Fragment):**
```
/auth/callback#access_token=xxx&type=invite
```

**New (PKCE):**
```
/auth/confirm?token_hash=xxx&type=invite
```

The `/auth/callback` route still exists for backwards compatibility but all new flows use `/auth/confirm`.

---

*Last Updated: November 2025*
*Maintained by: Development Team*
