# Magic Link Invitation Setup Guide

## ✅ Code Changes Complete

The following has been implemented:
- ✅ API updated to use `inviteUserByEmail()` instead of `createUser()`
- ✅ Password field removed from admin UI
- ✅ UI updated with invitation-focused messaging
- ✅ Multi-step toast shows invitation progress

## 🎯 Next Steps: Configure Supabase Email Templates

### Step 1: Access Email Templates

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. You'll see several templates including **Invite user**

### Step 2: Customize "Invite User" Template

Click on **Invite user** template and customize it:

#### **Subject Line**:
```
Welcome to Archdiocesan Tools - Set Up Your Account
```

#### **Email Body** (HTML):
```html
<h2>You've been invited to Archdiocesan Tools</h2>

<p>Hello {{ .Data.full_name }},</p>

<p>You've been invited by {{ .Data.invited_by }} to join the Archdiocesan Tools admin platform.</p>

<p>Click the button below to set up your account and create your password:</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
    Set Up My Account
  </a>
</p>

<p>Or copy and paste this link into your browser:</p>
<p>{{ .ConfirmationURL }}</p>

<p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
  This invitation link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
</p>

<p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
  <strong>Archdiocesan Ministry Tools</strong><br>
  Catholic Archdiocese of Brisbane
</p>
```

### Available Template Variables

Supabase provides these variables in invitation emails:
- `{{ .Email }}` - User's email address
- `{{ .ConfirmationURL }}` - Magic link URL (required)
- `{{ .Data.full_name }}` - Custom data passed from code
- `{{ .Data.invited_by }}` - Custom data passed from code
- `{{ .SiteURL }}` - Your site URL from Supabase config

### Step 3: Configure Redirect URL

1. In **Authentication** → **URL Configuration**
2. Set **Site URL**: `https://yourdomain.com` (or `http://localhost:5173` for dev)
3. Add to **Redirect URLs**:
   - `http://localhost:5173/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)

### Step 4: Test the Flow

1. Go to `/admin/users` in your app
2. Click "Add User"
3. Enter email, name, and select modules
4. Click "Send Invitation"
5. Check the recipient's email inbox
6. Click the magic link
7. User should be redirected to password setup page

## 🔧 Email Template Customization Tips

### Make it Branded

Add your archdiocese logo:
```html
<div style="text-align: center; margin-bottom: 30px;">
  <img src="https://yourdomain.com/logo.png" alt="Archdiocese Logo" style="max-width: 200px;">
</div>
```

### Add Module Information

Show what they have access to:
```html
<p>You've been granted access to the following modules:</p>
<ul>
  <!-- This would need to be passed as custom data -->
  <li>Daily Gospel Reflections</li>
  <li>Content Editor</li>
</ul>
```

### Customize Colors

Match your brand colors:
```css
background-color: #3b82f6  /* Change to your primary color */
color: white               /* Button text color */
```

## 🐛 Troubleshooting

### Email Not Received

1. **Check Spam/Junk folder**
2. **Verify Resend SMTP settings** in Supabase Auth settings
3. **Check Resend dashboard** for delivery logs
4. **Verify sender email** is verified in Resend

### Magic Link Not Working

1. **Check redirect URLs** are configured in Supabase
2. **Verify link hasn't expired** (24 hour default)
3. **Check browser console** for errors
4. **Ensure HTTPS** in production (required for secure cookies)

### User Profile Not Created

1. **Check API logs** for profile creation errors
2. **Verify RLS policies** allow profile creation
3. **Check if user already exists** with that email

## 📧 Email Template Best Practices

1. **Keep it simple** - Don't overwhelm with too much info
2. **Clear CTA** - Make the button prominent
3. **Add context** - Explain what the platform is
4. **Expiration notice** - Let them know the link expires
5. **Support contact** - Provide help if needed
6. **Mobile-friendly** - Test on mobile devices

## 🔐 Security Considerations

- Magic links expire after 24 hours (configurable in Supabase)
- Links are single-use only
- HTTPS required in production
- Rate limiting on invitation sends (built into Supabase)

## 📝 Additional Email Templates to Configure

While you're in Email Templates, also customize:

1. **Confirm signup** - For future self-registration flows
2. **Magic Link** - For passwordless login
3. **Change Email Address** - When users update email
4. **Reset Password** - For password recovery

---

**Status**: ✅ Code ready, waiting for Supabase email template configuration
**Next Step**: Configure email templates in Supabase dashboard
