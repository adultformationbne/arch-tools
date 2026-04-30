import type { PageServerLoad } from './$types';
import { getPlatformSettings } from '$lib/server/supabase.js';

export const load: PageServerLoad = async (event) => {
	// Auth already done in layout - no need to check again
	// Full course record is available from layout (cached)
	const [layoutData, platformSettings] = await Promise.all([
		event.parent(),
		getPlatformSettings()
	]);

	return {
		courseSlug: event.params.slug,
		course: layoutData.course,
		platformFromEmail: platformSettings.fromEmail || ''
	};
};
