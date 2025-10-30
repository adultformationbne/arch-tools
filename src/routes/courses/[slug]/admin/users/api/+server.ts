import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const { url } = event;

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