import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	// Check if user has user_management module access
	const { data: currentUserProfile } = await supabase
		.from('user_profiles')
		.select('role, modules')
		.eq('id', user.id)
		.single();

	const hasUserManagement = currentUserProfile?.modules?.includes('user_management');

	if (!hasUserManagement) {
		throw redirect(303, '/profile');
	}

	// Fetch all admin users only (exclude students/coordinators)
	const { data: users, error } = await supabase
		.from('user_profiles')
		.select('*')
		.eq('role', 'admin')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error loading users:', error);
	}

	return {
		users: users || [],
		currentUser: user,
		currentUserProfile
	};
};