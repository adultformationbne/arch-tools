import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async (event) => {
	// ✅ OPTIMIZATION: Auth already done in layout - no need to check again!

	// Get layout data (course already loaded)
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo;

	const course = courseInfo ? { id: courseInfo.id } : null;

	if (!course) {
		return { cohorts: [], hubs: [] };
	}

	// Get cohorts for this course's modules
	const { data: cohorts, error: cohortsError } = await supabaseAdmin
		.from('courses_cohorts')
		.select(`
			id,
			name,
			start_date,
			end_date,
			status,
			module:courses_modules (
				id,
				name,
				course_id
			)
		`)
		.eq('courses_modules.course_id', course.id)
		.order('start_date', { ascending: false });

	if (cohortsError) {
		console.error('Error fetching cohorts:', cohortsError);
		return { cohorts: [], hubs: [] };
	}

	// Get all hubs for filtering
	const { data: hubs, error: hubsError } = await supabaseAdmin
		.from('courses_hubs')
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