import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const { url } = event;

	const role = url.searchParams.get('role');

	try {
	const { data: users, error: fetchError } = await supabaseAdmin
		.from('user_profiles')
		.select('id, email, full_name, modules')
		.order('full_name', { ascending: true });

		if (fetchError) {
			console.error('Error fetching users:', fetchError);
			throw error(500, 'Failed to fetch users');
		}

	const filteredUsers = (users || []).filter((user) => {
		const modules: string[] = Array.isArray(user.modules) ? user.modules : [];
		if (!role) return true;
		switch (role) {
			case 'admin':
				return modules.includes('users') || modules.includes('courses.admin');
			case 'manager':
				return modules.includes('courses.manager');
			case 'participant':
				return modules.includes('courses.participant');
			default:
				return true;
		}
	});

	return json({
		success: true,
		data: filteredUsers
	});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
