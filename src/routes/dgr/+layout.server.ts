import type { LayoutServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: LayoutServerLoad = async (event) => {
	// For public contributor write page - token access allowed, but check if user is logged in
	if (event.url.pathname.startsWith('/dgr/write/')) {
		const { user } = await event.locals.safeGetSession();
		return { isAuthenticated: !!user };
	}

	await requireModule(event, 'dgr', {
		mode: 'redirect',
		redirectTo: '/login?error=insufficient_permissions'
	});
	return { isAuthenticated: true };
};
