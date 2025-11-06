# Email Logo Outlook Compatibility Fix

## Changes Made

Updated logo implementation in all email templates to fix rendering issues in Outlook.

### Files Updated:
1. `INVITE_USER_EMAIL_TEMPLATE.html`
2. `EMAIL_TEMPLATES.md` (5 templates)

### Logo URL Changed:
**Old:** `https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin-logo.png`
**New:** `https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin%20primary%20logo%20col%20small.png`

### Styling Changes for Outlook Compatibility:

#### Before (Problem):
```html
<img src="..." alt="..." style="max-width: 200px; height: auto; margin-bottom: 20px;">
```

#### After (Outlook-Compatible):
```html
<img src="..." alt="..."
     width="200"
     height="auto"
     style="display: block;
            margin: 0 auto 20px;
            width: 200px;
            max-width: 200px;
            height: auto;
            border: 0;
            line-height: 100%;
            outline: none;
            text-decoration: none;
            -ms-interpolation-mode: bicubic;">
```

## What These Fixes Do:

1. **HTML `width` attribute**: Outlook (especially desktop versions) often ignores CSS `max-width` but respects the HTML `width` attribute. Setting both ensures consistency.

2. **`display: block`**: Prevents inline spacing issues that can cause gaps around images in Outlook.

3. **`margin: 0 auto`**: Centers the image properly in Outlook.

4. **`border: 0`**: Removes default image borders that Outlook sometimes adds.

5. **`line-height: 100%`**: Prevents extra spacing below images in some email clients.

6. **`outline: none; text-decoration: none`**: Removes link styling if the image is wrapped in an anchor tag.

7. **`-ms-interpolation-mode: bicubic`**: Improves image quality when resized in older versions of Outlook/IE.

8. **URL encoding (`%20`)**: Properly encodes the space in the filename to ensure compatibility across all email clients.

## Testing Recommendations:

Test the updated templates in:
- ✅ Outlook Desktop (Windows)
- ✅ Outlook.com (Web)
- ✅ Gmail (Web & Mobile)
- ✅ Apple Mail (macOS & iOS)
- ✅ Outlook Mobile (iOS/Android)

## Next Steps:

Update the email templates in your Supabase Dashboard:
1. Go to **Authentication → Email Templates**
2. Update each template (Magic Link, Confirm Signup, Invite User, etc.)
3. Copy the updated HTML from `EMAIL_TEMPLATES.md`
4. Save and test by sending a test email

---

**Date:** 2025-11-05
**Issue:** Logo appearing "blown out and unstyled" in Outlook
**Resolution:** Applied Outlook-specific styling and proper HTML attributes
