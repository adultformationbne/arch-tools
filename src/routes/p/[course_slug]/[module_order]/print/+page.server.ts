import { error } from '@sveltejs/kit';
import { loadPublicGuide } from '$lib/server/public-guide.js';
import type { PageServerLoad } from './$types';

// The printable version of a guide: everything on one page, or a single session
// with ?session=N. The daily PDF build renders this page with headless Chromium.
export const load: PageServerLoad = async ({ params, url }) => {
	const orderNum = parseInt(params.module_order, 10);
	if (isNaN(orderNum)) throw error(404, 'Not found');

	const guide = await loadPublicGuide(params.course_slug, orderNum);
	if (!guide) throw error(404, 'Not found');

	const sessionParam = url.searchParams.get('session');
	if (sessionParam === null) return { ...guide, single: false };

	const session = guide.sessions.find(s => s.sessionNumber === parseInt(sessionParam, 10));
	if (!session) throw error(404, 'Not found');

	return { ...guide, sessions: [session], single: true };
};
