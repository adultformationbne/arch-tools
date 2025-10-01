import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getDevUserFromRequest, defaultDevUser } from '$lib/server/dev-user.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	// Get current user from dev mode cookies
	const devUser = getDevUserFromRequest(request) || defaultDevUser;

	// Verify admin access
	if (devUser.role !== 'accf_admin') {
		throw error(403, 'Unauthorized: Admin access required');
	}

	const cohortId = url.searchParams.get('cohort_id');

	try {
		let query = supabaseAdmin
			.from('accf_users')
			.select(`
				*,
				user_profiles!accf_users_assigned_admin_id_fkey(id, email, full_name, role),
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