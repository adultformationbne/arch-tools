import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { session, user } = await safeGetSession();

	// Allow access to auth routes and DGR submission routes without authentication
	const publicRoutes = ['/auth', '/dgr/submit'];
	const isPublicRoute = publicRoutes.some((route) => url.pathname.startsWith(route));

	if (!session && !isPublicRoute) {
		throw redirect(303, '/auth?next=' + url.pathname);
	}

	return {
		session,
		user
	};
};
