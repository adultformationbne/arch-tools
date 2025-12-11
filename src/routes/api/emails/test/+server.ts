/**
 * Unified Test Email API
 *
 * Handles test email sending for all contexts (course, dgr, platform).
 * Supports both sample data and real recipient data.
 *
 * POST /api/emails/test
 * Body: {
 *   context: 'course' | 'dgr' | 'platform',
 *   context_id: string | null,
 *   recipient_id: string | null,  // null = use sample data
 *   to: string,                   // email address to send test to
 *   subject_template: string,
 *   body_template: string,
 *   branding: { name, logo_url, accent_dark }
 * }
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sendEmail, renderTemplate } from '$lib/utils/email-service.js';
import { generateEmailFromMjml } from '$lib/email/compiler.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { RESEND_API_KEY } from '$env/static/private';
import type { EmailContext } from '$lib/email/context-config';

// Sample data for each context (matches context-config.ts)
const SAMPLE_DATA: Record<EmailContext, Record<string, string>> = {
	course: {
		firstName: 'John',
		lastName: 'Smith',
		fullName: 'John Smith',
		email: 'john.smith@example.com',
		hubName: 'Sample Hub',
		courseName: 'Sample Course',
		courseSlug: 'sample-course',
		cohortName: 'Sample Cohort 2025',
		startDate: 'January 1, 2025',
		endDate: 'March 31, 2025',
		sessionNumber: '1',
		sessionTitle: 'Introduction',
		currentSession: '1',
		loginLink: 'https://example.com/courses/sample-course',
		dashboardLink: 'https://example.com/courses/sample-course/dashboard',
		materialsLink: 'https://example.com/courses/sample-course/materials',
		reflectionLink: 'https://example.com/courses/sample-course/reflections',
		supportEmail: 'support@archdiocesanministries.org.au'
	},
	dgr: {
		contributor_name: 'Jane Doe',
		contributor_first_name: 'Jane',
		contributor_title: '',
		contributor_email: 'jane.doe@example.com',
		write_url: 'https://example.com/dgr/write/sample123',
		write_url_button:
			'<a href="https://example.com/dgr/write/sample123" style="background-color:#009199;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Write Your Reflection</a>',
		due_date: 'Monday, 15 January 2025',
		due_date_text: 'tomorrow',
		liturgical_date: 'Second Sunday in Ordinary Time',
		gospel_reference: 'John 2:1-11'
	},
	platform: {
		userName: 'Sample User',
		userEmail: 'sample@example.com',
		platformName: 'Archdiocesan Ministries',
		supportEmail: 'support@archdiocesanministries.org.au'
	}
};

// Default branding colors
const DEFAULT_COLORS = {
	course: { accentDark: '#334642', accentLight: '#eae2d9', accentDarkest: '#1e2322' },
	dgr: { accentDark: '#009199', accentLight: '#e0f7f8', accentDarkest: '#006b70' },
	platform: { accentDark: '#334642', accentLight: '#eae2d9', accentDarkest: '#1e2322' }
};

export const POST: RequestHandler = async ({ request, locals, url }) => {
	// Auth check
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const {
			context,
			context_id,
			recipient_id,
			to,
			subject_template,
			body_template,
			branding = {},
			preview_only = false // If true, return rendered HTML instead of sending
		} = body;

		// Validate required fields
		if (!context || !['course', 'dgr', 'platform'].includes(context)) {
			return json({ error: 'Invalid context' }, { status: 400 });
		}
		if (!preview_only && !to) {
			return json({ error: 'Missing recipient email (to)' }, { status: 400 });
		}
		if (!subject_template || !body_template) {
			return json({ error: 'Missing subject_template or body_template' }, { status: 400 });
		}

		const origin = url.origin;

		// Build variables - either from real recipient or sample data
		let variables: Record<string, string>;

		if (recipient_id) {
			// Fetch real recipient data
			variables = await fetchRecipientVariables(context, context_id, recipient_id, origin);
		} else {
			// Use sample data with origin for URLs
			variables = { ...SAMPLE_DATA[context as EmailContext] };

			// Update URLs with actual origin for sample data
			if (context === 'course' && context_id) {
				variables.loginLink = `${origin}/courses/${context_id}`;
				variables.dashboardLink = `${origin}/courses/${context_id}/dashboard`;
				variables.materialsLink = `${origin}/courses/${context_id}/materials`;
				variables.reflectionLink = `${origin}/courses/${context_id}/reflections`;
			} else if (context === 'dgr') {
				variables.write_url = `${origin}/dgr/write/sample123`;
				variables.write_url_button = `<a href="${origin}/dgr/write/sample123" style="background-color:#009199;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Write Your Reflection</a>`;
			}
		}

		// Render templates
		const renderedSubject = renderTemplate(subject_template, variables);
		const renderedBody = renderTemplate(body_template, variables);

		// Get branding colors
		const colors = DEFAULT_COLORS[context as EmailContext];
		const accentDark = branding.accent_dark || colors.accentDark;

		// Compile with MJML
		const htmlBody = generateEmailFromMjml({
			bodyContent: renderedBody,
			courseName: branding.name || getDefaultBrandName(context),
			logoUrl: branding.logo_url || null,
			colors: {
				accentDark,
				accentLight: colors.accentLight,
				accentDarkest: colors.accentDarkest
			}
		});

		// If preview_only, return the rendered HTML without sending
		if (preview_only) {
			return json({
				success: true,
				preview: true,
				subject: renderedSubject,
				html: htmlBody
			});
		}

		// Send test email
		const result = await sendEmail({
			to,
			subject: `[TEST] ${renderedSubject}`,
			html: htmlBody,
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin,
			emailType: `${context}_test_email`,
			metadata: {
				sent_by: user.email,
				context,
				context_id,
				recipient_id,
				is_test: true
			}
		});

		if (result.success) {
			return json({ success: true, emailId: result.emailId });
		} else {
			console.error('[TEST EMAIL] Failed:', result.error);
			return json({ error: result.error || 'Failed to send test email' }, { status: 500 });
		}
	} catch (error) {
		console.error('[TEST EMAIL] Error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to send test email' },
			{ status: 500 }
		);
	}
};

/**
 * Fetch real recipient data and build variables
 */
async function fetchRecipientVariables(
	context: string,
	contextId: string | null,
	recipientId: string,
	origin: string
): Promise<Record<string, string>> {
	if (context === 'course') {
		return fetchCourseRecipientVariables(contextId, recipientId, origin);
	} else if (context === 'dgr') {
		return fetchDgrRecipientVariables(recipientId, origin);
	} else if (context === 'platform') {
		return fetchPlatformRecipientVariables(recipientId);
	}

	// Fallback to sample data
	return SAMPLE_DATA[context as EmailContext] || {};
}

/**
 * Fetch course enrollment data and build variables
 */
async function fetchCourseRecipientVariables(
	courseSlug: string | null,
	enrollmentId: string,
	origin: string
): Promise<Record<string, string>> {
	// Fetch enrollment with related data
	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			*,
			courses_hubs ( name ),
			courses_cohorts (
				name,
				current_session,
				start_date,
				end_date,
				courses_modules!inner (
					course_id,
					courses!inner ( id, name, slug )
				)
			)
		`)
		.eq('id', enrollmentId)
		.single();

	if (enrollmentError || !enrollment) {
		console.error('[TEST EMAIL] Failed to fetch enrollment:', enrollmentError);
		return SAMPLE_DATA.course;
	}

	const cohort = enrollment.courses_cohorts;
	const course = cohort?.courses_modules?.courses;
	const slug = course?.slug || courseSlug || '';

	const fullName = enrollment.full_name || '';
	const nameParts = fullName.split(' ');
	const firstName = nameParts[0] || '';
	const lastName = nameParts.slice(1).join(' ') || '';

	return {
		firstName,
		lastName,
		fullName,
		email: enrollment.email || '',
		hubName: enrollment.courses_hubs?.name || '',
		courseName: course?.name || '',
		courseSlug: slug,
		cohortName: cohort?.name || '',
		startDate: cohort?.start_date
			? new Date(cohort.start_date).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: '',
		endDate: cohort?.end_date
			? new Date(cohort.end_date).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: '',
		sessionNumber: String(enrollment.current_session || cohort?.current_session || ''),
		sessionTitle: '', // Would need session lookup
		currentSession: String(cohort?.current_session || ''),
		loginLink: `${origin}/courses/${slug}`,
		dashboardLink: `${origin}/courses/${slug}/dashboard`,
		materialsLink: `${origin}/courses/${slug}/materials`,
		reflectionLink: `${origin}/courses/${slug}/reflections`,
		supportEmail: 'support@archdiocesanministries.org.au'
	};
}

/**
 * Fetch DGR contributor data and build variables
 */
async function fetchDgrRecipientVariables(
	contributorId: string,
	origin: string
): Promise<Record<string, string>> {
	const { data: contributor, error } = await supabaseAdmin
		.from('dgr_contributors')
		.select('*')
		.eq('id', contributorId)
		.single();

	if (error || !contributor) {
		console.error('[TEST EMAIL] Failed to fetch contributor:', error);
		return SAMPLE_DATA.dgr;
	}

	const name = contributor.name || '';
	const title = contributor.title || '';
	const firstName = name.split(' ')[0] || '';
	// Build addressed name: "Fr Michael" or just "Michael" if no title
	const addressedFirstName = title ? `${title} ${firstName}` : firstName;
	const writeUrl = `${origin}/dgr/write/${contributor.access_token}`;

	return {
		contributor_name: name,
		contributor_first_name: addressedFirstName,
		contributor_title: title,
		contributor_email: contributor.email || '',
		write_url: writeUrl,
		write_url_button: `<a href="${writeUrl}" style="background-color:#009199;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Write Your Reflection</a>`,
		// Context-dependent vars - use sample values
		due_date: 'Monday, 15 January 2025',
		due_date_text: 'tomorrow',
		liturgical_date: 'Second Sunday in Ordinary Time',
		gospel_reference: 'John 2:1-11'
	};
}

/**
 * Fetch platform user data and build variables
 */
async function fetchPlatformRecipientVariables(userId: string): Promise<Record<string, string>> {
	const { data: profile, error } = await supabaseAdmin
		.from('user_profiles')
		.select('*')
		.eq('id', userId)
		.single();

	if (error || !profile) {
		console.error('[TEST EMAIL] Failed to fetch user profile:', error);
		return SAMPLE_DATA.platform;
	}

	return {
		userName: profile.full_name || '',
		userEmail: profile.email || '',
		platformName: 'Archdiocesan Ministries',
		supportEmail: 'support@archdiocesanministries.org.au'
	};
}

function getDefaultBrandName(context: string): string {
	switch (context) {
		case 'dgr':
			return 'Daily Gospel Reflections';
		case 'course':
			return 'Course';
		default:
			return 'Archdiocesan Ministries';
	}
}
