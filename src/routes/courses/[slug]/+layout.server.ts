import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth';

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	const { slug } = params;

	// Load course by slug
	const { data: course, error: courseError } = await supabaseAdmin
		.from('courses')
		.select('*')
		.eq('slug', slug)
		.single();

	if (courseError || !course) {
		throw error(404, `Course "${slug}" not found`);
	}

	// Use unified auth function to check course access
	// This handles both enrollment and module-level access
	const { user, enrollment } = await requireCourseAccess(event, slug, {
		mode: 'redirect',
		redirectTo: '/courses'
	});

	const enrollmentRole = enrollment?.role ?? null;

	// Get full user profile for display
	const parentData = await event.parent();
	const { userProfile } = parentData;

	// Extract theme and branding from course settings
	const settings = course.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};

	return {
		userRole: enrollmentRole || 'student', // Use actual role: 'student' or 'coordinator'
		userName: userProfile?.full_name || userProfile?.display_name || 'User',
		userProfile,
		courseSlug: slug,
		enrollmentRole,
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
