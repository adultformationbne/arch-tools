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
import { getCourseSettings, getAdminCourseFeatures, isHubLeaderMode } from '$lib/types/course-settings.js';
import { getCachedCourseData, setCachedCourseData, invalidateCourseCache } from '$lib/server/course-cache.js';
import { ensureHubLeaderCohorts } from '$lib/server/hub-leader-cohorts.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const load: LayoutServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Always verify auth on every request
	const { user, profile, viaModule } = await requireCourseAdmin(event, courseSlug, {
		mode: 'redirect',
		redirectTo: '/courses'
	});

	if (!user) {
		throw redirect(303, '/courses');
	}

	// Check cache for course data
	const cached = getCachedCourseData(courseSlug);

	let course: any;
	let modules: any[];
	let cohorts: any[];
	let archivedCohorts: any[];
	let hubs: any[];

	if (cached) {
		// Cache hit - skip DB queries
		course = cached.course;
		modules = cached.modules;
		cohorts = cached.cohorts;
		archivedCohorts = cached.archivedCohorts;
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
		archivedCohorts = adminDataResult.data.archivedCohorts;
		hubs = hubsResult.data || [];

		// Store in cache for subsequent navigations
		setCachedCourseData(courseSlug, { course, modules, cohorts, archivedCohorts, hubs });
	}

	const settings = getCourseSettings(course.settings);

	// Hub-leader courses never ask an admin to create cohorts: every module gets one
	// standing cohort. Checked against the data already loaded, so it costs nothing
	// unless a module is actually missing one (a new module, or the mode just changed).
	if (isHubLeaderMode(settings) && modules.some((m) => !cohorts.some((c) => c.module_id === m.id))) {
		try {
			const created = await ensureHubLeaderCohorts(course.id, modules.map((m) => m.id));
			if (created > 0) {
				invalidateCourseCache(courseSlug);
				const refreshed = await CourseAggregates.getAdminCourseData(course.id);
				if (refreshed.data) {
					modules = refreshed.data.modules;
					cohorts = refreshed.data.cohorts;
					archivedCohorts = refreshed.data.archivedCohorts;
					setCachedCourseData(courseSlug, { course, modules, cohorts, archivedCohorts, hubs });
				}
			}
		} catch (err) {
			console.error('Failed to ensure hub-leader cohorts:', err);
		}
	}

	// Extract theme, branding, and feature settings
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};
	// In a hub-leader course the participant-facing features are off, so the admin
	// menu and editors for them are hidden too
	const courseFeatures = getAdminCourseFeatures(course.settings);

	// Check for unread chat messages in selected cohort
	const selectedCohortId = event.url.searchParams.get('cohort');
	let hasUnreadChat = false;
	if (selectedCohortId) {
		const { data: readStatus } = await supabaseAdmin
			.from('courses_chat_read_status')
			.select('last_read_at')
			.eq('cohort_id', selectedCohortId)
			.eq('user_id', user.id)
			.maybeSingle();

		const lastRead = readStatus?.last_read_at || '1970-01-01';

		const { data: newerMessages } = await supabaseAdmin
			.from('courses_chat_messages')
			.select('id')
			.eq('cohort_id', selectedCohortId)
			.is('deleted_at', null)
			.gt('created_at', lastRead)
			.limit(1);

		hasUnreadChat = (newerMessages?.length ?? 0) > 0;
	}

	return {
		courseSlug,
		enrollmentRole: viaModule,
		isCourseAdmin: true,
		modules,
		cohorts,
		archivedCohorts,
		hubs,
		course,
		courseMode: settings.mode ?? 'standard',
		userId: user.id,
		hasUnreadChat,
		courseInfo: {
			id: course.id,
			slug: courseSlug,
			name: course.name,
			shortName: course.short_name,
			description: course.description,
			// The email preview builds its variables in the browser from this object, so it needs the
			// same email settings and theme a real send uses (without them it fell back to ACCF's
			// support address and the default button colour)
			settings: course.settings,
			email_branding_config: course.email_branding_config ?? null,
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
