import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const startTime = Date.now();
	const courseSlug = event.params.slug;
	console.log(`[MODULES PAGE] Loading...`);

	// Auth is already done in layout - no need to check again!
	// await requireCourseAdmin(event, courseSlug); // REMOVED - redundant

	// Get layout data (modules and cohorts already loaded, auth already checked)
	const parentStart = Date.now();
	const layoutData = await event.parent();
	console.log(`[MODULES PAGE] ⚡ Parent data (cached): ${Date.now() - parentStart}ms`);

	const modules = layoutData?.modules || [];
	const cohorts = layoutData?.cohorts || [];
	const courseInfo = layoutData?.courseInfo || {};
	const moduleIds = modules?.map(m => m.id) || [];

	try {
		// Only fetch page-specific data (session counts and enrollment counts)
		let modulesWithCounts = [];

		if (moduleIds.length > 0) {
			// Get session counts for each module
			const sessionsStart = Date.now();
			const { data: sessionCounts } = await supabaseAdmin
				.from('courses_sessions')
				.select('module_id')
				.in('module_id', moduleIds);
			console.log(`[MODULES PAGE] Session counts query: ${Date.now() - sessionsStart}ms`);

			// Get cohort counts and enrollments per module
			const sessionCountMap = new Map();
			sessionCounts?.forEach(s => {
				sessionCountMap.set(s.module_id, (sessionCountMap.get(s.module_id) || 0) + 1);
			});

			// Enrich modules with counts
			modulesWithCounts = modules.map(module => ({
				...module,
				sessionCount: sessionCountMap.get(module.id) || 0,
				cohorts: cohorts.filter(c => c.module_id === module.id)
			}));
		}

		// Get total enrollment count
		const cohortIds = cohorts.map(c => c.id);
		let totalEnrollments = 0;

		if (cohortIds.length > 0) {
			const enrollStart = Date.now();
			const { count } = await supabaseAdmin
				.from('courses_enrollments')
				.select('*', { count: 'exact', head: true })
				.in('cohort_id', cohortIds);
			console.log(`[MODULES PAGE] Enrollment count query: ${Date.now() - enrollStart}ms`);

			totalEnrollments = count || 0;
		}

		console.log(`[MODULES PAGE] ✅ Complete in ${Date.now() - startTime}ms\n`);

		return {
			course: courseInfo, // Pass course info from layout
			modules: modulesWithCounts,
			cohorts,
			totalEnrollments,
			moduleCount: modules.length,
			activeCohorts: cohorts.filter(c => c.status === 'active').length
		};

	} catch (err) {
		console.error('Error in modules page load:', err);
		throw error(500, 'Failed to load modules data');
	}
};
