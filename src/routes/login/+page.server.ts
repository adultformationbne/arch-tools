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

/**
 * Determine redirect path based on user modules
 */
function getRedirectForModules(modules: string[]): string {
	if (modules.includes('users')) return '/users';
	if (modules.includes('editor')) return '/editor';
	if (modules.includes('dgr')) return '/dgr';
	if (modules.includes('courses.admin') || modules.includes('courses.manager')) return '/admin/courses';
	if (modules.includes('courses.participant')) return '/my-courses';
	return '/profile';
}

export const load: PageServerLoad = async ({ url, locals }) => {
	// Check if user is already authenticated
	let authenticatedUser: { email: string; name: string | null; redirectTo: string } | null = null;

	try {
		const session = await locals.safeGetSession?.();
		if (session?.user) {
			const next = url.searchParams.get('next');
			const courseParam = url.searchParams.get('course');

			// Fetch user profile for name and modules
			const { data: profile } = await supabaseAdmin
				.from('user_profiles')
				.select('name, modules')
				.eq('id', session.user.id)
				.single();

			// Determine where they would go
			let redirectTo: string;

			if (next && isValidRedirect(next)) {
				redirectTo = next;
			} else if (courseParam && isValidCourseSlug(courseParam)) {
				redirectTo = `/courses/${courseParam}`;
			} else {
				const modules = profile?.modules || [];
				redirectTo = getRedirectForModules(modules);
			}

			// Return authenticated user info instead of redirecting
			authenticatedUser = {
				email: session.user.email || 'Unknown',
				name: profile?.name || null,
				redirectTo
			};
		}
	} catch (e) {
		// Log errors but continue to render login page
		console.error('Error checking session:', e);
	}
	// Check for explicit course parameter first (from email links)
	// Then try to extract from the next redirect path
	const explicitCourse = url.searchParams.get('course');
	const next = url.searchParams.get('next');

	// Determine course slug from either source
	const courseSlug = explicitCourse || (next ? extractCourseSlugFromPath(next) : null);

	if (!courseSlug) {
		return { courseBranding: null, authenticatedUser };
	}

	// Fetch course branding data
	const { data: course, error } = await supabaseAdmin
		.from('courses')
		.select('id, name, slug, settings')
		.eq('slug', courseSlug)
		.single();

	if (error || !course) {
		// Course not found or error - fall back to platform branding
		return { courseBranding: null, authenticatedUser };
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
		},
		authenticatedUser
	};
};
