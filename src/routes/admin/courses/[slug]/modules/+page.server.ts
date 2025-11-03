import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	try {
		// Fetch ONLY the current course
		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.select('*')
			.eq('slug', courseSlug)
			.single();

		if (courseError || !course) {
			console.error('Error fetching course:', courseError);
			throw error(404, 'Course not found');
		}

		// Get modules for this course
		const { data: modules, error: modulesError } = await supabaseAdmin
			.from('courses_modules')
			.select(`
				*,
				sessions:courses_sessions(count),
				cohorts:courses_cohorts(
					id,
					name,
					status,
					start_date,
					end_date
				)
			`)
			.eq('course_id', course.id)
			.order('order_number', { ascending: true });

		if (modulesError) {
			console.error('Error fetching modules:', modulesError);
		}

		// Get all cohorts for this course's modules
		const moduleIds = modules?.map(m => m.id) || [];
		let cohorts = [];

		if (moduleIds.length > 0) {
			const { data: cohortsData, error: cohortsError } = await supabaseAdmin
				.from('courses_cohorts')
				.select(`
					*,
					module:module_id (
						id,
						name
					),
					enrollments:courses_enrollments(count)
				`)
				.in('module_id', moduleIds)
				.order('start_date', { ascending: false });

			if (cohortsError) {
				console.error('Error fetching cohorts:', cohortsError);
			} else {
				cohorts = cohortsData || [];
			}
		}

		// Get enrollment count across all cohorts
		const cohortIds = cohorts.map(c => c.id);
		let totalEnrollments = 0;

		if (cohortIds.length > 0) {
			const { count, error: countError } = await supabaseAdmin
				.from('courses_enrollments')
				.select('*', { count: 'exact', head: true })
				.in('cohort_id', cohortIds);

			if (!countError) {
				totalEnrollments = count || 0;
			}
		}

		return {
			course,
			modules: modules || [],
			cohorts,
			totalEnrollments,
			moduleCount: modules?.length || 0,
			activeCohorts: cohorts.filter(c => c.status === 'active').length
		};

	} catch (err) {
		console.error('Error in courses page load:', err);
		throw error(500, 'Failed to load course data');
	}
};
