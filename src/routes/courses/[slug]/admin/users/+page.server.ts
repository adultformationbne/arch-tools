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

		// Get module IDs for this course
		const { data: modules } = await supabaseAdmin
			.from('courses_modules')
			.select('id')
			.eq('course_id', course.id);

		const moduleIds = modules?.map(m => m.id) || [];

		if (moduleIds.length === 0) {
			return {
				course,
				users: [],
				hubs: []
			};
		}

		// Get cohort IDs for this course's modules
		const { data: cohorts } = await supabaseAdmin
			.from('courses_cohorts')
			.select('id')
			.in('module_id', moduleIds);

		const cohortIds = cohorts?.map(c => c.id) || [];

		if (cohortIds.length === 0) {
			return {
				course,
				users: [],
				hubs: []
			};
		}

		// Get all enrollments for this course's cohorts
		const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				*,
				user_profile:user_profile_id (
					id,
					email,
					full_name,
					role
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
			throw error(500, 'Failed to load users');
		}

		// Get all hubs for this course
		const { data: hubs, error: hubsError } = await supabaseAdmin
			.from('courses_hubs')
			.select('*')
			.order('name');

		if (hubsError) {
			console.error('Error fetching hubs:', hubsError);
		}

		return {
			course,
			users: enrollments || [],
			hubs: hubs || []
		};

	} catch (err) {
		console.error('Error in users page load:', err);
		throw error(500, 'Failed to load users data');
	}
};
