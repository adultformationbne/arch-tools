import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const { url } = event;
	const cohortId = url.searchParams.get('cohort_id');

	try {
		let query = supabaseAdmin
			.from('courses_enrollments')
			.select(`
				*,
				user_profiles!courses_enrollments_assigned_admin_id_fkey(id, email, full_name, role),
				hubs(id, name)
			`)
			.order('enrolled_at', { ascending: false });

		if (cohortId) {
			query = query.eq('cohort_id', cohortId);
		}

		const { data: enrollments, error: fetchError } = await query;

		if (fetchError) {
			console.error('Error fetching enrollments:', fetchError);
			throw error(500, 'Failed to fetch enrollments');
		}

		return json({
			success: true,
			data: enrollments
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};