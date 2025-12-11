/**
 * Send a real test email to verify the email service layer
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

config();

// Email service functions (inline to avoid SvelteKit alias issues)
function renderTemplate(template, variables = {}) {
	if (!template) return '';
	let rendered = template;
	Object.entries(variables).forEach(([key, value]) => {
		const regex = new RegExp(`{{${key}}}`, 'g');
		rendered = rendered.replace(regex, value ?? '');
	});
	rendered = rendered.replace(/{{[^}]+}}/g, '');
	return rendered;
}

function createBrandedEmailHtml({
	content,
	courseName,
	accentDark = '#334642',
	accentLight = '#c59a6b',
	logoUrl = null
}) {
	if (!content) return '';

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${courseName}</title>
	<!--[if mso]>
	<style type="text/css">
		body, table, td {font-family: Arial, sans-serif !important;}
	</style>
	<![endif]-->
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
	<table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
		<tr>
			<td align="center" style="padding: 40px 20px;">
				<table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); overflow: hidden;">
					<tr>
						<td style="background: linear-gradient(135deg, ${accentDark} 0%, ${accentLight} 100%); padding: 32px 24px; text-align: center;">
							${logoUrl ? `<img src="${logoUrl}" alt="${courseName}" style="max-width: 180px; height: auto; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;">` : ''}
							<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
								${courseName}
							</h1>
						</td>
					</tr>
					<tr>
						<td style="padding: 40px 32px;">
							<div style="font-size: 16px; line-height: 1.6; color: #333333;">
								${content}
							</div>
						</td>
					</tr>
					<tr>
						<td style="background-color: #f9f9f9; padding: 24px 32px; text-align: center; border-top: 3px solid ${accentLight};">
							<p style="margin: 0 0 8px 0; font-size: 13px; color: #666666;">
								You're receiving this email as a participant in ${courseName}
							</p>
							<p style="margin: 0; font-size: 12px; color: #999999;">
								Archdiocesan Ministries | <a href="mailto:support@archdiocesanministries.org.au" style="color: ${accentDark}; text-decoration: none;">Support</a>
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

function createEmailButton(text, url, accentDark = '#334642') {
	return `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
	<tr>
		<td style="border-radius: 6px; background-color: ${accentDark};">
			<a href="${url}"
			   style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; text-align: center;">
				${text}
			</a>
		</td>
	</tr>
</table>
	`.trim();
}

async function main() {
	console.log('='.repeat(60));
	console.log('SENDING TEST EMAIL');
	console.log('='.repeat(60));

	// Check environment
	if (!process.env.RESEND_API_KEY) {
		console.error('❌ RESEND_API_KEY not found in environment');
		process.exit(1);
	}

	if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
		console.error('❌ Supabase credentials not found in environment');
		process.exit(1);
	}

	console.log('✅ Environment variables loaded\n');

	// Connect to Supabase
	const supabase = createClient(
		process.env.PUBLIC_SUPABASE_URL,
		process.env.SUPABASE_SERVICE_ROLE_KEY
	);

	console.log('📊 Fetching ACCF course data...');

	// Get ACCF course
	const { data: course, error: courseError } = await supabase
		.from('courses')
		.select('*')
		.eq('slug', 'accf')
		.single();

	if (courseError || !course) {
		console.error('❌ Failed to fetch course:', courseError);
		process.exit(1);
	}

	console.log('✅ Course loaded:', course.name);

	// Get a template (session_materials_ready)
	const { data: template, error: templateError } = await supabase
		.from('email_templates')
		.select('*')
		.eq('context', 'course')
		.eq('context_id', course.id)
		.eq('template_key', 'session_materials_ready')
		.single();

	if (templateError || !template) {
		console.error('❌ Failed to fetch template:', templateError);
		process.exit(1);
	}

	console.log('✅ Template loaded:', template.name);

	// Build variables (mock data for Liam)
	console.log('\n📝 Building email content...');

	const variables = {
		firstName: 'Liam',
		lastName: 'Desic',
		fullName: 'Liam Desic',
		email: 'me@liamdesic.co',
		courseName: course.name,
		courseSlug: course.slug,
		cohortName: 'Test Cohort - Developer Testing',
		startDate: 'November 20, 2025',
		endDate: 'December 20, 2025',
		sessionNumber: '2',
		sessionTitle: 'The Holy Spirit',
		currentSession: '2',
		loginLink: 'https://app.archdiocesanministries.org.au/courses/accf',
		dashboardLink: 'https://app.archdiocesanministries.org.au/courses/accf/dashboard',
		materialsLink: 'https://app.archdiocesanministries.org.au/courses/accf/materials',
		reflectionLink: 'https://app.archdiocesanministries.org.au/courses/accf/reflections',
		supportEmail: 'support@archdiocesanministries.org.au',
		hubName: 'Developer Test Hub'
	};

	// Render template
	const subject = renderTemplate(template.subject_template, variables);
	const body = renderTemplate(template.body_template, variables);

	console.log('Subject:', subject);

	// Add styled button
	const button = createEmailButton(
		'View Session Materials',
		variables.materialsLink,
		course.settings?.theme?.accentDark || '#334642'
	);

	const bodyWithButton = body.replace(/\n/g, '<br>') + '<br><br>' + button;

	// Create branded HTML
	const html = createBrandedEmailHtml({
		content: bodyWithButton,
		courseName: course.name,
		accentDark: course.settings?.theme?.accentDark || '#334642',
		accentLight: course.settings?.theme?.accentLight || '#c59a6b',
		logoUrl: course.settings?.branding?.logoUrl || null
	});

	console.log('✅ Email HTML generated (' + html.length + ' characters)');

	// Get platform settings for from email
	const { data: platformSettings } = await supabase
		.from('platform_settings')
		.select('from_email')
		.limit(1)
		.single();

	const fromEmail = platformSettings?.from_email || 'noreply@app.archdiocesanministries.org.au';

	// Send via Resend
	console.log('\n📧 Sending email via Resend...');
	console.log('To:', 'me@liamdesic.co');
	console.log('From:', fromEmail);

	const resend = new Resend(process.env.RESEND_API_KEY);

	try {
		const { data, error } = await resend.emails.send({
			from: fromEmail,
			to: ['me@liamdesic.co'],
			subject: subject,
			html: html
		});

		if (error) {
			console.error('❌ Resend error:', error);

			// Log failed email
			await supabase.from('platform_email_log').insert({
				recipient_email: 'me@liamdesic.co',
				email_type: 'test_email',
				subject,
				body: html,
				status: 'failed',
				error_message: error.message || 'Unknown error',
				course_id: course.id,
				template_id: template.id,
				metadata: { test: true, sentBy: 'send-test-email.js' }
			});

			process.exit(1);
		}

		console.log('✅ Email sent successfully!');
		console.log('Resend ID:', data.id);

		// Log successful email
		await supabase.from('platform_email_log').insert({
			recipient_email: 'me@liamdesic.co',
			email_type: 'test_email',
			subject,
			body: html,
			status: 'sent',
			sent_at: new Date().toISOString(),
			resend_id: data.id,
			course_id: course.id,
			template_id: template.id,
			metadata: { test: true, sentBy: 'send-test-email.js' }
		});

		console.log('✅ Email logged to database');

		console.log('\n' + '='.repeat(60));
		console.log('🎉 TEST EMAIL SENT SUCCESSFULLY!');
		console.log('='.repeat(60));
		console.log('\nCheck your inbox at: me@liamdesic.co');
		console.log('\nEmail includes:');
		console.log('  ✅ Course-branded header (ACCF colors)');
		console.log('  ✅ Personalized content (Hi Liam)');
		console.log('  ✅ Styled button link');
		console.log('  ✅ Professional footer');

	} catch (err) {
		console.error('❌ Error:', err);
		process.exit(1);
	}
}

main();
