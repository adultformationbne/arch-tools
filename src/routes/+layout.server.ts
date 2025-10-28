import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, url }) => {
	const { session, user } = await safeGetSession();

	// Domain-based authentication logic (moved up to use in other checks)
	const hostname = url.hostname;
	const isACCFDomain = hostname === 'accf-platform.com' || url.pathname.startsWith('/login') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/reflections');
	const isInternalDomain = hostname.includes('arch-tools') || url.pathname.startsWith('/admin');

	// Allow access to auth routes and DGR submission routes without authentication
	const publicRoutes = ['/auth', '/dgr/submit', '/login', '/readings', '/api/v1/readings'];
	const isPublicRoute = publicRoutes.some((route) => url.pathname.startsWith(route));

	// Also allow access to ACCF root page for dev mode setup
	const isACCFRoot = url.pathname === '/' && isACCFDomain;

	// Get user profile if authenticated
	let userProfile = null;
	if (session && user) {
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('*')
			.eq('id', user.id)
			.single();
		userProfile = profile;
	}

	if (!session && !isPublicRoute && !isACCFRoot) {
		// Redirect to appropriate login based on domain/route
		if (isACCFDomain) {
			throw redirect(303, '/login?next=' + url.pathname);
		} else {
			throw redirect(303, '/auth?next=' + url.pathname);
		}
	}

	// Role-based access control
	if (session && userProfile) {
		// Student routes - require student or admin role
		if (isACCFDomain && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/login')) {
			if (!['student', 'admin', 'hub_coordinator'].includes(userProfile.role)) {
				throw redirect(303, '/login?error=insufficient_permissions');
			}
		}

		// Admin routes - require admin role
		if (url.pathname.startsWith('/admin')) {
			if (userProfile.role !== 'admin') {
				throw redirect(303, '/auth?error=insufficient_permissions');
			}
		}
	}

	return {
		session,
		user,
		userProfile,
		isACCFDomain
	};
};
