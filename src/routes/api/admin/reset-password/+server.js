import { json, error } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function POST(event) {
	try {
		// Check if user is platform admin
		await requireModule(event, 'platform.admin');

		const { request } = event;

		const { userId, newPassword } = await request.json();

		// Validate required fields
		if (!userId || !newPassword) {
			throw error(400, 'User ID and new password are required');
		}

		// Validate password length
		if (newPassword.length < 6) {
			throw error(400, 'Password must be at least 6 characters');
		}

		// Reset the user's password using Admin API
		const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
			userId,
			{ password: newPassword }
		);

		if (updateError) {
			console.error('Password reset error:', updateError);
			throw error(400, updateError.message || 'Failed to reset password');
		}

		return json({
			success: true,
			message: 'Password reset successfully'
		});

	} catch (err) {
		console.error('Error resetting password:', err);

		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Internal server error');
	}
}
