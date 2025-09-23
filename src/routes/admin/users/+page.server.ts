import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	// Check if user is admin
	const { data: currentUserProfile } = await supabase
		.from('user_profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	if (currentUserProfile?.role !== 'admin') {
		throw redirect(303, '/profile');
	}

	// Fetch all users
	const { data: users, error } = await supabase
		.from('user_profiles')
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error loading users:', error);
	}

	return {
		users: users || [],
		currentUser: user
	};
};