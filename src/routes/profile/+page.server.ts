import type { PageServerLoad } from './$types';
import { requireAuth, getUserProfile } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	// Use unified auth function
	const { user } = await requireAuth(event, {
		mode: 'redirect',
		redirectTo: '/login'
	});

	// Use centralized profile fetching
	const profile = await getUserProfile(event.locals.supabase, user.id);

	if (!profile) {
		console.error('Error loading profile: User profile not found for user', user.id);
	}

	return {
		profile
	};
};