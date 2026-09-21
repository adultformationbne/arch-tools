/**
 * Marketing domains for individual courses.
 *
 * A course can have a standalone marketing site on its own domain (e.g.
 * alivingunion.com). The domain serves ONLY the pages in
 * src/routes/sites/<site>/ — sign-in, enrolment and the course itself stay on
 * the platform host, so sessions live on a single domain.
 *
 * The host → site map is deliberately hardcoded: adding a domain also needs
 * DNS and a Vercel domain entry, so it is a deploy-time change.
 *
 * Importable from both client and server code.
 */
import { PUBLIC_SITE_URL } from '$env/static/public';

/** Host of the platform (login, enrolment, courses, admin, DGR). */
export const PLATFORM_HOST = 'app.archdiocesanministries.org.au';

export interface CourseDomain {
	/** Course this site markets (used for the site's sign-in / enrol links) */
	slug: string;
	/**
	 * Folder under src/routes/sites/ holding the domain's pages. On the host,
	 * `/` → /sites/<site>, `/privacy` → /sites/<site>/privacy, and so on.
	 */
	site: string;
}

/** host → site. List the bare domain and any `www.` alias. */
export const COURSE_DOMAINS: Record<string, CourseDomain> = {
	'alivingunion.com': { slug: 'alivingunion', site: 'alivingunion' },
	'www.alivingunion.com': { slug: 'alivingunion', site: 'alivingunion' }
};

/**
 * First path segments that belong to the app. On a marketing domain these are
 * bounced to the platform host; every other path is served from the site folder.
 */
const APP_ROUTE_PREFIXES = new Set([
	'courses', 'my-courses', 'login', 'auth', 'enroll', 'p', 'api', 'profile', 'settings',
	'data-policy', 'admin', 'dgr', 'users', 'editor', 'readings', 'cardpacks', 'dev',
	'lectionary-test', 'test-emails'
]);

/** Paths that are neither app routes nor site pages (framework + static assets). */
const PASSTHROUGH_PREFIXES = new Set(['sites', '_app', 'favicon.ico', 'robots.txt', 'sitemap.xml']);

function normaliseHost(host: string | null | undefined): string {
	return (host || '').trim().toLowerCase().replace(/:\d+$/, '');
}

function firstSegment(pathname: string): string {
	return pathname.split('/')[1] ?? '';
}

/** The marketing domain entry for this host, or null for the platform host / unknown hosts. */
export function courseDomainForHost(host: string | null | undefined): CourseDomain | null {
	return COURSE_DOMAINS[normaliseHost(host)] ?? null;
}

/** True for paths that must be served by the platform host (login, enrol, courses, api, ...). */
export function isAppPath(pathname: string): boolean {
	return APP_ROUTE_PREFIXES.has(firstSegment(pathname));
}

/**
 * Where a request on a marketing domain should be routed internally, or null
 * to leave it alone. Site paths map into src/routes/sites/<site>/...
 */
export function marketingRouteFor(host: string | null | undefined, pathname: string): string | null {
	const domain = courseDomainForHost(host);
	if (!domain) return null;
	const first = firstSegment(pathname);
	if (first && (APP_ROUTE_PREFIXES.has(first) || PASSTHROUGH_PREFIXES.has(first))) return null;
	return `/sites/${domain.site}${pathname === '/' ? '' : pathname}`;
}

/** Canonical marketing host for a course, or null if it has none. */
export function hostForCourseSlug(slug: string | null | undefined): string | null {
	if (!slug) return null;
	for (const [host, d] of Object.entries(COURSE_DOMAINS)) {
		if (d.slug === slug) return host;
	}
	return null;
}

/** Absolute URL of the platform host — every sign-in / enrol link from a marketing site points here. */
export function platformSiteUrl(): string {
	return PUBLIC_SITE_URL || `https://${PLATFORM_HOST}`;
}
