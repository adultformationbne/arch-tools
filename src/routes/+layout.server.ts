import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, url }) => {
	const { session, user } = await safeGetSession();
	const pathname = url.pathname;

	const coursesRoutePrefixes = [
		'/dashboard',
		'/materials',
		'/reflections',
		'/login',
		'/signup',
		'/privacy-policy',
		'/accf-profile'
	];
	const coursesProtectedPrefixes = ['/dashboard', '/materials', '/reflections', '/accf-profile'];

	// Determine route categories for auth logic
	const isCoursesRoute =
		coursesRoutePrefixes.some(route => pathname.startsWith(route)) || pathname === '/';
	const isCoursesProtectedRoute = coursesProtectedPrefixes.some(route => pathname.startsWith(route));
	const isAdminRoute = pathname.startsWith('/admin');

	// Allow access to auth routes and public endpoints without authentication
	const publicRoutes = ['/', '/auth', '/dgr/submit', '/login', '/readings', '/api/v1/readings', '/privacy-policy'];
	const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

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

	if (!session && !isPublicRoute) {
		// Redirect anonymous users to appropriate auth flow
		if (isCoursesRoute) {
			throw redirect(303, '/login?next=' + pathname);
		}
		throw redirect(303, '/auth?next=' + pathname);
	}

	// Role-based access control
	if (session && userProfile) {
		// Student-facing routes require student-friendly roles
		if (isCoursesProtectedRoute && !['student', 'admin', 'hub_coordinator'].includes(userProfile.role)) {
			throw redirect(303, '/login?error=insufficient_permissions');
		}

		// Admin routes require admin role
		if (isAdminRoute && userProfile.role !== 'admin') {
			throw redirect(303, '/auth?error=insufficient_permissions');
		}
	}

	return {
		session,
		user,
		userProfile,
		isCoursesRoute
	};
};
