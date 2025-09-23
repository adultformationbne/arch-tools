import type { SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'editor' | 'contributor' | 'viewer';

export async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole | null> {
	const { data, error } = await supabase
		.from('user_profiles')
		.select('role')
		.eq('id', userId)
		.single();

	if (error || !data) {
		return null;
	}

	return data.role as UserRole;
}

export function hasPermission(userRole: UserRole | null, requiredRole: UserRole): boolean {
	if (!userRole) return false;

	const roleHierarchy: Record<UserRole, number> = {
		admin: 4,
		editor: 3,
		contributor: 2,
		viewer: 1
	};

	return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

export async function requireRole(
	supabase: SupabaseClient,
	userId: string,
	requiredRole: UserRole
): Promise<boolean> {
	const userRole = await getUserRole(supabase, userId);
	return hasPermission(userRole, requiredRole);
}