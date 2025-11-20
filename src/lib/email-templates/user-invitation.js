/**
 * User Invitation Email Template
 * Sent when admins invite new users to the platform
 * Uses manual instructions (no clickable links) to avoid Outlook link scanning issues
 */

import { platform } from '$lib/config';

/**
 * Generate welcome/invitation email for new users
 * @param {Object} data
 * @param {string} data.recipientName - Name of the user being invited
 * @param {string} data.recipientEmail - Email address of the user
 * @param {string} data.siteUrl - Base URL of the application
 * @param {string[]} data.modules - Array of module permissions assigned
 * @returns {{subject: string, html: string}}
 */
export function generateInvitationEmail({ recipientName, recipientEmail, siteUrl, modules = [] }) {
	const displayName = recipientName || 'there';

	// Generate modules list if any modules are assigned
	const modulesText = modules.length > 0
		? `<p style="font-size: 15px; line-height: 24px; color: #333333; margin: 20px 0 10px; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">You have been granted access to the following areas:</p>
		   <ul style="margin: 0 0 20px 0; padding-left: 24px; font-size: 14px; line-height: 22px; color: #666666; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
		   ${modules.map(mod => `<li style="margin: 6px 0;">${formatModuleName(mod)}</li>`).join('')}
		   </ul>`
		: '';

	const subject = `Welcome to ${platform.name} - Your Account is Ready`;

	const html = `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Welcome to ${platform.name}</title>
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
        Your account has been created - Login instructions inside
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
                            <img src="https://snuifqzfezxqnkzizija.supabase.co/storage/v1/object/public/public-assets/archmin-mark-small.png" alt="${platform.name}" width="120" height="auto" border="0" style="display: block; margin: 0 auto 25px; width: 120px; max-width: 120px; height: auto; border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic;">
                            <h1 style="color: #000000; margin: 0; padding: 0; font-size: 22px; line-height: 28px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">${platform.name}</h1>
                        </td>
                    </tr>

                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; mso-line-height-rule: exactly;">
                            <p style="font-size: 15px; line-height: 24px; color: #333333; margin: 0 0 20px; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                Hi ${displayName},
                            </p>

                            <p style="font-size: 15px; line-height: 24px; color: #333333; margin: 0 0 20px; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                Your account has been created on the ${platform.name}. You can now login and start using the system.
                            </p>

                            ${modulesText}

                            <!-- Login Instructions Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 30px 0;">
                                <tr>
                                    <td style="background-color: #000000; padding: 30px; border-radius: 0px; mso-line-height-rule: exactly;">
                                        <p style="font-size: 11px; line-height: 16px; color: #999999; margin: 0 0 20px; padding: 0; text-transform: uppercase; font-weight: 600; letter-spacing: 1.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">HOW TO LOGIN</p>

                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 0 0 15px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="30" valign="top" style="padding: 2px 0 0 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 16px; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">1.</p>
                                                            </td>
                                                            <td style="padding: 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 14px; line-height: 22px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; mso-line-height-rule: exactly;">Open your web browser and go to:</p>
                                                                <p style="margin: 6px 0 0 0; padding: 8px 12px; font-size: 14px; line-height: 20px; color: #000000; background-color: #ffffff; border-radius: 3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-break: break-all;">${siteUrl}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 0 0 15px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="30" valign="top" style="padding: 2px 0 0 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 16px; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">2.</p>
                                                            </td>
                                                            <td style="padding: 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 14px; line-height: 22px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; mso-line-height-rule: exactly;">Click on the <strong style="font-weight: 600;">Login</strong> button</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 0 0 15px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="30" valign="top" style="padding: 2px 0 0 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 16px; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">3.</p>
                                                            </td>
                                                            <td style="padding: 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 14px; line-height: 22px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; mso-line-height-rule: exactly;">Enter your email address:</p>
                                                                <p style="margin: 6px 0 0 0; padding: 8px 12px; font-size: 14px; line-height: 20px; color: #000000; background-color: #ffffff; border-radius: 3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-break: break-all;">${recipientEmail}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 0 0 15px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="30" valign="top" style="padding: 2px 0 0 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 16px; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">4.</p>
                                                            </td>
                                                            <td style="padding: 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 14px; line-height: 22px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; mso-line-height-rule: exactly;">The system will send a <strong style="font-weight: 600;">6-digit verification code</strong> to this email address</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td width="30" valign="top" style="padding: 2px 0 0 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 16px; font-weight: 700; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">5.</p>
                                                            </td>
                                                            <td style="padding: 0;">
                                                                <p style="margin: 0; padding: 0; font-size: 14px; line-height: 22px; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; mso-line-height-rule: exactly;">Enter the verification code and create a password for your account</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Divider -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; margin: 30px 0 20px;">
                                <tr>
                                    <td style="border-top: 1px solid #e0e0e0; font-size: 0; line-height: 0; mso-line-height-rule: exactly;">&nbsp;</td>
                                </tr>
                            </table>

                            <p style="font-size: 12px; line-height: 20px; color: #666666; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">
                                <strong style="font-weight: 600; color: #000000;">Having trouble?</strong> If you have any questions or need assistance, please contact your administrator.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="background-color: #fafafa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0; mso-line-height-rule: exactly;">
                            <p style="font-size: 13px; line-height: 20px; color: #333333; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;"><strong style="font-weight: 600;">${platform.name}</strong></p>
                            <p style="font-size: 11px; line-height: 18px; color: #999999; margin: 8px 0 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; mso-line-height-rule: exactly;">Catholic Archdiocese of Brisbane</p>
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
	`.trim();

	return { subject, html };
}

/**
 * Format module names for display
 * @param {string} moduleId - Module identifier
 * @returns {string} Human-readable module name
 */
function formatModuleName(moduleId) {
	const moduleNames = {
		'platform.admin': 'Platform Admin',
		'editor': 'Content Editor',
		'dgr': 'Daily Gospel Reflections',
		'courses.participant': 'Course Participation',
		'courses.manager': 'Course Management',
		'courses.admin': 'Course Administration'
	};

	return moduleNames[moduleId] || moduleId;
}
