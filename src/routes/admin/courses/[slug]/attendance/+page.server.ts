import type { PageServerLoad } from './$types';
import { CourseAggregates } from '$lib/server/course-data';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	// ✅ OPTIMIZATION: Auth already done in layout - no need to check again!

	// Get layout data (course already loaded)
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo;

	if (!courseInfo) {
		throw error(404, 'Course not found');
	}

	const cohortId = event.url.searchParams.get('cohort');

	if (!cohortId) {
		// Return cohorts list for selection (already available from layout)
		return {
			cohorts: layoutData.cohorts || [],
			attendanceData: null
		};
	}

	// Get full attendance grid using repository aggregate
	const result = await CourseAggregates.getAttendanceGrid(cohortId);

	if (result.error) {
		console.error('Error loading attendance grid:', result.error);
		throw error(500, 'Failed to load attendance data');
	}

	return {
		attendanceData: result.data
	};
};
