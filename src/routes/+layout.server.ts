import { redirect } from '@sveltejs/kit';
import { getDevUserFromRequest } from '$lib/server/dev-user.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, url, request }) => {
	console.log('=== ROOT LAYOUT SERVER LOAD ===');
	console.log('URL:', url.pathname);
	console.log('Hostname:', url.hostname);

	const { session, user } = await safeGetSession();
	console.log('Session exists:', !!session);
	console.log('User exists:', !!user);

	// Check for dev mode user in development
	const devUser = getDevUserFromRequest(request);
	const isDevMode = process.env.NODE_ENV === 'development' && devUser;
	console.log('Dev mode:', isDevMode);
	console.log('Dev user:', devUser ? devUser.email : 'none');

	// Domain-based authentication logic (moved up to use in other checks)
	const hostname = url.hostname;
	const isACCFDomain = hostname === 'accf-platform.com' || url.pathname.startsWith('/login') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/reflections');
	const isInternalDomain = hostname.includes('arch-tools') || url.pathname.startsWith('/admin');

	// Allow access to auth routes and DGR submission routes without authentication
	const publicRoutes = ['/auth', '/dgr/submit', '/login', '/readings', '/api/v1/readings'];
	const isPublicRoute = publicRoutes.some((route) => url.pathname.startsWith(route));

	// Also allow access to ACCF root page for dev mode setup
	const isACCFRoot = url.pathname === '/' && isACCFDomain;

	// Get user profile and role if authenticated or in dev mode
	let userProfile = null;
	if (session && user) {
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('*')
			.eq('id', user.id)
			.single();
		userProfile = profile;
	} else if (isDevMode) {
		// In dev mode, get user profile from dev user
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('*')
			.eq('id', devUser.id)
			.single();
		userProfile = profile;
	}


	if (!session && !isPublicRoute && !isDevMode && !isACCFRoot) {
		// Redirect to appropriate login based on domain/route
		if (isACCFDomain) {
			throw redirect(303, '/login?next=' + url.pathname);
		} else {
			throw redirect(303, '/auth?next=' + url.pathname);
		}
	}

	// Role-based access control
	if ((session && userProfile) || (isDevMode && userProfile)) {
		// ACCF student routes - require accf_student role
		if (isACCFDomain && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/login')) {
			if (!['courses_student', 'courses_admin', 'admin'].includes(userProfile.role)) {
				if (!isDevMode) {
					throw redirect(303, '/login?error=insufficient_permissions');
				}
			}
		}

		// ACCF admin routes - require admin roles
		if (url.pathname.startsWith('/admin')) {
			if (!['courses_admin', 'admin'].includes(userProfile.role)) {
				if (!isDevMode) {
					throw redirect(303, '/auth?error=insufficient_permissions');
				}
			}
		}
	}

	console.log('Returning from root layout server:', {
		hasSession: !!session,
		hasUser: !!user,
		hasUserProfile: !!userProfile,
		userRole: userProfile?.role,
		isACCFDomain,
		hasDevUser: !!devUser
	});

	return {
		session,
		user,
		userProfile,
		isACCFDomain,
		devUser: isDevMode ? devUser : null
	};
};
