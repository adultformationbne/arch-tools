import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { hostForCourseSlug } from '$lib/config/course-domains';
import { SITE } from './site';
import type { LayoutServerLoad } from './$types';

/**
 * The marketing site is only meant to be seen at its own domain. In production,
 * a direct hit on the platform host (/sites/alivingunion/...) bounces to the
 * domain; in dev the /sites/... path is the way to preview it.
 */
export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!dev && locals.courseDomain?.slug !== SITE.courseSlug) {
		const host = hostForCourseSlug(SITE.courseSlug);
		if (host) {
			const rest = url.pathname.replace(/^\/sites\/[^/]+/, '') || '/';
			throw redirect(307, `https://${host}${rest}${url.search}`);
		}
	}
	return { site: SITE };
};
