import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, url }) => {
	const { session, user } = await safeGetSession();

	// Allow access to auth routes and DGR submission routes without authentication
	const publicRoutes = ['/auth', '/dgr/submit', '/login'];
	const isPublicRoute = publicRoutes.some((route) => url.pathname.startsWith(route));

	// Get user profile and role if authenticated
	let userProfile = null;
	if (session && user) {
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('*')
			.eq('id', user.id)
			.single();
		userProfile = profile;
	}

	// Domain-based authentication logic
	const hostname = url.hostname;
	const isACCFDomain = hostname === 'accf-platform.com' || url.pathname.startsWith('/login') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/reflections');
	const isInternalDomain = hostname.includes('arch-tools') || url.pathname.startsWith('/admin');

	if (!session && !isPublicRoute) {
		// Redirect to appropriate login based on domain/route
		if (isACCFDomain) {
			throw redirect(303, '/login?next=' + url.pathname);
		} else {
			throw redirect(303, '/auth?next=' + url.pathname);
		}
	}

	// Role-based access control
	if (session && userProfile) {
		// ACCF student routes - require accf_student role
		if (isACCFDomain && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/login')) {
			if (!['accf_student', 'accf_admin', 'admin'].includes(userProfile.role)) {
				throw redirect(303, '/login?error=insufficient_permissions');
			}
		}

		// ACCF admin routes - require admin roles
		if (url.pathname.startsWith('/admin')) {
			if (!['accf_admin', 'admin'].includes(userProfile.role)) {
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
