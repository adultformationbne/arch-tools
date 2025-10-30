import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require course admin authentication
	await requireCourseAdmin(event, courseSlug);

	try {
		// Get the course ID from slug
		const { data: course } = await supabaseAdmin
			.from('courses')
			.select('id, name')
			.eq('slug', courseSlug)
			.single();

		if (!course) {
			throw error(404, 'Course not found');
		}

		// Get modules for this course
		const { data: modules } = await supabaseAdmin
			.from('courses_modules')
			.select('id, name')
			.eq('course_id', course.id)
			.order('order_number', { ascending: true });

		const moduleIds = modules?.map(m => m.id) || [];

		if (moduleIds.length === 0) {
			return {
				course,
				modules: [],
				cohorts: [],
				enrollments: []
			};
		}

		// Get cohorts for this course's modules
		const { data: cohorts, error: cohortsError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				*,
				module:module_id (
					id,
					name
				)
			`)
			.in('module_id', moduleIds)
			.order('start_date', { ascending: false });

		if (cohortsError) {
			console.error('Error fetching cohorts:', cohortsError);
			throw error(500, 'Failed to load cohorts');
		}

		const cohortIds = cohorts?.map(c => c.id) || [];

		// Get enrollments for this course
		let enrollments = [];
		if (cohortIds.length > 0) {
			const { data: enrollmentsData, error: enrollmentsError } = await supabaseAdmin
				.from('courses_enrollments')
				.select(`
					*,
					user_profile:user_profile_id (
						id,
						email,
						full_name
					),
					cohort:cohort_id (
						id,
						name,
						module:module_id (
							name
						)
					),
					hub:hub_id (
						id,
						name
					)
				`)
				.in('cohort_id', cohortIds)
				.order('created_at', { ascending: false });

			if (enrollmentsError) {
				console.error('Error fetching enrollments:', enrollmentsError);
			} else {
				enrollments = enrollmentsData || [];
			}
		}

		return {
			course,
			modules: modules || [],
			cohorts: cohorts || [],
			enrollments
		};

	} catch (err) {
		console.error('Error in enrollments page load:', err);
		throw error(500, 'Failed to load enrollments data');
	}
};
