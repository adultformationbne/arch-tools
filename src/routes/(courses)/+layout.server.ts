import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, parent }) => {
	const parentData = await parent();
	const { userProfile } = parentData;

	if (!userProfile) {
		// No user found, let parent layout handle auth
		return {};
	}

	// Role-based routing logic
	const userRole = userProfile.role;
	const currentPath = url.pathname;

	// Define default landing pages for each role
	const defaultPages = {
		'admin': '/admin',
		'student': '/dashboard',
		'hub_coordinator': '/dashboard'
	};

	// Check if user is trying to access root courses path
	if (currentPath === '/') {
		const defaultPage = defaultPages[userRole];
		if (defaultPage) {
			throw redirect(303, defaultPage);
		}
	}

	// Check if user is accessing an admin path but isn't an admin
	if (currentPath.startsWith('/admin') && userRole !== 'admin') {
		throw redirect(303, '/dashboard');
	}

	// Check if admin is accessing student pages - redirect to admin default
	if (userRole === 'admin' &&
		(currentPath === '/dashboard' || currentPath === '/materials' || currentPath === '/reflections') &&
		!url.searchParams.has('view')) {
		// Allow admins to view student pages with ?view=student parameter
		throw redirect(303, '/admin');
	}

	return {
		userRole,
		userName: userProfile.full_name || userProfile.display_name || 'User'
	};
};