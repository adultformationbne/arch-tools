/**
 * Site-wide constants for the A Living Union marketing site (alivingunion.com).
 * Pages under this folder are served at the domain root via reroute — see
 * $lib/config/course-domains. Keep hardcoded copy/links here so pages stay tidy.
 *
 * The course launches in 2027; until then the site is a single "register
 * interest" landing page whose form emails `interestEmail`.
 */
export const SITE = {
	name: 'A Living Union',
	tagline:
		'A small-group resource to help Christians move beyond simply practising the Catholic faith to living it more deeply.',
	launch: 'Coming in 2027',
	courseSlug: 'alivingunion',
	/** Where register-interest submissions are sent */
	interestEmail: 'formation@archdiocesanministries.org.au',
	contactEmail: 'formation@archdiocesanministries.org.au',
	privacyUrl: 'https://archdiocesanministries.org.au/privacy-policy/',
	/** Static assets live in static/sites/alivingunion/ */
	assets: '/sites/alivingunion'
} as const;
