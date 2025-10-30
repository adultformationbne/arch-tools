import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * UNIFIED AUTH SYSTEM
 *
 * This is the single source of truth for authentication and authorization.
 *
 * Key concepts:
 * - Platform-level roles: admin, student, hub_coordinator (in user_profiles.role)
 * - Course-level roles: admin, student, coordinator (in courses_enrollments.role per course)
 * - Module permissions: Array of module access (in user_profiles.modules)
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
 * @throws 401 or redirects to /auth if not authenticated
 */
export async function requireAuth(
	event: RequestEvent,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { session, user } = await event.locals.safeGetSession();

	if (!session) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/auth');
		}
		throw error(401, 'Unauthorized - Please sign in');
	}

	return { session, user };
}

/**
 * Get user profile with role/module info (no auth check)
 */
export async function getUserProfile(supabase: SupabaseClient, userId: string) {
	const { data: userProfile, error: profileError } = await supabase
		.from('user_profiles')
		.select('id, email, full_name, display_name, role, modules')
		.eq('id', userId)
		.single();

	if (profileError) {
		console.error('Error fetching user profile:', profileError);
		return null;
	}

	return userProfile;
}

// ============================================================================
// PLATFORM-LEVEL AUTHORIZATION
// ============================================================================

/**
 * Requires platform admin role
 * @throws 403 or redirects if not admin
 */
export async function requirePlatformAdmin(
	event: RequestEvent,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);

	const profile = await getUserProfile(event.locals.supabase, user.id);

	if (!profile || profile.role !== 'admin') {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/profile');
		}
		throw error(403, 'Forbidden - Admin access required');
	}

	return { user, profile };
}

/**
 * Requires specific platform role(s)
 * @throws 403 or redirects if user doesn't have required role
 */
export async function requirePlatformRole(
	event: RequestEvent,
	allowedRoles: string[],
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);

	const profile = await getUserProfile(event.locals.supabase, user.id);

	if (!profile || !allowedRoles.includes(profile.role)) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/profile');
		}
		throw error(403, `Forbidden - Requires one of: ${allowedRoles.join(', ')}`);
	}

	return { user, profile };
}

/**
 * Requires specific module access
 * @throws 403 or redirects if user doesn't have module access
 */
export async function requireModule(
	event: RequestEvent,
	moduleName: string,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { user } = await requireAuth(event, options);

	const profile = await getUserProfile(event.locals.supabase, user.id);

	// Admins have access to all modules
	if (profile?.role === 'admin') {
		return { user, profile };
	}

	const hasModule = profile?.modules?.includes(moduleName);

	if (!hasModule) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/profile');
		}
		throw error(403, `Forbidden - Requires ${moduleName} module access`);
	}

	return { user, profile };
}

// ============================================================================
// COURSE-LEVEL AUTHORIZATION
// ============================================================================

/**
 * Get user's enrollment in a specific course
 */
async function getUserCourseEnrollment(
	supabase: SupabaseClient,
	userId: string,
	courseSlug: string
) {
	const { data: enrollments, error: enrollmentError } = await supabase
		.from('courses_enrollments')
		.select(`
			id,
			role,
			status,
			cohort_id,
			courses_cohorts!inner (
				id,
				name,
				module_id,
				courses_modules!inner (
					id,
					name,
					course_id,
					courses!inner (
						id,
						name,
						slug
					)
				)
			)
		`)
		.eq('user_profile_id', userId)
		.eq('courses_cohorts.courses_modules.courses.slug', courseSlug)
		.in('status', ['active', 'invited', 'accepted']);

	if (enrollmentError) {
		console.error('Error fetching course enrollment:', enrollmentError);
		return null;
	}

	return enrollments && enrollments.length > 0 ? enrollments[0] : null;
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

	// Platform admins have access to all courses
	const profile = await getUserProfile(event.locals.supabase, user.id);
	if (profile?.role === 'admin') {
		return { user, profile, enrollment: null, isPlatformAdmin: true };
	}

	const enrollment = await getUserCourseEnrollment(
		event.locals.supabase,
		user.id,
		courseSlug
	);

	if (!enrollment || !allowedRoles.includes(enrollment.role)) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || `/courses/${courseSlug}/dashboard`);
		}
		throw error(
			403,
			`Forbidden - Requires one of: ${allowedRoles.join(', ')} role in this course`
		);
	}

	return { user, profile, enrollment, isPlatformAdmin: false };
}

/**
 * Requires course admin role (or platform admin)
 */
export async function requireCourseAdmin(
	event: RequestEvent,
	courseSlug: string,
	options: AuthOptions = { mode: 'throw_error' }
) {
	return requireCourseRole(event, courseSlug, ['admin'], options);
}

/**
 * Requires user to be enrolled in course (any role)
 */
export async function requireCourseAccess(
	event: RequestEvent,
	courseSlug: string,
	options: AuthOptions = { mode: 'throw_error' }
) {
	return requireCourseRole(event, courseSlug, ['admin', 'student', 'coordinator'], options);
}

// ============================================================================
// CLIENT-SIDE HELPERS (for use in components)
// ============================================================================

/**
 * Check if user has any of the specified modules
 */
export function hasAnyModule(modules: string[] | null, requiredModules: string[]): boolean {
	if (!modules) return false;
	return requiredModules.some((mod) => modules.includes(mod));
}

/**
 * Check if user has all of the specified modules
 */
export function hasAllModules(modules: string[] | null, requiredModules: string[]): boolean {
	if (!modules) return false;
	return requiredModules.every((mod) => modules.includes(mod));
}

/**
 * Check if user is platform admin
 */
export function isPlatformAdmin(role: string | null): boolean {
	return role === 'admin';
}

// ============================================================================
// BACKWARD COMPATIBILITY ALIASES
// ============================================================================

/**
 * @deprecated Use requirePlatformAdmin instead
 */
export const requireAdmin = requirePlatformAdmin;

/**
 * @deprecated Use requirePlatformRole instead
 */
export const requireRole = requirePlatformRole;
