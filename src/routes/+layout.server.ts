import { redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { LayoutServerLoad } from './$types';

type CourseSettings = {
	theme?: Record<string, unknown> | null;
	branding?: Record<string, unknown> | null;
} | null;

type CourseRecord = {
	id: string;
	name: string | null;
	settings: CourseSettings;
} | null;

const DEFAULT_THEME = {
	accentLight: '#c59a6b',
	accentDark: '#334642',
	accentDarkest: '#1e2322',
	surface: '#eae2d9',
	lightest: '#ffffff',
	textOnDark: '#ffffff',
	textOnLight: '#1e2322',
	borderMuted: 'rgba(234, 226, 217, 0.3)',
	fontFamily: 'Inter',
	navBackground: 'rgba(51, 70, 66, 0.85)'
} as const;

const DEFAULT_BRANDING = {
	logoUrl: '/accf-logo.png',
	showLogo: true
} as const;

function normalizeColor(value: unknown, fallback: string): string {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) || /^rgba?\(/i.test(trimmed)) {
		return trimmed;
	}
	return fallback;
}

function hexToRgb(hex: string) {
	if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return null;
	let normalized = hex.slice(1);
	if (normalized.length === 3) {
		normalized = normalized
			.split('')
			.map(char => char + char)
			.join('');
	}
	const numeric = parseInt(normalized, 16);
	return {
		r: (numeric >> 16) & 255,
		g: (numeric >> 8) & 255,
		b: numeric & 255
	};
}

function rgbaFromHex(hex: string, alpha: number) {
	const rgb = hexToRgb(hex);
	if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
	const { r, g, b } = rgb;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toHex(value: number) {
	return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

function darkenHex(hex: string, amount: number) {
	const rgb = hexToRgb(hex);
	if (!rgb) return hex;
	return `#${toHex(rgb.r * (1 - amount))}${toHex(rgb.g * (1 - amount))}${toHex(rgb.b * (1 - amount))}`;
}

function lightenHex(hex: string, amount: number) {
	const rgb = hexToRgb(hex);
	if (!rgb) return hex;
	return `#${toHex(rgb.r + (255 - rgb.r) * amount)}${toHex(rgb.g + (255 - rgb.g) * amount)}${toHex(
		rgb.b + (255 - rgb.b) * amount
	)}`;
}

function buildCourseTheme(settings: CourseSettings) {
	const themeSettings = (settings?.theme ?? {}) as Record<string, unknown>;

	const accentDark = normalizeColor(themeSettings.accentDark, DEFAULT_THEME.accentDark);
	const accentLight = normalizeColor(themeSettings.accentLight, DEFAULT_THEME.accentLight);
	const surface = normalizeColor(themeSettings.surface, DEFAULT_THEME.surface);

	const accentDarkest = normalizeColor(
		themeSettings.accentDarkest,
		hexToRgb(accentDark) ? darkenHex(accentDark, 0.25) : DEFAULT_THEME.accentDarkest
	);
	const lightest = normalizeColor(
		themeSettings.lightest,
		hexToRgb(surface) ? lightenHex(surface, 0.4) : DEFAULT_THEME.lightest
	);

	const textOnDark = normalizeColor(themeSettings.textOnDark, DEFAULT_THEME.textOnDark);
	const textOnLight = normalizeColor(themeSettings.textOnLight, DEFAULT_THEME.textOnLight);

	const borderMuted =
		typeof themeSettings.borderMuted === 'string' && themeSettings.borderMuted.trim()
			? (themeSettings.borderMuted as string).trim()
			: hexToRgb(surface)
				? rgbaFromHex(surface, 0.3)
				: DEFAULT_THEME.borderMuted;

	const navBackground =
		typeof themeSettings.navBackground === 'string' && themeSettings.navBackground.trim()
			? (themeSettings.navBackground as string).trim()
			: rgbaFromHex(accentDark, 0.85);

	const fontFamily =
		typeof themeSettings.fontFamily === 'string' && themeSettings.fontFamily.trim()
			? (themeSettings.fontFamily as string).trim()
			: DEFAULT_THEME.fontFamily;

	return {
		accentLight,
		accentDark,
		accentDarkest,
		surface,
		lightest,
		textOnDark,
		textOnLight,
		borderMuted,
		fontFamily,
		navBackground
	};
}

function buildCourseBranding(settings: CourseSettings) {
	const brandingSettings = (settings?.branding ?? {}) as Record<string, unknown>;

	const logoUrl =
		typeof brandingSettings.logoUrl === 'string' && brandingSettings.logoUrl.trim()
			? (brandingSettings.logoUrl as string).trim()
			: DEFAULT_BRANDING.logoUrl;

	const showLogo =
		typeof brandingSettings.showLogo === 'boolean'
			? (brandingSettings.showLogo as boolean)
			: DEFAULT_BRANDING.showLogo;

	const title =
		typeof brandingSettings.title === 'string' && brandingSettings.title.trim()
			? (brandingSettings.title as string).trim()
			: null;

	return {
		logoUrl,
		showLogo,
		title
	};
}

async function resolveCourseForUser(userId?: string | null): Promise<CourseRecord> {
	if (!userId) return null;

	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('courses_enrollments')
		.select('cohort_id')
		.eq('user_profile_id', userId)
		.order('enrolled_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (enrollmentError) {
		console.error('Error fetching enrollment for course theme resolution:', enrollmentError);
		return null;
	}

	if (!enrollment?.cohort_id) return null;

	const { data: cohort, error: cohortError } = await supabaseAdmin
		.from('courses_cohorts')
		.select('module_id')
		.eq('id', enrollment.cohort_id)
		.maybeSingle();

	if (cohortError) {
		console.error('Error fetching cohort for course theme resolution:', cohortError);
		return null;
	}

	if (!cohort?.module_id) return null;

	const { data: module, error: moduleError } = await supabaseAdmin
		.from('courses_modules')
		.select('course_id')
		.eq('id', cohort.module_id)
		.maybeSingle();

	if (moduleError) {
		console.error('Error fetching module for course theme resolution:', moduleError);
		return null;
	}

	if (!module?.course_id) return null;

	const { data: course, error: courseError } = await supabaseAdmin
		.from('courses')
		.select('id, name, settings')
		.eq('id', module.course_id)
		.maybeSingle();

	if (courseError) {
		console.error('Error fetching course for theme resolution:', courseError);
		return null;
	}

	return course ?? null;
}

async function resolveFallbackCourse(): Promise<CourseRecord> {
	const { data: activeCourse, error: activeError } = await supabaseAdmin
		.from('courses')
		.select('id, name, settings')
		.eq('is_active', true)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (activeError) {
		console.error('Error fetching active course for theme resolution:', activeError);
	}

	if (activeCourse) {
		return activeCourse;
	}

	const { data: anyCourse, error: anyError } = await supabaseAdmin
		.from('courses')
		.select('id, name, settings')
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (anyError) {
		console.error('Error fetching fallback course for theme resolution:', anyError);
	}

	return anyCourse ?? null;
}

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase }, url }) => {
	const { session, user } = await safeGetSession();
	const pathname = url.pathname;

	const coursesRoutePrefixes = [
		'/dashboard',
		'/materials',
		'/reflections',
		'/login',
		'/signup',
		'/privacy-policy',
		'/accf-profile'
	];
	const coursesProtectedPrefixes = ['/dashboard', '/materials', '/reflections', '/accf-profile'];

	const isCoursesRoute =
		coursesRoutePrefixes.some(route => pathname.startsWith(route)) || pathname === '/';
	const isCoursesProtectedRoute = coursesProtectedPrefixes.some(route => pathname.startsWith(route));
	const isAdminRoute = pathname.startsWith('/admin');

	const publicRoutes = ['/', '/auth', '/dgr/submit', '/login', '/readings', '/api/v1/readings', '/privacy-policy'];
	const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

	let userProfile = null;
	if (session && user) {
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('*')
			.eq('id', user.id)
			.single();
		userProfile = profile;
	}

	if (!session && !isPublicRoute) {
		if (isCoursesRoute) {
			throw redirect(303, '/login?next=' + pathname);
		}
		throw redirect(303, '/auth?next=' + pathname);
	}

	if (session && userProfile) {
		if (isCoursesProtectedRoute && !['student', 'admin', 'hub_coordinator'].includes(userProfile.role)) {
			throw redirect(303, '/login?error=insufficient_permissions');
		}

		if (isAdminRoute && userProfile.role !== 'admin') {
			throw redirect(303, '/auth?error=insufficient_permissions');
		}
	}

	let courseRecord = await resolveCourseForUser(user?.id);
	if (!courseRecord) {
		courseRecord = await resolveFallbackCourse();
	}

	const courseTheme = buildCourseTheme(courseRecord?.settings ?? null);
	const courseBranding = buildCourseBranding(courseRecord?.settings ?? null);
	const courseInfo = courseRecord ? { id: courseRecord.id, name: courseRecord.name } : null;

	return {
		session,
		user,
		userProfile,
		isCoursesRoute,
		courseTheme,
		courseBranding,
		courseInfo
	};
};
