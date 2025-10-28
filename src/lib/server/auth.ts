import { error, redirect } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Requires authentication for the request
 * @throws 401 if not authenticated
 */
export async function requireAuth(event: RequestEvent) {
	const { session, user } = await event.locals.safeGetSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	return { session, user };
}

/**
 * Requires authentication and checks for specific roles
 * @throws 401 if not authenticated, 403 if insufficient permissions
 */
export async function requireRole(event: RequestEvent, allowedRoles: string[]) {
	const { user } = await requireAuth(event);

	const { data: profile } = await event.locals.supabase
		.from('user_profiles')
		.select('role, modules')
		.eq('id', user.id)
		.single();

	if (!profile || !allowedRoles.includes(profile.role)) {
		throw error(403, 'Forbidden - Insufficient permissions');
	}

	return { user, profile };
}

/**
 * Requires admin role
 * @throws 401 if not authenticated, 403 if not admin
 */
export async function requireAdmin(event: RequestEvent) {
	return requireRole(event, ['admin']);
}

/**
 * Requires student, admin, or hub coordinator role
 * @throws 401 if not authenticated, 403 if not authorized
 */
export async function requireCoursesUser(event: RequestEvent) {
	return requireRole(event, ['student', 'admin', 'hub_coordinator']);
}

/**
 * Requires specific module access
 * @throws 401 if not authenticated, 403 if no module access
 */
export async function requireModule(event: RequestEvent, moduleName: string) {
	const { user } = await requireAuth(event);

	const { data: profile } = await event.locals.supabase
		.from('user_profiles')
		.select('role, modules')
		.eq('id', user.id)
		.single();

	const hasModule = profile?.modules?.includes(moduleName);

	if (!hasModule) {
		throw error(403, `Forbidden - Requires ${moduleName} module access`);
	}

	return { user, profile };
}

/**
 * Get user profile with role/module info (no auth check)
 */
export async function getUserProfile(supabase: SupabaseClient, userId: string) {
	const { data: userProfile } = await supabase
		.from('user_profiles')
		.select('id, email, full_name, role, modules')
		.eq('id', userId)
		.single();

	return userProfile;
}

/**
 * Check if user has any of the specified modules (client-side helper)
 */
export function hasAnyModule(modules: string[] | null, requiredModules: string[]): boolean {
	if (!modules) return false;
	return requiredModules.some(mod => modules.includes(mod));
}

/**
 * Check if user has all of the specified modules (client-side helper)
 */
export function hasAllModules(modules: string[] | null, requiredModules: string[]): boolean {
	if (!modules) return false;
	return requiredModules.every(mod => modules.includes(mod));
}
