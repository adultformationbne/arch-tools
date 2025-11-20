import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

/**
 * Email Templates Management Page
 *
 * Loads email templates for course admin panel.
 * Auth is handled in parent layout (+layout.server.ts).
 */
export const load: PageServerLoad = async (event) => {
	const { slug } = event.params;

	// Get layout data (course info already loaded, auth already checked)
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo || {};

	if (!courseInfo.id) {
		throw error(404, 'Course not found');
	}

	// Get all email templates for this course
	const { data: templates, error: templatesError } = await supabaseAdmin
		.from('courses_email_templates')
		.select('*')
		.eq('course_id', courseInfo.id)
		.eq('is_active', true)
		.order('category', { ascending: true })
		.order('name', { ascending: true });

	if (templatesError) {
		console.error('Error loading templates:', templatesError);
		throw error(500, 'Failed to load email templates');
	}

	// Separate system and custom templates
	const systemTemplates = templates.filter((t) => t.category === 'system');
	const customTemplates = templates.filter((t) => t.category === 'custom');

	// Get email logs for this course (most recent first)
	const { data: emailLogs, error: logsError } = await supabaseAdmin
		.from('platform_email_log')
		.select(
			`
			id,
			recipient_email,
			subject,
			sent_at,
			status,
			error_message,
			resend_id,
			template_id,
			cohort_id,
			enrollment_id,
			courses_email_templates!template_id (
				name,
				template_key
			)
		`
		)
		.eq('course_id', courseInfo.id)
		.order('sent_at', { ascending: false })
		.limit(100);

	if (logsError) {
		console.error('Error loading email logs:', logsError);
		// Don't throw error for logs - just show empty
	}

	return {
		course: {
			id: courseInfo.id,
			name: courseInfo.name,
			slug: courseInfo.slug,
			accent_dark: courseInfo.accent_dark,
			accent_light: courseInfo.accent_light,
			accent_darkest: courseInfo.accent_darkest
		},
		courseSlug: slug,
		systemTemplates,
		customTemplates,
		allTemplates: templates,
		emailLogs: emailLogs || []
	};
};
