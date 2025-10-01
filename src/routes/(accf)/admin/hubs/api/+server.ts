import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getDevUserFromRequest, defaultDevUser } from '$lib/server/dev-user.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	// Get current user from dev mode cookies
	const devUser = getDevUserFromRequest(request) || defaultDevUser;

	// Verify admin access
	if (devUser.role !== 'accf_admin') {
		throw error(403, 'Unauthorized: Admin access required');
	}

	try {
		const { data: hubs, error: fetchError } = await supabaseAdmin
			.from('hubs')
			.select('id, name, location, coordinator_id')
			.order('name', { ascending: true });

		if (fetchError) {
			console.error('Error fetching hubs:', fetchError);
			throw error(500, 'Failed to fetch hubs');
		}

		return json({
			success: true,
			data: hubs || []
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
