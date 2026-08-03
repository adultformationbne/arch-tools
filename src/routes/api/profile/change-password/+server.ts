import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, getUserProfile } from '$lib/server/auth';
import { verifyPassword } from '$lib/server/supabase.js';

/**
 * POST /api/profile/change-password
 *
 * WRITTEN AS THE USER, NOT AS AN ADMIN, and neither step may touch
 * `supabaseAdmin`. The obvious implementation gets both wrong:
 *
 * - `supabaseAdmin.auth.signInWithPassword()` to check the current password
 *   makes that shared client adopt the caller's token, so every later query on
 *   the instance runs as them until the token expires. See supabase.js.
 * - `admin.updateUserById({ password })` carries no session, so GoTrue revokes
 *   EVERY session on the account including the caller's own. They got a
 *   cheerful 200 and were signed out by their next request.
 *
 * `locals.supabase.auth.updateUser()` runs on the caller's own session, so
 * other sessions are still invalidated — which is the point of changing a
 * password — and theirs is not.
 */
export const POST: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const profile = await getUserProfile(event, user.id);
	if (!profile) {
		throw error(404, 'Profile not found');
	}

	const body = await event.request.json();
	const { currentPassword, newPassword } = body;

	if (!currentPassword || !newPassword) {
		throw error(400, 'Current password and new password are required');
	}

	if (newPassword.length < 6) {
		throw error(400, 'New password must be at least 6 characters');
	}

	// A throwaway client does the sign-in, so nothing shared is demoted.
	const correct = await verifyPassword(user.email!, currentPassword);
	if (!correct) {
		throw error(403, 'Current password is incorrect');
	}

	const { error: updateError } = await event.locals.supabase.auth.updateUser({
		password: newPassword
	});

	if (updateError) {
		// GoTrue's own rules — reusing the current password, a leaked-password
		// check — are the caller's to fix, so the message is passed on.
		if (updateError.status === 422 || updateError.status === 400) {
			throw error(400, updateError.message);
		}
		console.error('Password update error:', updateError);
		throw error(500, 'Failed to update password');
	}

	return json({ success: true });
};
