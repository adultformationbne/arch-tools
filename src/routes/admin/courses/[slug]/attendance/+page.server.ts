import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo;

	if (!courseInfo) {
		throw error(404, 'Course not found');
	}

	return {
		totalSessions: courseInfo.total_sessions || 8
	};
};
