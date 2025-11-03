import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { hasModuleLevel } from '$lib/server/auth';

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
		throw redirect(303, `/auth?next=${url.pathname}`);
	}

	const userModules: string[] = userProfile.modules ?? [];
	const hasParticipantModule = hasModuleLevel(userModules, 'courses.participant');

	// Check for enrollment (participants only)
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
	const hasAccess = !!enrollmentRole || hasParticipantModule;

	if (!hasAccess) {
		throw redirect(303, '/courses');
	}

	// Extract theme and branding from course settings
	const settings = course.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};

	return {
		userRole: enrollmentRole || 'student', // Use actual role: 'student' or 'coordinator'
		userName: userProfile.full_name || userProfile.display_name || 'User',
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
