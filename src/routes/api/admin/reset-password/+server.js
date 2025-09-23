import { json, error } from '@sveltejs/kit';
import { requireRole } from '$lib/utils/auth.js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { createClient } from '@supabase/supabase-js';

export async function POST({ request, locals: { supabase, safeGetSession } }) {
	try {
		const { session, user } = await safeGetSession();

		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user is admin
		const hasAccess = await requireRole(supabase, user.id, 'admin');
		if (!hasAccess) {
			throw error(403, 'Insufficient permissions. Admin role required.');
		}

		const { userId, newPassword } = await request.json();

		// Validate required fields
		if (!userId || !newPassword) {
			throw error(400, 'User ID and new password are required');
		}

		// Validate password length
		if (newPassword.length < 6) {
			throw error(400, 'Password must be at least 6 characters');
		}

		// Create admin client with service role key
		const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		// Reset the user's password using Admin API
		const { data: updateData, error: updateError } = await adminSupabase.auth.admin.updateUserById(
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