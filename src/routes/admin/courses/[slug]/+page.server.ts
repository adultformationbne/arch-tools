import { supabaseAdmin } from '$lib/server/supabase.js';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await event.locals.safeGetSession();

	// Get layout data (modules and cohorts already loaded)
	const layoutData = await event.parent();
	const modules = layoutData?.modules || [];
	const cohorts = layoutData?.cohorts || [];

	// Load the course's hubs and each cohort's assigned hub set (for the
	// per-cohort hub assignment UI in CohortSettingsModal).
	let courseHubs: { id: string; name: string; location: string | null }[] = [];
	let cohortHubMap: Record<string, string[]> = {};
	if (courseSlug) {
		const { data: course } = await supabaseAdmin
			.from('courses')
			.select('id')
			.eq('slug', courseSlug)
			.single();

		if (course) {
			const { data: hubRows } = await supabaseAdmin
				.from('courses_hubs')
				.select('id, name, location')
				.eq('course_id', course.id)
				.order('name');
			courseHubs = hubRows || [];

			const cohortIds = cohorts.map((c: { id: string }) => c.id);
			if (cohortIds.length > 0) {
				const { data: assignments } = await supabaseAdmin
					.from('cohorts_hubs')
					.select('cohort_id, hub_id')
					.in('cohort_id', cohortIds);
				for (const row of assignments || []) {
					(cohortHubMap[row.cohort_id] ??= []).push(row.hub_id);
				}
			}
		}
	}

	// Auto-select first cohort if none selected (preserve other params like action)
	const cohortParam = event.url.searchParams.get('cohort');
	if (!cohortParam && cohorts.length > 0) {
		const firstCohort = cohorts[0];
		const newUrl = new URL(event.url);
		newUrl.searchParams.set('cohort', firstCohort.id);
		throw redirect(303, newUrl.pathname + newUrl.search);
	}

	return {
		modules,
		cohorts,
		courseSlug,
		courseHubs,
		cohortHubMap,
		currentUserEmail: user?.email || '',
	};
};