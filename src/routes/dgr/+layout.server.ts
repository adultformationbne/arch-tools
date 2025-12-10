import type { LayoutServerLoad } from './$types';
import { requireModule, getUserProfile } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: LayoutServerLoad = async (event) => {
	// For public contributor write page - token access allowed, but check if user is logged in
	if (event.url.pathname.startsWith('/dgr/write/')) {
		const { user } = await event.locals.safeGetSession();

		// If authenticated, also get their contributor token for the nav
		let contributorToken = null;
		if (user?.email) {
			const { data: contributor } = await supabaseAdmin
				.from('dgr_contributors')
				.select('access_token')
				.eq('email', user.email)
				.eq('active', true)
				.maybeSingle();

			if (contributor) {
				contributorToken = contributor.access_token;
			}
		}

		return { isAuthenticated: !!user, contributorToken };
	}

	const { user } = await requireModule(event, 'dgr', {
		mode: 'redirect',
		redirectTo: '/login?error=insufficient_permissions'
	});

	// Check if authenticated user is also a DGR contributor
	let contributorToken = null;
	if (user?.email) {
		const { data: contributor } = await supabaseAdmin
			.from('dgr_contributors')
			.select('access_token')
			.eq('email', user.email)
			.eq('active', true)
			.maybeSingle();

		if (contributor) {
			contributorToken = contributor.access_token;
		}
	}

	return { isAuthenticated: true, contributorToken };
};
