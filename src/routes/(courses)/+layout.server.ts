import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ url, parent }) => {
	console.log('=== COURSES LAYOUT SERVER LOAD ===');
	console.log('URL:', url.pathname);

	const parentData = await parent();
	console.log('Parent data keys:', Object.keys(parentData));
	console.log('Has userProfile:', !!parentData.userProfile);
	console.log('Has devUser:', !!parentData.devUser);

	const { userProfile, devUser } = parentData;

	// Get the current user (dev user or real user)
	const user = devUser || userProfile;
	console.log('Final user:', user ? user.email || user.full_name : 'none');

	if (!user) {
		console.log('No user found in Courses layout, returning empty');
		// No user found, let parent layout handle auth
		return {};
	}

	// Role-based routing logic
	const userRole = user.role;
	const currentPath = url.pathname;

	// Define default landing pages for each role
	const defaultPages = {
		'courses_admin': '/admin',
		'courses_student': '/dashboard',
		'hub_coordinator': '/dashboard' // Hub coordinators see student view for now
	};

	// Define which paths each role can access
	const allowedPaths = {
		'courses_admin': ['/admin', '/dashboard', '/materials', '/reflections', '/courses-profile'],
		'courses_student': ['/dashboard', '/materials', '/reflections', '/courses-profile'],
		'hub_coordinator': ['/dashboard', '/materials', '/reflections', '/courses-profile']
	};

	// Check if user is trying to access root courses path
	if (currentPath === '/') {
		const defaultPage = defaultPages[userRole];
		if (defaultPage) {
			throw redirect(303, defaultPage);
		}
	}

	// Check if user is accessing an admin path but isn't an admin
	if (currentPath.startsWith('/admin') && userRole !== 'courses_admin') {
		throw redirect(303, '/dashboard');
	}

	// Check if admin is accessing student pages - redirect to admin default
	if (userRole === 'courses_admin' &&
		(currentPath === '/dashboard' || currentPath === '/materials' || currentPath === '/reflections') &&
		!url.searchParams.has('view')) {
		// Allow admins to view student pages with ?view=student parameter
		throw redirect(303, '/admin');
	}

	console.log('Courses layout returning:', {
		userRole,
		userName: user.full_name || user.name || 'User',
		currentPath
	});

	return {
		userRole,
		userName: user.full_name || user.name || 'User'
	};
};