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
		// ✅ OPTIMIZATION: Use cached course data from layout
		const cached = event.locals.courseCache?.get(courseSlug);

		if (!cached || !cached.cohortIds || cached.cohortIds.length === 0) {
			return json({
				success: true,
				data: []
			});
		}

		const cohortIds = cached.cohortIds;

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
