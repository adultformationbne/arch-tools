import type { PageServerLoad } from './$types';
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

export const load: PageServerLoad = async ({ url }) => {
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
