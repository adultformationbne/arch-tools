import { redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * AUTH HELPERS FOR (internal) ROUTES
 *
 * These helpers use redirect() for (internal) routes where we want to redirect users
 * to login or profile pages when unauthorized.
 *
 * For (accf) routes or API endpoints, use the helpers from $lib/server/auth.ts instead,
 * which throw error() responses (401/403).
 */

/**
 * Check if user has specific module access
 * @throws redirect if user doesn't have module access
 */
export async function requireModule(
	supabase: SupabaseClient,
	userId: string,
	moduleName: string,
	redirectTo = '/profile'
) {
	const { data: userProfile } = await supabase
		.from('user_profiles')
		.select('role, modules')
		.eq('id', userId)
		.single();

	const hasModule = userProfile?.modules?.includes(moduleName);

	if (!hasModule) {
		throw redirect(303, redirectTo);
	}

	return userProfile;
}

/**
 * Check if user has specific role
 * @throws redirect if user doesn't have required role
 */
export async function requireRole(
	supabase: SupabaseClient,
	userId: string,
	allowedRoles: string[],
	redirectTo = '/profile'
) {
	const { data: userProfile } = await supabase
		.from('user_profiles')
		.select('role, modules')
		.eq('id', userId)
		.single();

	const hasRole = allowedRoles.includes(userProfile?.role || '');

	if (!hasRole) {
		throw redirect(303, redirectTo);
	}

	return userProfile;
}

/**
 * Check if user is admin (internal routes only)
 * @throws redirect if user is not admin
 */
export async function requireAdmin(
	supabase: SupabaseClient,
	userId: string,
	redirectTo = '/profile'
) {
	return requireRole(supabase, userId, ['admin'], redirectTo);
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
