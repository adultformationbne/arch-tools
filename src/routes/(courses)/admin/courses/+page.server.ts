import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Require admin authentication
	await requireAdmin(event);

	try {
		// Fetch all courses with module and cohort counts
		const { data: courses, error: coursesError } = await supabaseAdmin
			.from('courses')
			.select(`
				*,
				modules:courses_modules(count),
				cohorts:courses_cohorts(
					id,
					name,
					status,
					start_date,
					end_date
				)
			`)
			.order('created_at', { ascending: false });

		if (coursesError) {
			console.error('Error fetching courses:', coursesError);
			throw error(500, 'Failed to load courses');
		}

		// Transform data
		const transformedCourses = courses?.map(course => ({
			...course,
			module_count: course.modules?.[0]?.count || 0,
			cohort_count: course.cohorts?.length || 0,
			active_cohorts: course.cohorts?.filter(c => c.status === 'active').length || 0
		}));

		return {
			courses: transformedCourses || []
		};

	} catch (err) {
		console.error('Error in courses page load:', err);
		throw error(500, 'Failed to load courses');
	}
};
