import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
	const session = await locals.safeGetSession();

	if (!session) {
		return { cohorts: [], hubs: [] };
	}

	// Get all cohorts with module info
	const { data: cohorts, error: cohortsError } = await supabaseAdmin
		.from('cohorts')
		.select(`
			id,
			name,
			start_date,
			end_date,
			status,
			modules (
				id,
				name
			)
		`)
		.order('start_date', { ascending: false });

	if (cohortsError) {
		console.error('Error fetching cohorts:', cohortsError);
		return { cohorts: [], hubs: [] };
	}

	// Get all hubs for filtering
	const { data: hubs, error: hubsError } = await supabaseAdmin
		.from('hubs')
		.select('id, name')
		.order('name');

	if (hubsError) {
		console.error('Error fetching hubs:', hubsError);
		return { cohorts: cohorts || [], hubs: [] };
	}

	return {
		cohorts: cohorts || [],
		hubs: hubs || []
	};
};