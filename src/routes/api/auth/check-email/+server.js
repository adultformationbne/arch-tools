import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * Check user status and determine authentication method
 * Returns what the next step should be for this email
 */
export async function POST({ request }) {
	try {
		const { email } = await request.json();

		if (!email) {
			throw error(400, 'Email is required');
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			throw error(400, 'Invalid email format');
		}

		// Check if user exists in auth system
		const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
		const existingUser = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

		if (!existingUser) {
			// User doesn't exist in auth system
			return json({
				exists: false,
				nextStep: 'error',
				hasInvitation: false,
				message: 'No account found. Please contact your administrator.'
			});
		}

		// Get full user details to check if they have signed in before
		const { data: { user: fullUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(existingUser.id);

		if (getUserError || !fullUser) {
			console.error('Error fetching user details:', getUserError);
			throw error(500, 'Failed to verify user status');
		}

		// User has a password if they've successfully signed in before
		// last_sign_in_at is only set after a successful password login or OTP verification + password setup
		const hasPassword = fullUser.last_sign_in_at !== null;

		if (hasPassword) {
			// User has password - allow password login
			return json({
				exists: true,
				nextStep: 'password',
				hasPassword: true,
				message: 'Enter your password to continue'
			});
		} else {
			// User exists but has no password - this is a pending invitation
			// Allow them to proceed with OTP
			return json({
				exists: true,
				nextStep: 'otp',
				hasPassword: false,
				message: 'A verification code will be sent to your email'
			});
		}

	} catch (err) {
		console.error('Error checking email:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
}
