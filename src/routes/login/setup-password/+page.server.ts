import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * Extract course slug from a redirect URL path
 */
function extractCourseSlugFromPath(path: string): string | null {
	const match = path.match(/^\/courses\/([^/]+)/);
	return match ? match[1] : null;
}

export const load: PageServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { session, user } = await safeGetSession();

	// Must be authenticated to set password
	// Session is established by /login/confirm route via verifyOtp
	if (!session || !user) {
		throw redirect(303, '/login');
	}

	// Try to extract course branding from course param or next param
	const explicitCourse = url.searchParams.get('course');
	const next = url.searchParams.get('next');
	const courseSlug = explicitCourse || (next ? extractCourseSlugFromPath(next) : null);
	let courseBranding = null;

	if (courseSlug) {
		const { data: course } = await supabaseAdmin
			.from('courses')
			.select('id, name, slug, settings')
			.eq('slug', courseSlug)
			.single();

		if (course) {
			const settings = course.settings as {
				theme?: { accentDark?: string; accentLight?: string };
				branding?: { logoUrl?: string; showLogo?: boolean };
			} | null;

			courseBranding = {
				name: course.name,
				slug: course.slug,
				logoUrl: settings?.branding?.logoUrl || null,
				showLogo: settings?.branding?.showLogo ?? true,
				accentDark: settings?.theme?.accentDark || null,
				accentLight: settings?.theme?.accentLight || null
			};
		}
	}

	return {
		user,
		courseBranding
	};
};
