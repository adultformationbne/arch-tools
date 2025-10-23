import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	// Check if user has editor or admin role
	const { data: profile } = await supabase
		.from('user_profiles')
		.select('role')
		.eq('id', user.id)
		.single();

	if (!profile || !['editor', 'admin'].includes(profile.role)) {
		throw redirect(303, '/profile?error=insufficient_permissions');
	}

	return {
		session,
		user
	};
};
