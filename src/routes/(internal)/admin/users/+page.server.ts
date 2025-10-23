import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/utils/auth-helpers';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	// Check if user has user_management module access
	const currentUserProfile = await requireModule(supabase, user.id, 'user_management');

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