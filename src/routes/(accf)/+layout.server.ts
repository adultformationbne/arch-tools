import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, parent }) => {
	const { userProfile, devUser } = await parent();

	// Get the current user (dev user or real user)
	const user = devUser || userProfile;

	if (!user) {
		// No user found, let parent layout handle auth
		return {};
	}

	// Role-based routing logic
	const userRole = user.role;
	const currentPath = url.pathname;

	// Define default landing pages for each role
	const defaultPages = {
		'accf_admin': '/admin',
		'accf_student': '/dashboard',
		'hub_coordinator': '/dashboard' // Hub coordinators see student view for now
	};

	// Define which paths each role can access
	const allowedPaths = {
		'accf_admin': ['/admin', '/dashboard', '/materials', '/reflections', '/accf-profile'],
		'accf_student': ['/dashboard', '/materials', '/reflections', '/accf-profile'],
		'hub_coordinator': ['/dashboard', '/materials', '/reflections', '/accf-profile']
	};

	// Check if user is trying to access root ACCF path
	if (currentPath === '/') {
		const defaultPage = defaultPages[userRole];
		if (defaultPage) {
			throw redirect(303, defaultPage);
		}
	}

	// Check if user is accessing an admin path but isn't an admin
	if (currentPath.startsWith('/admin') && userRole !== 'accf_admin') {
		throw redirect(303, '/dashboard');
	}

	// Check if admin is accessing student pages - redirect to admin default
	if (userRole === 'accf_admin' &&
		(currentPath === '/dashboard' || currentPath === '/materials' || currentPath === '/reflections') &&
		!url.searchParams.has('view')) {
		// Allow admins to view student pages with ?view=student parameter
		throw redirect(303, '/admin');
	}

	return {
		userRole,
		userName: user.full_name || user.name || 'User'
	};
};