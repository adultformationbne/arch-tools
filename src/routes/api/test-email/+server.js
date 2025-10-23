import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	try {
		const { to } = await request.json();

		if (!to) {
			return json({ error: 'Email address required' }, { status: 400 });
		}

		if (!env.RESEND_API_KEY) {
			return json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
		}

		const resend = new Resend(env.RESEND_API_KEY);

		const { data, error } = await resend.emails.send({
			from: 'ACCF Platform <noreply@app.archdiocesanministries.org.au>',
			to: [to],
			subject: 'Test Email from arch-tools',
			html: `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Test Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
	<table role="presentation" style="width: 100%; border-collapse: collapse;">
		<tr>
			<td align="center" style="padding: 40px 20px;">
				<table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
					<!-- Header -->
					<tr>
						<td style="background: linear-gradient(135deg, #334642 0%, #1e2322 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
							<h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 600;">
								✉️ Test Email
							</h1>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 40px 30px;">
							<h2 style="margin: 0 0 20px 0; font-size: 24px; color: #1e2322;">
								Success! 🎉
							</h2>

							<p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.6; color: #334642;">
								This is a test email from the <strong>arch-tools</strong> platform.
							</p>

							<p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.6; color: #334642;">
								If you're seeing this, it means:
							</p>

							<ul style="margin: 0 0 20px 0; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #334642;">
								<li>Resend is properly configured ✅</li>
								<li>Your API key is working ✅</li>
								<li>Email delivery is functioning ✅</li>
							</ul>

							<div style="background-color: #eae2d9; padding: 20px; border-radius: 6px; margin: 20px 0;">
								<p style="margin: 0; font-size: 14px; color: #666666;">
									<strong>Sent from:</strong> arch-tools<br>
									<strong>Timestamp:</strong> ${new Date().toISOString()}<br>
									<strong>Service:</strong> Resend Email API
								</p>
							</div>

							<p style="margin: 20px 0 0 0; font-size: 14px; color: #666666;">
								You can now proceed with setting up your email workflows! 🚀
							</p>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
							<p style="margin: 0; font-size: 13px; color: #999999;">
								Test email sent via Resend API
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
			`.trim()
		});

		if (error) {
			console.error('Resend error:', error);
			return json({ error: error.message }, { status: 500 });
		}

		return json({
			success: true,
			message: 'Email sent successfully!',
			data
		});
	} catch (err) {
		console.error('Error sending test email:', err);
		return json({ error: err.message }, { status: 500 });
	}
}
