import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const { url } = event;
	const enrollmentRole = url.searchParams.get('role'); // e.g., 'admin', 'student', 'coordinator'
	const status = url.searchParams.get('status'); // e.g., 'active', 'pending', 'invited'

	try {
		// Look up cohort IDs for this course
		const { data: cohorts, error: cohortsError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				id,
				module:module_id!inner (
					course:course_id!inner (
						slug
					)
				)
			`)
			.eq('module.course.slug', courseSlug);

		if (cohortsError) {
			console.error('Error fetching cohorts:', cohortsError);
			throw error(500, 'Failed to fetch cohorts');
		}

		if (!cohorts || cohorts.length === 0) {
			return json({
				success: true,
				data: []
			});
		}

		const cohortIds = cohorts.map(c => c.id);

		// Build query for enrollments
		let query = supabaseAdmin
			.from('courses_enrollments')
			.select(`
				*,
				user_profile:user_profile_id (
					id,
					email,
					full_name,
					modules
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
			.in('cohort_id', cohortIds);

		// Apply filters if provided
		if (enrollmentRole) {
			query = query.eq('role', enrollmentRole);
		}

		if (status) {
			query = query.eq('status', status);
		}

		const { data: enrollments, error: enrollmentsError } = await query
			.order('created_at', { ascending: false });

		if (enrollmentsError) {
			console.error('Error fetching enrollments:', enrollmentsError);
			throw error(500, 'Failed to fetch enrollments');
		}

		return json({
			success: true,
			data: enrollments || []
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
