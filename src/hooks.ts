import type { Reroute } from '@sveltejs/kit';
import { marketingRouteFor } from '$lib/config/course-domains';

/**
 * On a course's marketing domain, paths are served from that domain's site
 * folder (src/routes/sites/<site>/...) without changing the address bar:
 * `/` → /sites/<site>, `/privacy` → /sites/<site>/privacy.
 */
export const reroute: Reroute = ({ url }) => {
	return marketingRouteFor(url.host, url.pathname) ?? undefined;
};
