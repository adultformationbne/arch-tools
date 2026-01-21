import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

/**
 * Email Management Page
 *
 * Loads email templates, cohorts, hubs for course admin panel.
 * Auth is handled in parent layout (+layout.server.ts).
 */
export const load: PageServerLoad = async (event) => {
	const { slug } = event.params;

	// Get layout data (course info already loaded, auth already checked)
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo || {};

	// Get current user email for test email default
	const { user } = await event.locals.safeGetSession();

	if (!courseInfo.id) {
		throw error(404, 'Course not found');
	}

	// Run all queries in parallel for performance
	const [templatesResult, logsResult, cohortsResult, hubsResult] = await Promise.all([
		// Get all email templates for this course
		supabaseAdmin
			.from('email_templates')
			.select('*')
			.eq('context', 'course')
			.eq('context_id', courseInfo.id)
			.eq('is_active', true)
			.order('category', { ascending: true })
			.order('name', { ascending: true }),

		// Get email logs for this course (most recent first)
		supabaseAdmin
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
				email_templates!template_id (
					name,
					template_key
				)
			`
			)
			.eq('course_id', courseInfo.id)
			.order('sent_at', { ascending: false })
			.limit(100),

		// Get cohorts for recipient filtering
		supabaseAdmin
			.from('courses_cohorts')
			.select(`
				id,
				name,
				current_session,
				status,
				courses_modules!inner (
					id,
					name,
					course_id
				)
			`)
			.eq('courses_modules.course_id', courseInfo.id)
			.neq('status', 'archived')
			.order('start_date', { ascending: false }),

		// Get hubs for recipient filtering
		supabaseAdmin
			.from('courses_hubs')
			.select('id, name')
			.eq('course_id', courseInfo.id)
			.order('name', { ascending: true })
	]);

	// Get cohort IDs from results to filter enrollments
	const cohortIds = (cohortsResult.data || []).map((c) => c.id);

	// Fetch enrollments for these cohorts only
	let enrollmentsData: Array<{ cohort_id: string; hub_id: string | null }> = [];
	if (cohortIds.length > 0) {
		const { data } = await supabaseAdmin
			.from('courses_enrollments')
			.select('cohort_id, hub_id')
			.eq('status', 'active')
			.in('cohort_id', cohortIds);
		enrollmentsData = data || [];
	}

	if (templatesResult.error) {
		console.error('Error loading templates:', templatesResult.error);
		throw error(500, 'Failed to load email templates');
	}

	if (logsResult.error) {
		console.error('Error loading email logs:', logsResult.error);
	}

	if (cohortsResult.error) {
		console.error('Error loading cohorts:', cohortsResult.error);
	}

	if (hubsResult.error) {
		console.error('Error loading hubs:', hubsResult.error);
	}

	const templates = templatesResult.data || [];
	const systemTemplates = templates.filter((t) => t.category === 'system');
	const customTemplates = templates.filter((t) => t.category === 'custom');

	// Calculate enrollment counts from the enrollments data
	const enrollments = enrollmentsData;
	const cohortCounts = new Map<string, number>();
	const hubCounts = new Map<string, number>();

	for (const e of enrollments) {
		if (e.cohort_id) {
			cohortCounts.set(e.cohort_id, (cohortCounts.get(e.cohort_id) || 0) + 1);
		}
		if (e.hub_id) {
			hubCounts.set(e.hub_id, (hubCounts.get(e.hub_id) || 0) + 1);
		}
	}

	// Transform cohorts to include enrollment count
	const cohorts = (cohortsResult.data || []).map((c) => ({
		...c,
		enrollment_count: cohortCounts.get(c.id) || 0
	}));

	// Transform hubs to include enrollment count
	const hubs = (hubsResult.data || []).map((h) => ({
		...h,
		enrollment_count: hubCounts.get(h.id) || 0
	}));

	// Build per-cohort hub enrollment counts for filtering
	const hubEnrollmentsByCohort = new Map<string, Map<string, number>>();
	for (const e of enrollments) {
		if (e.cohort_id && e.hub_id) {
			if (!hubEnrollmentsByCohort.has(e.cohort_id)) {
				hubEnrollmentsByCohort.set(e.cohort_id, new Map());
			}
			const cohortHubs = hubEnrollmentsByCohort.get(e.cohort_id)!;
			cohortHubs.set(e.hub_id, (cohortHubs.get(e.hub_id) || 0) + 1);
		}
	}

	// Convert to serializable format: { cohort_id: { hub_id: count } }
	const hubCountsByCohort: Record<string, Record<string, number>> = {};
	for (const [cohortId, hubMap] of hubEnrollmentsByCohort) {
		hubCountsByCohort[cohortId] = Object.fromEntries(hubMap);
	}

	return {
		course: {
			id: courseInfo.id,
			name: courseInfo.name,
			slug: courseInfo.slug,
			logo_url: courseInfo.logo_url,
			accent_dark: courseInfo.accent_dark,
			accent_light: courseInfo.accent_light,
			accent_darkest: courseInfo.accent_darkest
		},
		courseSlug: slug,
		systemTemplates,
		customTemplates,
		allTemplates: templates,
		emailLogs: logsResult.data || [],
		cohorts,
		hubs,
		hubCountsByCohort,
		currentUserEmail: user?.email || ''
	};
};
