import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const layoutCohorts = parentData.cohorts || [];
	const layoutHubs = parentData.hubs || [];

	const cohortIds = layoutCohorts.map((c) => c.id);

	// Only page-specific query needed: enrollment links
	let enrollmentLinks: any[] = [];
	if (cohortIds.length > 0) {
		const { data } = await supabaseAdmin
			.from('courses_enrollment_links')
			.select(
				`
				id,
				code,
				name,
				is_active,
				expires_at,
				max_uses,
				uses_count,
				price_cents,
				cohort_id,
				hub_id,
				created_at,
				hub:courses_hubs(
					id,
					name
				)
			`
			)
			.in('cohort_id', cohortIds)
			.order('created_at', { ascending: false });
		enrollmentLinks = data || [];
	}

	return {
		cohorts: layoutCohorts,
		enrollmentLinks,
		hubs: layoutHubs
	};
};
