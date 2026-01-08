import { redirect } from '@sveltejs/kit';
import { supabaseAdmin, getPlatformSettings } from '$lib/server/supabase.js';
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

	// ✅ OPTIMIZATION: Single query with joins instead of 4 waterfall queries
	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			cohort_id,
			courses_cohorts!inner (
				module_id,
				courses_modules!inner (
					course_id,
					courses!inner (
						id,
						name,
						settings
					)
				)
			)
		`)
		.eq('user_profile_id', userId)
		.order('enrolled_at', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (enrollmentError) {
		console.error('Error fetching enrollment for course theme resolution:', enrollmentError);
		return null;
	}

	// Extract course from nested join
	const course = enrollment?.courses_cohorts?.courses_modules?.courses;
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

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { session, user } = await safeGetSession();
	const pathname = url.pathname;

	const coursesRoutePrefixes = [
		'/materials',
		'/reflections',
		'/privacy-policy',
		'/accf-profile'
	];
	const isCoursesRoute =
		coursesRoutePrefixes.some(route => pathname.startsWith(route)) || pathname === '/';
	const publicRoutes = ['/', '/login', '/login/setup-password', '/readings', '/privacy-policy'];
	const publicPrefixes = ['/api/v1/', '/dgr/write/', '/dgr/publish/submit/'];
	const isExplicitPublic = publicRoutes.some(route => pathname === route);
	const isPrefixPublic = publicPrefixes.some(prefix => pathname.startsWith(prefix));
	const isPublicRoute = isExplicitPublic || isPrefixPublic;

	let userProfile = null;
	if (session && user) {
		const { data: profile, error } = await supabaseAdmin
			.from('user_profiles')
			.select('id, email, full_name, modules')
			.eq('id', user.id)
			.single();

		if (error) {
			console.error('Error loading user profile:', error);
		}

		userProfile = profile;
	}

	if (!session && !isPublicRoute) {
		throw redirect(303, '/login?next=' + pathname);
	}

	// Skip expensive course resolution for admin routes
	// Admin course routes have their own layout that loads course-specific data
	const isAdminCourseRoute = pathname.startsWith('/admin/courses/');
	const skipCourseResolution = isAdminCourseRoute;

	let courseRecord = null;
	if (!skipCourseResolution) {
		courseRecord = await resolveCourseForUser(user?.id);
		if (!courseRecord) {
			courseRecord = await resolveFallbackCourse();
		}
	}

	const courseTheme = buildCourseTheme(courseRecord?.settings ?? null);
	const courseBranding = buildCourseBranding(courseRecord?.settings ?? null);
	const courseInfo = courseRecord ? { id: courseRecord.id, name: courseRecord.name } : null;

	// Load platform settings from database
	const platform = await getPlatformSettings();

	return {
		session,
		user,
		userProfile,
		userModules: userProfile?.modules ?? [],
		isCoursesRoute,
		courseTheme,
		courseBranding,
		courseInfo,
		platform,
		// Pass session info to child layouts to avoid re-authentication
		_authCache: {
			session,
			user,
			profile: userProfile
		}
	};
};
