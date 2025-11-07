import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * UNIFIED MODULE-BASED AUTH SYSTEM
 *
 * This is the single source of truth for authentication and authorization.
 *
 * Key concepts:
 * - Module permissions: Namespaced array in user_profiles.modules
 *   Format: ["users", "editor", "dgr", "courses.participant", "courses.manager", "courses.admin"]
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
 * @throws 401 or redirects to /auth if not authenticated
 */
export async function requireAuth(
	event: RequestEvent,
	options: AuthOptions = { mode: 'throw_error' }
) {
	const { session, user } = await event.locals.safeGetSession();

	if (!session) {
		if (options.mode === 'redirect') {
			throw redirect(303, options.redirectTo || '/login');
		}
		throw error(401, 'Unauthorized - Please sign in');
	}

	return { session, user };
}

/**
 * Get user profile with modules and assigned courses (no auth check)
 */
export async function getUserProfile(supabase: SupabaseClient, userId: string) {
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
 *   hasModule(['users'], 'users') → true
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
	const profile = await getUserProfile(event.locals.supabase, user.id);

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
	const profile = await getUserProfile(event.locals.supabase, user.id);

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
	const profile = await getUserProfile(event.locals.supabase, user.id);

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
	const profile = await getUserProfile(event.locals.supabase, user.id);

	// Check enrollment
	const enrollment = await getUserCourseEnrollment(
		event.locals.supabase,
		user.id,
		courseSlug
	);

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
	const profile = await getUserProfile(event.locals.supabase, user.id);

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
			// Get user's full profile with assigned_course_ids
			const { data: fullProfile } = await event.locals.supabase
				.from('user_profiles')
				.select('id, email, full_name, display_name, modules, assigned_course_ids')
				.eq('id', user.id)
				.single();

			// Check if this course is in their assigned courses
			const assignedCourseIds = fullProfile?.assigned_course_ids || [];
			if (Array.isArray(assignedCourseIds) && assignedCourseIds.includes(course.id)) {
				return { user, profile: fullProfile, viaModule: 'courses.manager' };
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

	const enrollment = await getUserCourseEnrollment(
		event.locals.supabase,
		user.id,
		courseSlug
	);

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
