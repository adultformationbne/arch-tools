import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendEmail } from '$lib/utils/email-service.js';
import { generateEmailFromMjml } from '$lib/email/compiler.js';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { RESEND_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async (event) => {
	const { user } = await requireCourseAdmin(event, event.params.slug);

	const { to, subject, body, course_name, logo_url, colors } = await event.request.json();

	console.log('[TEST EMAIL] Request received:', {
		to,
		subject,
		course_name,
		has_logo: !!logo_url,
		has_colors: !!colors,
		body_length: body?.length
	});

	if (!to || !subject || !body) {
		console.error('[TEST EMAIL] Missing required fields');
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	try {
		console.log('[TEST EMAIL] Compiling MJML template...');
		console.log('[TEST EMAIL] Body HTML from editor:', body.substring(0, 500));

		// Generate HTML using MJML compiler (server-side only)
		// This ensures test emails use the same production-ready MJML compilation
		const htmlBody = generateEmailFromMjml({
			bodyContent: body,
			courseName: course_name || 'Course',
			logoUrl: logo_url,
			colors: colors || {
				accentDark: '#334642',
				accentLight: '#eae2d9',
				accentDarkest: '#1e2322'
			}
		});

		console.log('[TEST EMAIL] MJML compiled successfully, HTML length:', htmlBody.length);

		// Replace variables with test data
		console.log('[TEST EMAIL] Replacing template variables with test data...');

		// Helper function to replace both snake_case and camelCase variable names
		const replaceVariable = (text, snakeName, camelName, value) => {
			return text
				.replace(new RegExp(`\\{\\{${snakeName}\\}\\}`, 'g'), value)
				.replace(new RegExp(`\\{\\{${camelName}\\}\\}`, 'g'), value);
		};

		let testSubject = subject;
		let testBody = htmlBody;

		// Student variables
		testSubject = replaceVariable(testSubject, 'student_name', 'firstName', 'Test Student');
		testBody = replaceVariable(testBody, 'student_name', 'firstName', 'Test Student');

		testSubject = replaceVariable(testSubject, 'student_email', 'email', to);
		testBody = replaceVariable(testBody, 'student_email', 'email', to);

		// Course variables
		testSubject = replaceVariable(testSubject, 'course_name', 'courseName', course_name || 'Test Course');
		testBody = replaceVariable(testBody, 'course_name', 'courseName', course_name || 'Test Course');

		testSubject = replaceVariable(testSubject, 'course_slug', 'courseSlug', 'test-course');
		testBody = replaceVariable(testBody, 'course_slug', 'courseSlug', 'test-course');

		testSubject = replaceVariable(testSubject, 'cohort_name', 'cohortName', 'Test Cohort');
		testBody = replaceVariable(testBody, 'cohort_name', 'cohortName', 'Test Cohort');

		// Session variables
		testSubject = replaceVariable(testSubject, 'session_number', 'sessionNumber', '1');
		testBody = replaceVariable(testBody, 'session_number', 'sessionNumber', '1');

		testSubject = replaceVariable(testSubject, 'session_title', 'sessionTitle', 'Test Session');
		testBody = replaceVariable(testBody, 'session_title', 'sessionTitle', 'Test Session');

		testSubject = replaceVariable(testSubject, 'session_date', 'sessionDate', 'January 1, 2025');
		testBody = replaceVariable(testBody, 'session_date', 'sessionDate', 'January 1, 2025');

		// Hub variables
		testSubject = replaceVariable(testSubject, 'hub_name', 'hubName', 'Test Hub');
		testBody = replaceVariable(testBody, 'hub_name', 'hubName', 'Test Hub');

		testSubject = replaceVariable(testSubject, 'coordinator_name', 'coordinatorName', 'Test Coordinator');
		testBody = replaceVariable(testBody, 'coordinator_name', 'coordinatorName', 'Test Coordinator');

		testSubject = replaceVariable(testSubject, 'coordinator_email', 'coordinatorEmail', 'coordinator@example.com');
		testBody = replaceVariable(testBody, 'coordinator_email', 'coordinatorEmail', 'coordinator@example.com');

		// Link variables
		testSubject = replaceVariable(testSubject, 'login_url', 'loginLink', 'https://example.com/login');
		testBody = replaceVariable(testBody, 'login_url', 'loginLink', 'https://example.com/login');

		testSubject = replaceVariable(testSubject, 'dashboard_url', 'dashboardLink', 'https://example.com/dashboard');
		testBody = replaceVariable(testBody, 'dashboard_url', 'dashboardLink', 'https://example.com/dashboard');

		testSubject = replaceVariable(testSubject, 'materials_url', 'materialsLink', 'https://example.com/materials');
		testBody = replaceVariable(testBody, 'materials_url', 'materialsLink', 'https://example.com/materials');

		testSubject = replaceVariable(testSubject, 'reflections_url', 'reflectionLink', 'https://example.com/reflections');
		testBody = replaceVariable(testBody, 'reflections_url', 'reflectionLink', 'https://example.com/reflections');

		// Site variables
		testSubject = replaceVariable(testSubject, 'site_name', 'siteName', 'Adult Formation');
		testBody = replaceVariable(testBody, 'site_name', 'siteName', 'Adult Formation');

		testSubject = replaceVariable(testSubject, 'site_url', 'siteUrl', 'https://example.com');
		testBody = replaceVariable(testBody, 'site_url', 'siteUrl', 'https://example.com');

		testSubject = replaceVariable(testSubject, 'current_date', 'currentDate', new Date().toLocaleDateString());
		testBody = replaceVariable(testBody, 'current_date', 'currentDate', new Date().toLocaleDateString());

		// Support email (only camelCase)
		testBody = replaceVariable(testBody, 'support_email', 'supportEmail', 'support@example.com');
		testSubject = replaceVariable(testSubject, 'support_email', 'supportEmail', 'support@example.com');

		console.log('[TEST EMAIL] Variables replaced. Final subject:', `[TEST] ${testSubject}`);

		// Send test email
		console.log('[TEST EMAIL] Sending email via Resend to:', to);
		const result = await sendEmail({
			to,
			subject: `[TEST] ${testSubject}`,
			html: testBody,
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin,
			emailType: 'test_email',
			metadata: {
				sent_by: user.email,
				course_slug: event.params.slug
			}
		});

		if (result.success) {
			console.log('[TEST EMAIL] ✅ Email sent successfully!', result);
		} else {
			console.error('[TEST EMAIL] ❌ Email failed to send:', result.error);
		}

		return json({ success: true });
	} catch (error) {
		console.error('[TEST EMAIL] ❌ Error sending test email:', error);
		return json({ error: 'Failed to send test email' }, { status: 500 });
	}
};
