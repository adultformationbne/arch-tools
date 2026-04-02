import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo;
	const courseFeatures = layoutData?.courseFeatures || {};

	if (!courseInfo) {
		throw error(404, 'Course not found');
	}

	if (courseFeatures.attendanceEnabled === false) {
		throw redirect(302, `/admin/courses/${event.params.slug}`);
	}

	return {
		totalSessions: courseInfo.total_sessions || 0
	};
};
