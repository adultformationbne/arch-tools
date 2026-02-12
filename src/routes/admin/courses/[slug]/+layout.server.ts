/**
 * Admin Course Layout - Server Load Function
 *
 * Loads base course, module, cohort, and hub data for all admin pages.
 * Uses in-memory TTL cache (30s) to avoid re-running DB queries
 * on every client-side navigation. Auth is always verified.
 *
 * Child pages access this data via event.parent() to avoid redundant queries.
 */

import type { LayoutServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth.js';
import { CourseQueries, CourseAggregates } from '$lib/server/course-data.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import { getCachedCourseData, setCachedCourseData } from '$lib/server/course-cache.js';

export const load: LayoutServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Always verify auth on every request
	const { user, enrollment } = await requireCourseAdmin(event, courseSlug, {
		mode: 'redirect',
		redirectTo: '/courses'
	});

	// Check cache for course data
	const cached = getCachedCourseData(courseSlug);

	let course: any;
	let modules: any[];
	let cohorts: any[];
	let hubs: any[];

	if (cached) {
		// Cache hit - skip DB queries
		course = cached.course;
		modules = cached.modules;
		cohorts = cached.cohorts;
		hubs = cached.hubs;
	} else {
		// Cache miss - run full queries
		const { data: courseData, error: courseError } = await CourseQueries.getCourse(courseSlug);

		if (courseError || !courseData) {
			throw redirect(303, '/courses');
		}

		course = courseData;

		// Fetch modules, cohorts, and hubs in parallel
		const [adminDataResult, hubsResult] = await Promise.all([
			CourseAggregates.getAdminCourseData(course.id),
			CourseQueries.getHubs(course.id)
		]);

		if (adminDataResult.error || !adminDataResult.data) {
			throw error(500, 'Failed to load admin course data');
		}

		modules = adminDataResult.data.modules;
		cohorts = adminDataResult.data.cohorts;
		hubs = hubsResult.data || [];

		// Store in cache for subsequent navigations
		setCachedCourseData(courseSlug, { course, modules, cohorts, hubs });
	}

	// Extract theme, branding, and feature settings
	const settings = getCourseSettings(course.settings);
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};
	const courseFeatures = settings.features || {};

	return {
		courseSlug,
		enrollmentRole: enrollment?.role,
		isCourseAdmin: true,
		modules,
		cohorts,
		hubs,
		course,
		courseInfo: {
			id: course.id,
			slug: courseSlug,
			name: course.name,
			shortName: course.short_name,
			description: course.description,
			logo_url: courseBranding?.logoUrl || null,
			accent_dark: courseTheme?.accentDark || course.accent_dark || '#334642',
			accent_light: courseTheme?.accentLight || course.accent_light || '#eae2d9',
			accent_darkest: courseTheme?.accentDarkest || course.accent_darkest || '#1e2322'
		},
		courseTheme,
		courseBranding,
		courseFeatures
	};
};
