import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const load: LayoutServerLoad = async ({ params, url, parent }) => {
	const { slug } = params;
	const parentData = await parent();
	const { userProfile } = parentData;

	// Load course by slug
	const { data: course, error: courseError } = await supabaseAdmin
		.from('courses')
		.select('*')
		.eq('slug', slug)
		.single();

	if (courseError || !course) {
		throw error(404, `Course "${slug}" not found`);
	}

	if (!userProfile) {
		// No user found, redirect to platform login
		throw redirect(303, `/auth?next=${url.pathname}`);
	}

	// Role-based routing logic
	const userRole = userProfile.role;
	const currentPath = url.pathname;

	// Define default landing pages for each role (within this course)
	const defaultPages = {
		'admin': `/courses/${slug}/admin`,
		'student': `/courses/${slug}/dashboard`,
		'hub_coordinator': `/courses/${slug}/dashboard`
	};

	// Check if user is trying to access root course path
	if (currentPath === `/courses/${slug}` || currentPath === `/courses/${slug}/`) {
		const defaultPage = defaultPages[userRole];
		if (defaultPage) {
			throw redirect(303, defaultPage);
		}
	}

	// Check if user is accessing an admin path but isn't an admin
	if (currentPath.includes('/admin') && userRole !== 'admin') {
		throw redirect(303, `/courses/${slug}/dashboard`);
	}

	// Check if admin is accessing student pages - redirect to admin default
	// But don't redirect if they're already in the admin section
	if (userRole === 'admin' &&
		!currentPath.includes('/admin') &&
		(currentPath.includes('/dashboard') || currentPath.includes('/materials') || currentPath.includes('/reflections')) &&
		!url.searchParams.has('view')) {
		// Allow admins to view student pages with ?view=student parameter
		throw redirect(303, `/courses/${slug}/admin`);
	}

	// Extract theme and branding from course settings
	const settings = course.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};

	return {
		userRole,
		userName: userProfile.full_name || userProfile.display_name || 'User',
		userProfile,
		courseSlug: slug,
		courseInfo: {
			id: course.id,
			slug: course.slug,
			name: course.name,
			shortName: course.short_name,
			description: course.description
		},
		courseTheme,
		courseBranding
	};
};
