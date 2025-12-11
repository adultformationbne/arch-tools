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

	// Auto-select first cohort if none selected
	const cohortParam = event.url.searchParams.get('cohort');
	if (!cohortParam && cohorts.length > 0) {
		const firstCohort = cohorts[0];
		throw redirect(303, `/admin/courses/${courseSlug}?cohort=${firstCohort.id}`);
	}

	return {
		modules,
		cohorts,
		courseSlug,
		currentUserEmail: user?.email || ''
	};
};