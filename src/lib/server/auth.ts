import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';

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
		.select('role')
		.eq('id', user.id)
		.single();

	if (!profile || !allowedRoles.includes(profile.role)) {
		throw error(403, 'Forbidden - Insufficient permissions');
	}

	return { user, profile };
}

/**
 * Requires admin or accf_admin role
 * @throws 401 if not authenticated, 403 if not admin
 */
export async function requireAdmin(event: RequestEvent) {
	return requireRole(event, ['accf_admin', 'admin']);
}

/**
 * Requires ACCF student, admin, or coordinator role
 * @throws 401 if not authenticated, 403 if not ACCF user
 */
export async function requireAccfUser(event: RequestEvent) {
	return requireRole(event, ['accf_student', 'accf_admin', 'hub_coordinator', 'admin']);
}
