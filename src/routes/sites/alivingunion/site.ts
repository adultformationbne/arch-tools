/**
 * Site-wide constants for the A Living Union marketing site (alivingunion.com).
 * Pages under this folder are served at the domain root via reroute — see
 * $lib/config/course-domains. Sign-in and enrolment happen on the platform
 * host, so those links are absolute. Keep hardcoded copy/links here so pages stay tidy.
 */
import { platformSiteUrl } from '$lib/config/course-domains';

const PLATFORM = platformSiteUrl();

export const SITE = {
	name: 'A Living Union',
	tagline: 'A formation journey for the whole person.',
	courseSlug: 'alivingunion',
	/** Where "Enrol" buttons go. Paste the cohort's enrol code (from Admin → Enrolment links). */
	enrolPath: `${PLATFORM}/enroll/YOURCODE`,
	signInPath: `${PLATFORM}/login?course=alivingunion`,
	contactEmail: 'accf@archdiocesanministries.org.au',
	/** Top navigation. Paths are relative to the domain root; add pages as folders here. */
	nav: [
		{ label: 'Home', href: '/' },
		{ label: 'Privacy', href: '/privacy' }
	]
} as const;
