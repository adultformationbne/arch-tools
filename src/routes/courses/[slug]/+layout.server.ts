import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { hasModule, hasModuleLevel } from '$lib/server/auth';

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

	const userModules: string[] = userProfile.modules ?? [];
	const hasGlobalCourseAdmin = hasModuleLevel(userModules, 'courses.admin') || hasModule(userModules, 'users');
	const hasCourseManager = hasModuleLevel(userModules, 'courses.manager');
	const hasParticipantModule = hasModuleLevel(userModules, 'courses.participant');

	const { data: enrollment } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			role,
			status,
			courses_cohorts!inner (
				id,
				courses_modules!inner (
					courses!inner (
						slug
					)
				)
			)
		`)
		.eq('user_profile_id', userProfile.id)
		.eq('courses_cohorts.courses_modules.courses.slug', slug)
		.in('status', ['active', 'invited', 'accepted'])
		.maybeSingle();

	const enrollmentRole = enrollment?.role ?? null;
	const isCourseAdmin = hasGlobalCourseAdmin || (hasCourseManager && enrollmentRole === 'admin');
	const hasCourseAccess = isCourseAdmin || !!enrollmentRole || hasParticipantModule;

	if (!hasCourseAccess) {
		throw redirect(303, '/my-courses');
	}

	const currentPath = url.pathname;
	const adminPath = `/courses/${slug}/admin`;
	const participantPath = `/courses/${slug}/dashboard`;

	if (currentPath === `/courses/${slug}` || currentPath === `/courses/${slug}/`) {
		throw redirect(303, isCourseAdmin ? adminPath : participantPath);
	}

	if (currentPath.includes('/admin') && !isCourseAdmin) {
		throw redirect(303, participantPath);
	}

	if (
		isCourseAdmin &&
		!currentPath.includes('/admin') &&
		(currentPath.includes('/dashboard') || currentPath.includes('/materials') || currentPath.includes('/reflections')) &&
		!url.searchParams.has('view')
	) {
		throw redirect(303, adminPath);
	}

	// Extract theme and branding from course settings
	const settings = course.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};
	const userRole = isCourseAdmin ? 'admin' : 'student';

	return {
		userRole,
		userName: userProfile.full_name || userProfile.display_name || 'User',
		userProfile,
		courseSlug: slug,
		enrollmentRole,
		isCourseAdmin,
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
