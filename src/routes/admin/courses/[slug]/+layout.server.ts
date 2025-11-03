import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const load: LayoutServerLoad = async ({ params, parent }) => {
	const parentData = await parent();
	const courseSlug = params.slug;

	// Get course ID
	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id')
		.eq('slug', courseSlug)
		.single();

	let cohorts = [];
	if (course) {
		// Get modules for this course
		const { data: modules, error: modulesError } = await supabaseAdmin
			.from('courses_modules')
			.select('id')
			.eq('course_id', course.id);

		if (modulesError) {
			console.error('Error fetching modules:', modulesError);
		}

		const moduleIds = modules?.map(m => m.id) || [];
		console.log('Module IDs for course:', moduleIds);

		if (moduleIds.length > 0) {
			// Get active/upcoming cohorts (not completed/withdrawn)
			const { data: cohortsData, error: cohortsError } = await supabaseAdmin
				.from('courses_cohorts')
				.select('id, name, current_session, start_date, end_date')
				.in('module_id', moduleIds)
				.neq('status', 'completed')
				.neq('status', 'withdrawn')
				.order('start_date', { ascending: false });

			if (cohortsError) {
				console.error('Error fetching cohorts:', cohortsError);
			}

			cohorts = cohortsData || [];
			console.log('Cohorts loaded for sidebar:', cohorts);
		}
	}

	return {
		courseSlug: params.slug,
		userModules: parentData.userProfile?.modules || [],
		enrollmentRole: parentData.enrollmentRole || null,
		isCourseAdmin: parentData.isCourseAdmin || false,
		cohorts
	};
};
