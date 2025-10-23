# Logo Upload to Supabase Storage Guide

## Quick Steps

### 1. Create Public Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** (left sidebar)
3. Click **New bucket**
4. Configure:
   - **Name**: `public-assets`
   - **Public bucket**: ✅ ON (important!)
   - Click **Create bucket**

### 2. Upload Logo

1. Click on the `public-assets` bucket
2. Click **Upload file**
3. Select `/Users/adultformation/arch-tools/static/archmin-logo.png`
4. Click **Upload**

### 3. Get Logo URL

After upload, your logo URL will be:

```
https://[YOUR-PROJECT-REF].supabase.co/storage/v1/object/public/public-assets/archmin-logo.png
```

**Find your project ref:**
- It's in your Supabase Dashboard URL
- Format: `https://supabase.com/dashboard/project/[YOUR-PROJECT-REF]`
- Or go to Settings → General → Reference ID

### 4. Update Email Templates

1. Copy your complete logo URL
2. Open `SUPABASE_EMAIL_TEMPLATES.html`
3. Find and replace ALL instances of `[LOGO_URL]` with your actual URL
4. Copy each template to Supabase → Authentication → Email Templates

## Example

If your project ref is `snuifqzfezxqnkzizija`, your logo URL would be:

```
https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin-logo.png
```

## Verification

Test your logo URL by:
1. Copy the complete URL
2. Paste it in a browser
3. You should see your logo image

If it doesn't load:
- Check bucket is public
- Check filename matches exactly
- Check for typos in URL

## Alternative: Use Base64 (Not Recommended)

If you have issues with storage, you can embed the image as base64 in the email, but this will:
- Make emails larger
- Potentially trigger spam filters
- Not recommended for production

---

**Status**: Logo ready to upload at `static/archmin-logo.png` (88KB)
