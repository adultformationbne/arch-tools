import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, getUserProfile } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

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

	// Verify current password
	const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
		email: user.email!,
		password: currentPassword
	});

	if (signInError) {
		throw error(403, 'Current password is incorrect');
	}

	// Update password
	const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
		password: newPassword
	});

	if (updateError) {
		console.error('Password update error:', updateError);
		throw error(500, 'Failed to update password');
	}

	return json({ success: true });
};
