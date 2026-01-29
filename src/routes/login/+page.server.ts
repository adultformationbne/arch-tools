import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * Extract course slug from a redirect URL path
 * Supports patterns like:
 *   /courses/accf/dashboard -> accf
 *   /courses/cli/reflections -> cli
 *   /my-courses -> null
 */
function extractCourseSlugFromPath(path: string): string | null {
	// Match /courses/{slug}/... pattern
	const match = path.match(/^\/courses\/([^/]+)/);
	return match ? match[1] : null;
}

/**
 * Validate redirect URL to prevent open redirect vulnerabilities
 * Only allows relative paths starting with /
 */
function isValidRedirect(url: string | null): boolean {
	if (!url) return false;
	// Must start with / and not // (which could be protocol-relative URL)
	return url.startsWith('/') && !url.startsWith('//');
}

/**
 * Sanitize course slug to prevent injection
 */
function isValidCourseSlug(slug: string | null): boolean {
	if (!slug) return false;
	// Only allow alphanumeric, hyphens, and underscores
	return /^[a-zA-Z0-9_-]+$/.test(slug);
}

export const load: PageServerLoad = async ({ url, locals }) => {
	// Check if user is already authenticated - redirect them away from login
	try {
		const session = await locals.safeGetSession?.();
		if (session?.user) {
			const next = url.searchParams.get('next');
			const courseParam = url.searchParams.get('course');

			// Validate and use next param if safe
			if (next && isValidRedirect(next)) {
				throw redirect(302, next);
			} else if (courseParam && isValidCourseSlug(courseParam)) {
				throw redirect(302, `/courses/${courseParam}`);
			} else {
				// Check user's modules to determine redirect
				const { data: profile } = await supabaseAdmin
					.from('user_profiles')
					.select('modules')
					.eq('id', session.user.id)
					.single();

				const modules = profile?.modules || [];

				// Determine redirect based on modules (same logic as client-side)
				if (modules.includes('users')) {
					throw redirect(302, '/users');
				} else if (modules.includes('editor')) {
					throw redirect(302, '/editor');
				} else if (modules.includes('dgr')) {
					throw redirect(302, '/dgr');
				} else if (modules.includes('courses.admin') || modules.includes('courses.manager')) {
					throw redirect(302, '/admin/courses');
				} else if (modules.includes('courses.participant')) {
					throw redirect(302, '/my-courses');
				} else {
					throw redirect(302, '/profile');
				}
			}
		}
	} catch (e) {
		// Re-throw redirects
		if (e && typeof e === 'object' && 'status' in e && (e.status === 302 || e.status === 303)) {
			throw e;
		}
		// Log other errors but continue to render login page
		console.error('Error checking session:', e);
	}
	// Check for explicit course parameter first (from email links)
	// Then try to extract from the next redirect path
	const explicitCourse = url.searchParams.get('course');
	const next = url.searchParams.get('next');

	// Determine course slug from either source
	const courseSlug = explicitCourse || (next ? extractCourseSlugFromPath(next) : null);

	if (!courseSlug) {
		return { courseBranding: null };
	}

	// Fetch course branding data
	const { data: course, error } = await supabaseAdmin
		.from('courses')
		.select('id, name, slug, settings')
		.eq('slug', courseSlug)
		.single();

	if (error || !course) {
		// Course not found or error - fall back to platform branding
		return { courseBranding: null };
	}

	// Extract branding from course settings
	const settings = course.settings as {
		theme?: { accentDark?: string; accentLight?: string };
		branding?: { logoUrl?: string; showLogo?: boolean }
	} | null;

	return {
		courseBranding: {
			name: course.name,
			slug: course.slug,
			logoUrl: settings?.branding?.logoUrl || null,
			showLogo: settings?.branding?.showLogo ?? true,
			accentDark: settings?.theme?.accentDark || null,
			accentLight: settings?.theme?.accentLight || null
		}
	};
};
