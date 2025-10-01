import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';

const resend = new Resend(RESEND_API_KEY);

/**
 * Send ACCF invitation email to a pending user
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.name - User's full name
 * @param {string} params.invitationToken - Unique invitation token
 * @param {string} params.cohortName - Name of the cohort they're invited to
 */
export async function sendInvitationEmail({ to, name, invitationToken, cohortName }) {
	const invitationUrl = `${process.env.PUBLIC_SITE_URL || 'http://localhost:5173'}/signup?token=${invitationToken}`;

	try {
		const { data, error } = await resend.emails.send({
			from: 'ACCF Platform <noreply@accf-platform.com>', // Update with your verified domain
			to: [to],
			subject: 'You\'re Invited to Join ACCF - Complete Your Registration',
			html: getInvitationEmailHTML({
				name,
				cohortName,
				invitationUrl
			})
		});

		if (error) {
			console.error('Resend error:', error);
			throw new Error(`Failed to send email: ${error.message}`);
		}

		return { success: true, data };
	} catch (err) {
		console.error('Error sending invitation email:', err);
		throw err;
	}
}

/**
 * Generate HTML for invitation email
 */
function getInvitationEmailHTML({ name, cohortName, invitationUrl }) {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>ACCF Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #eae2d9;">
	<table role="presentation" style="width: 100%; border-collapse: collapse;">
		<tr>
			<td align="center" style="padding: 40px 0;">
				<table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
					<!-- Header -->
					<tr>
						<td style="background: linear-gradient(135deg, #334642 0%, #1e2322 100%); padding: 40px 40px 30px 40px; text-align: center;">
							<h1 style="margin: 0; font-family: 'Bebas Neue', cursive; font-size: 48px; color: #ffffff; letter-spacing: 2px;">
								ACCF
							</h1>
							<p style="margin: 10px 0 0 0; font-size: 14px; color: #eae2d9; letter-spacing: 1px;">
								Archdiocesan Center for Catholic Formation
							</p>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 40px;">
							<h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1e2322; font-weight: 600;">
								Welcome, ${name}!
							</h2>

							<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334642;">
								You've been invited to join the <strong>${cohortName}</strong> cohort on the ACCF Platform.
							</p>

							<p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #334642;">
								To complete your registration and set up your account, please click the button below:
							</p>

							<!-- CTA Button -->
							<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
								<tr>
									<td align="center">
										<a href="${invitationUrl}"
											 style="display: inline-block; padding: 16px 40px; background-color: #c59a6b; color: #1e2322; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; letter-spacing: 0.5px;">
											Complete Registration
										</a>
									</td>
								</tr>
							</table>

							<p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
								If the button doesn't work, copy and paste this link into your browser:
							</p>
							<p style="margin: 8px 0 0 0; font-size: 13px; color: #c59a6b; word-break: break-all;">
								${invitationUrl}
							</p>

							<div style="margin-top: 40px; padding-top: 30px; border-top: 2px solid #eae2d9;">
								<p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">
									This invitation link is unique to you and will expire after use.
								</p>
								<p style="margin: 0; font-size: 14px; color: #666666;">
									If you have any questions, please contact your program administrator.
								</p>
							</div>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="background-color: #eae2d9; padding: 30px 40px; text-align: center;">
							<p style="margin: 0; font-size: 13px; color: #666666;">
								© ${new Date().getFullYear()} Archdiocesan Center for Catholic Formation
							</p>
							<p style="margin: 10px 0 0 0; font-size: 12px; color: #999999;">
								You received this email because you were invited to join the ACCF Platform.
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
	`.trim();
}

/**
 * Send bulk invitations
 * @param {Array} users - Array of user objects with { email, full_name, invitation_token, cohort_name }
 * @returns {Promise<Object>} - Results with success/failure counts
 */
export async function sendBulkInvitations(users) {
	const results = {
		total: users.length,
		sent: 0,
		failed: 0,
		errors: []
	};

	for (const user of users) {
		try {
			await sendInvitationEmail({
				to: user.email,
				name: user.full_name,
				invitationToken: user.invitation_token,
				cohortName: user.cohort_name || 'ACCF Program'
			});
			results.sent++;
		} catch (err) {
			results.failed++;
			results.errors.push({
				email: user.email,
				error: err.message
			});
		}

		// Add small delay to avoid rate limiting
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	return results;
}