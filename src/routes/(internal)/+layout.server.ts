import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, url }) => {
	const { session, user } = await safeGetSession();

	// Allow access to token-based DGR submission page (public)
	if (url.pathname.startsWith('/dgr-publish/submit/')) {
		return { session, user };
	}

	// All other (internal) routes require authentication
	if (!session) {
		throw redirect(303, '/auth?next=' + url.pathname);
	}

	// Fetch user profile to get role
	const { data: userProfile } = await supabase
		.from('user_profiles')
		.select('id, email, full_name, role')
		.eq('id', user.id)
		.single();

	return {
		session,
		user,
		userProfile,
		userRole: userProfile?.role || null
	};
};
