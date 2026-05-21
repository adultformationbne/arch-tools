import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCohortStatus, getTotalSessions } from '$lib/utils/cohort-status';
import type { PageServerLoad } from './$types';

/**
 * Modules Management Page
 *
 * Loads module data for course admin panel.
 * Auth is handled in parent layout (+layout.server.ts).
 *
 * Data sources:
 * - Modules & cohorts: From parent layout (cached)
 * - Session counts: Fetched here (page-specific)
 * - Enrollment counts: Fetched here (page-specific)
 */
export const load: PageServerLoad = async (event) => {
	// Get layout data (modules and cohorts already loaded, auth already checked)
	const layoutData = await event.parent();

	const modules = layoutData?.modules || [];
	const cohorts = layoutData?.cohorts || [];
	const courseInfo = layoutData?.courseInfo || {};
	const course = layoutData?.course || {};
	const moduleIds = modules?.map(m => m.id) || [];

	try {
		// Fetch page-specific data: session counts and enrollment counts
		let modulesWithCounts = [];

		if (moduleIds.length > 0) {
			// Get session counts for each module
			const { data: sessionCounts } = await supabaseAdmin
				.from('courses_sessions')
				.select('module_id')
				.in('module_id', moduleIds);

			// Build session count map
			const sessionCountMap = new Map();
			sessionCounts?.forEach(s => {
				sessionCountMap.set(s.module_id, (sessionCountMap.get(s.module_id) || 0) + 1);
			});

			// Fetch public page content + section name for all modules
			const { data: publicPageData } = await supabaseAdmin
				.from('courses_modules')
				.select('id, public_page_content, section_name')
				.in('id', moduleIds);

			const publicPageMap = new Map(
				(publicPageData ?? []).map(m => [m.id, { content: m.public_page_content, sectionName: m.section_name }])
			);

			// Enrich modules with counts, cohorts, and public page content
			modulesWithCounts = modules.map(module => ({
				...module,
				sessionCount: sessionCountMap.get(module.id) || 0,
				cohorts: cohorts.filter(c => c.module_id === module.id),
				public_page_content: publicPageMap.get(module.id)?.content ?? null,
				section_name: publicPageMap.get(module.id)?.sectionName ?? null
			}));
		}

		// Get total enrollment count across all cohorts
		const cohortIds = cohorts.map(c => c.id);
		let totalEnrollments = 0;

		if (cohortIds.length > 0) {
			const { count } = await supabaseAdmin
				.from('courses_enrollments')
				.select('*', { count: 'exact', head: true })
				.in('cohort_id', cohortIds);

			totalEnrollments = count || 0;
		}

		// Compute active cohorts count using session-based status
		const activeCohorts = cohorts.filter(c => {
			const status = getCohortStatus(c.current_session || 0, getTotalSessions(c));
			return status === 'active';
		}).length;

		return {
			course: courseInfo,
			courseTitlePage: course.public_title_page ?? null,
			modules: modulesWithCounts,
			cohorts,
			totalEnrollments,
			moduleCount: modules.length,
			activeCohorts
		};

	} catch (err) {
		console.error('Error in modules page load:', err);
		throw error(500, 'Failed to load modules data');
	}
};
