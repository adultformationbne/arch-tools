import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	// Require platform admin role for email testing
	const { profile } = await requireModule(event, 'users', {
		mode: 'redirect',
		redirectTo: '/profile'
	});

	return {
		session: (await event.locals.safeGetSession()).session,
		userProfile: profile
	};
};
