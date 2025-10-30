import type { PageServerLoad } from './$types';
import { requirePlatformAdmin } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	// Require platform admin role for email testing
	const { user, profile } = await requirePlatformAdmin(event, {
		mode: 'redirect',
		redirectTo: '/profile'
	});

	return {
		session: (await event.locals.safeGetSession()).session,
		userProfile: profile
	};
};
