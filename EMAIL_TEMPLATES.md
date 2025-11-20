# Email Templates for Supabase Auth - Outlook Compatible

This document contains all the email templates for the Archdiocesan Ministries Platform with **full Outlook compatibility**. These templates should be configured in your Supabase Dashboard under **Authentication → Email Templates**.

## Outlook Compatibility Features

All templates now include:
- ✅ **VML buttons** for Outlook Desktop (renders as proper buttons, not links)
- ✅ **MSO conditional comments** for Outlook-specific fixes
- ✅ **Explicit table attributes** (`cellspacing`, `cellpadding`, `border`)
- ✅ **Line-height rules** (`mso-line-height-rule: exactly`)
- ✅ **Table spacing fixes** (`mso-table-lspace`, `mso-table-rspace`)
- ✅ **Proper image styling** with `border="0"` and bicubic interpolation
- ✅ **Fixed-width containers** for Outlook 120dpi rendering
- ✅ **Preheader text** for inbox preview
- ✅ **Word-break handling** for long URLs

## Available Template Variables

Supabase provides the following dynamic variables for use in email templates:

- `{{ .ConfirmationURL }}` - Full confirmation URL with token
- `{{ .Token }}` - 6-digit OTP code
- `{{ .TokenHash }}` - Hashed version of the token
- `{{ .SiteURL }}` - Your application's site URL
- `{{ .Email }}` - User's email address
- `{{ .NewEmail }}` - New email address (email change only)
- `{{ .Data }}` - User metadata from `user_metadata`
- `{{ .RedirectTo }}` - Redirect URL passed to the auth method

---

## 1. Magic Link Template (Black & White)

**When used:** Passwordless login via email OTP
**Template name:** `Magic Link`
**Our use case:** User invitations and OTP-based authentication
**Design:** Clean, ministerial black and white with archdiocesan cross mark

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Welcome to Archdiocesan Ministries Platform</title>
    <!--[if mso]>
    <style type="text/css">
        table {border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;}
        td {border-collapse: collapse; mso-line-height-rule: exactly;}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; width: 100% !important; height: 100% !important;">
    <!-- Outlook Preheader -->
    <div style="display: none; font-size: 1px; color: #f5f5f5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        Your verification code to access Archdiocesan Ministries Platform
    </div>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f5f5f5;">
        <tr>
            <td align="center" style="padding: 40px 15px;">
                <!--[if mso]>
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" width="600">
                <tr>
                <td align="center" valign="top" width="600">
                <![endif]-->

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 0px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

                    <!-- Header with Logo -->
                    <tr>
                        <td align="center" style="padding: 50px 30px 30px; text-align: center; background-color: #ffffff; mso-line-height-rule: exactly;">
                            <img src="https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin-mark.png" alt="Archdiocesan Ministry Tools" width="120" height="auto" border="0" style="display: block; margin: 0 auto 25px; width: 120px; max-width: 120px; height: auto; border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;">
                            <h1 style="color: #000000; margin: 0; padding: 0; font-size: 22px; line-height: 28px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">Archdiocesan Ministries Platform</h1>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; mso-line-height-rule: exactly;">
                            <p style="font-size: 15px; line-height: 24px; color: #333333; margin: 0 0 25px; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                You've been invited to join the Archdiocesan Ministries Platform. Use this verification code to complete your sign in:
                            </p>

                            <!-- Token Code Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 25px 0;">
                                <tr>
                                    <td align="center" style="background-color: #000000; padding: 35px 30px; border-radius: 0px; mso-line-height-rule: exactly;">
                                        <p style="font-size: 11px; line-height: 16px; color: #999999; margin: 0 0 12px; padding: 0; text-transform: uppercase; font-weight: 600; letter-spacing: 1.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">VERIFICATION CODE</p>
                                        <p style="font-size: 42px; line-height: 52px; color: #ffffff; font-weight: 700; letter-spacing: 10px; margin: 0; padding: 0; font-family: 'Courier New', Monaco, monospace; mso-line-height-rule: exactly;">{{ .Token }}</p>
                                    </td>
                                </tr>
                            </table>

                            <p style="font-size: 13px; line-height: 20px; color: #666666; margin: 20px 0 25px; padding: 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                This code expires in <strong style="font-weight: 600; color: #000000;">60 minutes</strong>
                            </p>

                            <!-- CTA Button with VML for Outlook -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 25px 0;">
                                <tr>
                                    <td align="center" style="padding: 0; mso-line-height-rule: exactly;">
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ .SiteURL }}/login" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="0%" strokecolor="#000000" stroke="t" strokeweight="2px" fillcolor="#ffffff">
                                            <w:anchorlock/>
                                            <center style="color:#000000;font-family:sans-serif;font-size:15px;font-weight:600;">Enter Code</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="{{ .SiteURL }}/login" target="_blank" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; text-align: center; padding: 12px 40px; border: 2px solid #000000; border-radius: 0px; font-size: 15px; line-height: 20px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-hide: all; outline: none; -webkit-text-size-adjust: none;">Enter Code</a>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>

                            <p style="font-size: 12px; line-height: 18px; color: #999999; margin: 30px 0 0; padding: 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                Or visit: <a href="{{ .SiteURL }}/login" style="color: #000000; text-decoration: underline;">{{ .SiteURL }}/login</a>
                            </p>

                            <!-- Divider -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 35px 0 25px;">
                                <tr>
                                    <td style="border-top: 1px solid #e0e0e0; font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td>
                                </tr>
                            </table>

                            <p style="font-size: 12px; line-height: 20px; color: #666666; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                <strong style="font-weight: 600; color: #000000;">Didn't request this?</strong> You can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #fafafa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; mso-line-height-rule: exactly;">
                            <p style="font-size: 13px; line-height: 20px; color: #333333; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;"><strong style="font-weight: 600;">Archdiocesan Ministries Platform</strong></p>
                            <p style="font-size: 11px; line-height: 18px; color: #999999; margin: 8px 0 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">Catholic Archdiocese of Adelaide</p>
                        </td>
                    </tr>

                </table>

                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## 2. Confirm Signup Template

**When used:** New user email verification during signup
**Template name:** `Confirm Signup`

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Confirm Your Email</title>
    <!--[if mso]>
    <style type="text/css">
        table {border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;}
        td {border-collapse: collapse; mso-line-height-rule: exactly;}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; width: 100% !important; height: 100% !important;">
    <!-- Outlook Preheader -->
    <div style="display: none; font-size: 1px; color: #f3f4f6; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        Confirm your email address to complete registration
    </div>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 15px;">
                <!--[if mso]>
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" width="600">
                <tr>
                <td align="center" valign="top" width="600">
                <![endif]-->

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                    <!-- Header with Logo -->
                    <tr>
                        <td align="center" style="padding: 40px 30px 20px; text-align: center; mso-line-height-rule: exactly;">
                            <img src="https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin%20primary%20logo%20col%20small.png" alt="Archdiocesan Ministry Tools" width="200" height="auto" border="0" style="display: block; margin: 0 auto 20px; width: 200px; max-width: 200px; height: auto; border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;">
                            <h1 style="color: #1f2937; margin: 0; padding: 0; font-size: 24px; line-height: 28px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">Confirm Your Email</h1>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 30px; mso-line-height-rule: exactly;">
                            <p style="font-size: 16px; line-height: 24px; color: #374151; margin: 0 0 20px; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                Welcome! Please confirm your email address to complete your registration.
                            </p>

                            <!-- CTA Button with VML for Outlook -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 30px 0;">
                                <tr>
                                    <td align="center" style="padding: 0; mso-line-height-rule: exactly;">
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ .ConfirmationURL }}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="13%" strokecolor="#10b981" fillcolor="#10b981">
                                            <w:anchorlock/>
                                            <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:600;">Confirm Email Address</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; text-align: center; padding: 14px 32px; border-radius: 6px; font-size: 16px; line-height: 20px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-hide: all; border: 0; outline: none; -webkit-text-size-adjust: none;">Confirm Email Address</a>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>

                            <!-- Alternative Link -->
                            <p style="font-size: 12px; line-height: 18px; color: #6b7280; margin: 20px 0; padding: 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                Button not working? Copy and paste this link into your browser:
                            </p>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td align="center" style="padding: 0 20px; mso-line-height-rule: exactly;">
                                        <p style="font-size: 11px; line-height: 16px; color: #9ca3af; word-break: break-all; word-wrap: break-word; margin: 0 0 20px; padding: 0; text-align: center; font-family: 'Courier New', Monaco, monospace; mso-line-height-rule: exactly;">{{ .ConfirmationURL }}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Divider -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 30px 0;">
                                <tr>
                                    <td style="border-top: 1px solid #e5e7eb; font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td>
                                </tr>
                            </table>

                            <p style="font-size: 13px; line-height: 20px; color: #6b7280; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                <strong style="font-weight: 600;">Didn't create an account?</strong> You can safely ignore this email.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; mso-line-height-rule: exactly;">
                            <p style="font-size: 14px; line-height: 20px; color: #6b7280; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;"><strong style="font-weight: 600;">Archdiocesan Ministries Platform</strong></p>
                            <p style="font-size: 12px; line-height: 18px; color: #9ca3af; margin: 10px 0 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">Catholic Archdiocese of Adelaide</p>
                        </td>
                    </tr>

                </table>

                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## 3. Password Reset Template

**When used:** User requests password reset
**Template name:** `Reset Password`

```html
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Reset Your Password</title>
    <!--[if mso]>
    <style type="text/css">
        table {border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;}
        td {border-collapse: collapse; mso-line-height-rule: exactly;}
    </style>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; width: 100% !important; height: 100% !important;">
    <!-- Outlook Preheader -->
    <div style="display: none; font-size: 1px; color: #f3f4f6; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
        Reset your password for Archdiocesan Ministries Platform
    </div>

    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; background-color: #f3f4f6;">
        <tr>
            <td align="center" style="padding: 40px 15px;">
                <!--[if mso]>
                <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" width="600">
                <tr>
                <td align="center" valign="top" width="600">
                <![endif]-->

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

                    <!-- Header with Logo -->
                    <tr>
                        <td align="center" style="padding: 40px 30px 20px; text-align: center; mso-line-height-rule: exactly;">
                            <img src="https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin%20primary%20logo%20col%20small.png" alt="Archdiocesan Ministry Tools" width="200" height="auto" border="0" style="display: block; margin: 0 auto 20px; width: 200px; max-width: 200px; height: auto; border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;">
                            <h1 style="color: #1f2937; margin: 0; padding: 0; font-size: 24px; line-height: 28px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">Reset Your Password</h1>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 40px 30px; mso-line-height-rule: exactly;">
                            <p style="font-size: 16px; line-height: 24px; color: #374151; margin: 0 0 20px; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                You recently requested to reset your password. Click the button below to create a new password:
                            </p>

                            <!-- CTA Button with VML for Outlook -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 30px 0;">
                                <tr>
                                    <td align="center" style="padding: 0; mso-line-height-rule: exactly;">
                                        <!--[if mso]>
                                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ .ConfirmationURL }}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="13%" strokecolor="#ef4444" fillcolor="#ef4444">
                                            <w:anchorlock/>
                                            <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:600;">Reset Password</center>
                                        </v:roundrect>
                                        <![endif]-->
                                        <!--[if !mso]><!-->
                                        <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; text-align: center; padding: 14px 32px; border-radius: 6px; font-size: 16px; line-height: 20px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-hide: all; border: 0; outline: none; -webkit-text-size-adjust: none;">Reset Password</a>
                                        <!--<![endif]-->
                                    </td>
                                </tr>
                            </table>

                            <!-- Alternative Link -->
                            <p style="font-size: 12px; line-height: 18px; color: #6b7280; margin: 20px 0; padding: 0; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                Button not working? Copy and paste this link into your browser:
                            </p>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
                                <tr>
                                    <td align="center" style="padding: 0 20px; mso-line-height-rule: exactly;">
                                        <p style="font-size: 11px; line-height: 16px; color: #9ca3af; word-break: break-all; word-wrap: break-word; margin: 0 0 20px; padding: 0; text-align: center; font-family: 'Courier New', Monaco, monospace; mso-line-height-rule: exactly;">{{ .ConfirmationURL }}</p>
                                    </td>
                                </tr>
                            </table>

                            <!-- Divider -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 30px 0;">
                                <tr>
                                    <td style="border-top: 1px solid #e5e7eb; font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td>
                                </tr>
                            </table>

                            <p style="font-size: 13px; line-height: 20px; color: #6b7280; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                <strong style="font-weight: 600;">Didn't request a password reset?</strong> You can safely ignore this email. Your password will not be changed.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb; mso-line-height-rule: exactly;">
                            <p style="font-size: 14px; line-height: 20px; color: #6b7280; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;"><strong style="font-weight: 600;">Archdiocesan Ministries Platform</strong></p>
                            <p style="font-size: 12px; line-height: 18px; color: #9ca3af; margin: 10px 0 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">Catholic Archdiocese of Adelaide</p>
                        </td>
                    </tr>

                </table>

                <!--[if mso]>
                </td>
                </tr>
                </table>
                <![endif]-->
            </td>
        </tr>
    </table>
</body>
</html>
```

---

## Testing Checklist

Before deploying, test emails in:

- [ ] **Outlook Desktop** (Windows) - Most important for VML buttons
- [ ] **Outlook.com** (Web)
- [ ] **Outlook Mobile** (iOS/Android)
- [ ] **Gmail** (Web & Mobile)
- [ ] **Apple Mail** (macOS & iOS)
- [ ] **Yahoo Mail**
- [ ] **Thunderbird**

Use tools like:
- [Litmus](https://litmus.com/) - Paid, comprehensive testing
- [Email on Acid](https://www.emailonacid.com/) - Paid testing service
- [MailTrap](https://mailtrap.io/) - Free inbox testing
- [Putsmail](https://putsmail.com/) - Free send-to-self testing

---

**Last Updated:** 2025-11-05
**Status:** Outlook Compatible ✅
