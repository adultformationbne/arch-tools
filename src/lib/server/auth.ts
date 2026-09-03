import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { CourseQueries } from './course-data.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * UNIFIED MODULE-BASED AUTH SYSTEM
 *
 * This is the single source of truth for authentication and authorization.
 *
 * Key concepts:
 * - Module permissions: Namespaced array in user_profiles.modules
 *   Format: ["platform.admin", "editor", "dgr", "courses.participant", "courses.manager", "courses.admin"]
 * - Course enrollment roles: student, coordinator (in courses_enrollments.role - PARTICIPANTS ONLY)
 * - Course management: via platform modules (courses.admin, courses.manager) + assigned_course_ids
 *
 * Response modes:
 * - throw_error: Returns HTTP 401/403 (for API routes)
 * - redirect: Returns 303 redirect (for page routes)
 */

type ResponseMode = 'throw_error' | 'redirect';

interface AuthOptions {
	mode?: ResponseMode;
	redirectTo?: string;
}

// ============================================================================
// CORE AUTH FUNCTIONS
// ============================================================================

/**
 * Requires authentication for the request
 * @throws 401 or redirects to /login if not authenticated
 */
export async function requireAuth(
	event: RequestEvent,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { session, user } = await event.locals.safeGetSession();

	if (!session || !user) {
		if (options.mode === 'redirect') {
			// Preserve the original URL for redirect after login
			const originalUrl = event.url.pathname + event.url.search;
			const redirectUrl = options.redirectTo || `/login?next=${encodeURIComponent(originalUrl)}`;
			throw redirect(303, redirectUrl);
		}
		throw error(401, 'Unauthorized - Please sign in');
	}

	return { session, user };
}

/**
 * Get user profile with modules and assigned courses (no auth check)
 * ✅ OPTIMIZATION: Uses request-scoped cache to avoid redundant queries
 */
export async function getUserProfile(event: RequestEvent, userId: string): Promise<any | null>;
export async function getUserProfile(supabase: SupabaseClient, userId: string): Promise<any | null>;
export async function getUserProfile(eventOrSupabase: RequestEvent | SupabaseClient, userId: string) {
	// Determine if we have a RequestEvent (with caching) or just SupabaseClient
	const isRequestEvent = 'locals' in eventOrSupabase && 'cookies' in eventOrSupabase;

	// Check cache if we have RequestEvent
	if (isRequestEvent) {
		const event = eventOrSupabase as RequestEvent;
		if (event.locals.authCache?.has(userId)) {
			return event.locals.authCache.get(userId);
		}

		// Query database
		const { data: userProfile, error: profileError } = await event.locals.supabase
			.from('user_profiles')
			.select('id, email, full_name, display_name, modules, assigned_course_ids')
			.eq('id', userId)
			.single();

		if (profileError) {
			console.error('Error fetching user profile:', profileError);
			return null;
		}

		// Cache for this request
		if (event.locals.authCache) {
			event.locals.authCache.set(userId, userProfile);
		}

		return userProfile;
	}

	// Fallback for SupabaseClient (no caching)
	const supabase = eventOrSupabase as SupabaseClient;
	const { data: userProfile, error: profileError } = await supabase
		.from('user_profiles')
		.select('id, email, full_name, display_name, modules, assigned_course_ids')
		.eq('id', userId)
		.single();

	if (profileError) {
		console.error('Error fetching user profile:', profileError);
		return null;
	}

	return userProfile;
}

// ============================================================================
// MODULE HELPER FUNCTIONS
// ============================================================================

/**
 * Get the level for a specific module (e.g., 'participant' from 'courses.participant')
 */
export function getModuleLevel(modules: string[] | null, moduleName: string): string | null {
	if (!modules) return null;
	const match = modules.find(m => m.startsWith(`${moduleName}.`));
	return match ? match.split('.')[1] : null;
}

/**
 * Check if user has ANY level of a module (supports namespaced modules)
 * Examples:
 *   hasModule(['courses.participant'], 'courses') → true
 *   hasModule(['platform.admin'], 'platform.admin') → true
 */
export function hasModule(modules: string[] | null, moduleName: string): boolean {
	if (!modules) return false;
	// Check for exact match or namespaced match
	return modules.some(m => m === moduleName || m.startsWith(`${moduleName}.`));
}

/**
 * Check for exact module.level match
 */
export function hasModuleLevel(modules: string[] | null, moduleLevel: string): boolean {
	return modules?.includes(moduleLevel) || false;
}

/**
 * Check if user has minimum level for hierarchical module (future use)
 * For now, just checks exact match
 */
export function hasMinimumLevel(
	modules: string[] | null,
	moduleName: string,
	minLevel: string
): boolean {
	return hasModuleLevel(modules, `${moduleName}.${minLevel}`);
}

// ============================================================================
// PLATFORM-LEVEL AUTHORIZATION
// ============================================================================

/**
 * Requires specific module access (any level for namespaced modules)
 * @throws 403 or redirects if user doesn't have module access
 */
export async function requireModule(
	event: RequestEvent,
	moduleName: string,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);
	const profile = await getUserProfile(event, user.id);

	if (!hasModule(profile?.modules, moduleName)) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/my-courses');
		}
		throw error(403, `Requires ${moduleName} module access`);
	}

	return { user, profile };
}

/**
 * Requires the user to have at least one of the provided modules
 * @throws 403 or redirects if user doesn't have any of the modules
 */
export async function requireAnyModule(
	event: RequestEvent,
	moduleNames: string[],
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);
	const profile = await getUserProfile(event, user.id);

	if (!hasAnyModule(profile?.modules ?? null, moduleNames)) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/my-courses');
		}
		throw error(403, `Requires one of: ${moduleNames.join(', ')}`);
	}

	return { user, profile };
}

/**
 * Requires specific module.level
 * @throws 403 or redirects if user doesn't have exact module.level
 */
export async function requireModuleLevel(
	event: RequestEvent,
	moduleLevel: string,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);
	const profile = await getUserProfile(event, user.id);

	if (!hasModuleLevel(profile?.modules, moduleLevel)) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/my-courses');
		}
		throw error(403, `Requires ${moduleLevel} access`);
	}

	return { user, profile };
}

// ============================================================================
// COURSE-LEVEL AUTHORIZATION
// ============================================================================

/**
 * The cookie recording which cohort a participant picked on "My Courses".
 *
 * Keyed by course slug, so reading it costs nothing — the id-keyed name it
 * replaces meant a courses lookup at every call site just to build the key.
 */
export function activeCohortCookieName(courseSlug: string) {
	return `active_cohort_${courseSlug}`;
}

/**
 * The participant's current enrolment in a course, or null if they hold none.
 *
 * This is the ONLY place the active-cohort cookie is read, and
 * CourseQueries.getEnrollment() is the only resolver. Everything downstream is
 * handed the enrolment this returns — see requireCourseAccess(). When the gate
 * and the data layer each resolved the cohort themselves they drifted apart,
 * and a participant was admitted to one module and then shown another.
 *
 * A stale preference is cleared as a side effect: if it named a cohort that is
 * no longer the current one, it has outlived what it pointed at.
 *
 * Exported for tests — callers should go through requireCourseAccess() and the
 * other requireCourse* helpers, which apply the role checks as well.
 */
export async function getUserCourseEnrollment(
	userId: string,
	courseSlug: string,
	cookies?: RequestEvent['cookies']
) {
	const cookieName = activeCohortCookieName(courseSlug);
	const preferredCohortId = cookies?.get(cookieName);

	const { data: enrollment } = await CourseQueries.getEnrollment(
		userId,
		courseSlug,
		preferredCohortId
	);
	if (!enrollment) return null;

	if (preferredCohortId && enrollment.cohort_id !== preferredCohortId) {
		cookies?.delete?.(cookieName, { path: '/' });
	}

	return enrollment;
}

/**
 * Requires user to be enrolled in a specific course with specific role(s)
 * @throws 403 or redirects if user is not enrolled or doesn't have required role
 */
export async function requireCourseRole(
	event: RequestEvent,
	courseSlug: string,
	allowedRoles: string[],
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);
	const profile = await getUserProfile(event, user.id);

	// Check enrollment
	const enrollment = await getUserCourseEnrollment(user.id, courseSlug, event.cookies);

	if (!enrollment || !allowedRoles.includes(enrollment.role)) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || `/courses/${courseSlug}`);
		}
		throw error(
			403,
			`Requires one of: ${allowedRoles.join(', ')} role in this course`
		);
	}

	return { user, profile, enrollment };
}

/**
 * Requires course management access
 * Can access via:
 * - courses.admin module (platform-wide access to ALL courses), OR
 * - courses.manager module + course ID in user's assigned_course_ids
 *
 * NOTE: Managers are NOT enrolled in cohorts—they manage via platform modules
 */
export async function requireCourseAdmin(
	event: RequestEvent,
	courseSlug: string,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);
	const profile = await getUserProfile(event, user.id);

	// Check for courses.admin module (platform-wide access)
	if (hasModuleLevel(profile?.modules, 'courses.admin')) {
		return { user, profile, viaModule: 'courses.admin' };
	}

	// Check for courses.manager module + assignment to this specific course
	if (hasModuleLevel(profile?.modules, 'courses.manager')) {
		// Get the course ID from slug
		const { data: course } = await event.locals.supabase
			.from('courses')
			.select('id')
			.eq('slug', courseSlug)
			.single();

		if (course) {
			// FIXED: Use profile from line 278 instead of re-querying
			// assigned_course_ids should already be in profile if needed
			const assignedCourseIds = profile?.assigned_course_ids || [];
			if (Array.isArray(assignedCourseIds) && assignedCourseIds.includes(course.id)) {
				return { user, profile, viaModule: 'courses.manager' };
			}
		}
	}

	// Not authorized
	if (options.mode === 'redirect') {
		throw redirect(303, options.redirectTo || '/my-courses');
	}
	throw error(403, 'Requires course admin access');
}

/**
 * Requires user to be enrolled in course (any role)
 * Everyone must be enrolled - including users with courses.admin module
 */
export async function requireCourseAccess(
	event: RequestEvent,
	courseSlug: string,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);

	const enrollment = await getUserCourseEnrollment(user.id, courseSlug, event.cookies);

	if (!enrollment) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/my-courses');
		}
		throw error(403, 'Must be enrolled in this course');
	}

	return { user, enrollment };
}

// ============================================================================
// CLIENT-SIDE HELPERS (for use in components)
// ============================================================================

/**
 * Check if user has any of the specified modules
 */
export function hasAnyModule(modules: string[] | null, requiredModules: string[]): boolean {
	if (!modules) return false;
	return requiredModules.some((mod) => hasModule(modules, mod));
}

/**
 * Check if user has all of the specified modules
 */
export function hasAllModules(modules: string[] | null, requiredModules: string[]): boolean {
	if (!modules) return false;
	return requiredModules.every((mod) => hasModule(modules, mod));
}
