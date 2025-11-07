import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	const courseSlug = params.slug;

	// CRITICAL: Require course admin access BEFORE loading any data
	// This protects ALL nested admin routes
	await requireCourseAdmin(event, courseSlug, {
		mode: 'redirect',
		redirectTo: '/courses'
	});

	const parentData = await event.parent();

	// Get course with settings
	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id, name, short_name, description, settings')
		.eq('slug', courseSlug)
		.single();

	let cohorts = [];
	if (course) {
		// Get modules for this course
		const { data: modules } = await supabaseAdmin
			.from('courses_modules')
			.select('id')
			.eq('course_id', course.id);

		const moduleIds = modules?.map(m => m.id) || [];

		if (moduleIds.length > 0) {
			// Get active/upcoming cohorts (not completed/withdrawn)
			const { data: cohortsData } = await supabaseAdmin
				.from('courses_cohorts')
				.select('id, name, current_session, start_date, end_date')
				.in('module_id', moduleIds)
				.neq('status', 'completed')
				.neq('status', 'withdrawn')
				.order('start_date', { ascending: false });

			cohorts = cohortsData || [];
		}
	}

	// Extract theme and branding from course settings
	const settings = course?.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};

	return {
		courseSlug: params.slug,
		userModules: parentData.userProfile?.modules || [],
		enrollmentRole: parentData.enrollmentRole || null,
		isCourseAdmin: parentData.isCourseAdmin || false,
		cohorts,
		courseInfo: {
			id: course?.id,
			slug: params.slug,
			name: course?.name,
			shortName: course?.short_name,
			description: course?.description
		},
		courseTheme,
		courseBranding
	};
};
