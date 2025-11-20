/**
 * Admin Course Layout - Server Load Function
 *
 * Loads base course and module/cohort data for all admin pages.
 * Uses CourseAggregates.getAdminCourseData() for optimized parallel queries.
 *
 * Data structure is consumed by:
 * - Admin dashboard (+page.svelte)
 * - Sessions editor (sessions/+page.svelte)
 * - Attendance (attendance/+page.svelte)
 * - Reflections (reflections/+page.svelte)
 */

import type { LayoutServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth.js';
import { CourseQueries, CourseAggregates } from '$lib/server/course-data.js';

export const load: LayoutServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require admin access (via courses.admin module OR courses.manager + enrolled as admin)
	const { user, enrollment } = await requireCourseAdmin(event, courseSlug, {
		mode: 'redirect',
		redirectTo: '/courses'
	});

	// Get course by slug
	const { data: course, error: courseError } = await CourseQueries.getCourse(courseSlug);

	if (courseError || !course) {
		throw redirect(303, '/courses');
	}

	// Load admin course data (modules + cohorts) in parallel
	const result = await CourseAggregates.getAdminCourseData(course.id);

	if (result.error || !result.data) {
		throw error(500, 'Failed to load admin course data');
	}

	// Extract theme and branding settings
	const settings = course.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};

	return {
		courseSlug,
		enrollmentRole: enrollment?.role,
		isCourseAdmin: true,
		modules: result.data.modules,
		cohorts: result.data.cohorts,
		courseInfo: {
			id: course.id,
			slug: courseSlug,
			name: course.name,
			shortName: course.short_name,
			description: course.description
		},
		courseTheme,
		courseBranding
	};
};
