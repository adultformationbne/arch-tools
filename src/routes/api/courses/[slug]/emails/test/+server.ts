import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendEmail } from '$lib/utils/email-service.js';
import { generateEmailPreview } from '$lib/utils/email-preview.js';
import { requireCourseAdmin } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	const { user } = await requireCourseAdmin(event, event.params.slug);

	const { to, subject, body, course_name, logo_url, colors } = await event.request.json();

	if (!to || !subject || !body) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	try {
		// Generate HTML using SINGLE SOURCE OF TRUTH (generateEmailPreview)
		// This ensures test emails match the editor preview exactly
		const htmlBody = generateEmailPreview({
			bodyContent: body,
			courseName: course_name || 'Course',
			logoUrl: logo_url,
			colors: colors || {
				accentDark: '#334642',
				accentLight: '#eae2d9',
				accentDarkest: '#1e2322'
			}
		});

		// Replace variables with test data
		const testSubject = subject
			.replace(/\{\{student_name\}\}/g, 'Test Student')
			.replace(/\{\{course_name\}\}/g, course_name || 'Test Course')
			.replace(/\{\{cohort_name\}\}/g, 'Test Cohort')
			.replace(/\{\{session_title\}\}/g, 'Test Session')
			.replace(/\{\{session_date\}\}/g, 'January 1, 2025')
			.replace(/\{\{session_number\}\}/g, '1')
			.replace(/\{\{hub_name\}\}/g, 'Test Hub')
			.replace(/\{\{coordinator_name\}\}/g, 'Test Coordinator')
			.replace(/\{\{coordinator_email\}\}/g, 'coordinator@example.com')
			.replace(/\{\{materials_url\}\}/g, 'https://example.com/materials')
			.replace(/\{\{reflections_url\}\}/g, 'https://example.com/reflections')
			.replace(/\{\{dashboard_url\}\}/g, 'https://example.com/dashboard')
			.replace(/\{\{login_url\}\}/g, 'https://example.com/login')
			.replace(/\{\{site_name\}\}/g, 'Adult Formation')
			.replace(/\{\{site_url\}\}/g, 'https://example.com')
			.replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString());

		const testBody = htmlBody
			.replace(/\{\{student_name\}\}/g, 'Test Student')
			.replace(/\{\{student_email\}\}/g, to)
			.replace(/\{\{course_name\}\}/g, course_name || 'Test Course')
			.replace(/\{\{cohort_name\}\}/g, 'Test Cohort')
			.replace(/\{\{session_title\}\}/g, 'Test Session')
			.replace(/\{\{session_date\}\}/g, 'January 1, 2025')
			.replace(/\{\{session_number\}\}/g, '1')
			.replace(/\{\{hub_name\}\}/g, 'Test Hub')
			.replace(/\{\{coordinator_name\}\}/g, 'Test Coordinator')
			.replace(/\{\{coordinator_email\}\}/g, 'coordinator@example.com')
			.replace(/\{\{materials_url\}\}/g, 'https://example.com/materials')
			.replace(/\{\{reflections_url\}\}/g, 'https://example.com/reflections')
			.replace(/\{\{dashboard_url\}\}/g, 'https://example.com/dashboard')
			.replace(/\{\{login_url\}\}/g, 'https://example.com/login')
			.replace(/\{\{site_name\}\}/g, 'Adult Formation')
			.replace(/\{\{site_url\}\}/g, 'https://example.com')
			.replace(/\{\{current_date\}\}/g, new Date().toLocaleDateString());

		// Send test email
		await sendEmail({
			to,
			subject: `[TEST] ${testSubject}`,
			html: testBody
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error sending test email:', error);
		return json({ error: 'Failed to send test email' }, { status: 500 });
	}
};
