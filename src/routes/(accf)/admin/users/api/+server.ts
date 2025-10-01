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

	const role = url.searchParams.get('role');

	try {
		let query = supabaseAdmin
			.from('user_profiles')
			.select('id, email, full_name, role')
			.order('full_name', { ascending: true });

		if (role) {
			query = query.eq('role', role);
		}

		const { data: users, error: fetchError } = await query;

		if (fetchError) {
			console.error('Error fetching users:', fetchError);
			throw error(500, 'Failed to fetch users');
		}

		return json({
			success: true,
			data: users || []
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};