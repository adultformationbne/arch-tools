import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Auth already done in layout - no need to check again
	// Full course record is available from layout (cached)
	const layoutData = await event.parent();

	return {
		courseSlug: event.params.slug,
		course: layoutData.course
	};
};
