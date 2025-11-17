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

		/**
		 * Determine if user has a password set
		 *
		 * Edge cases handled:
		 * 1. New pending users - no flag, no sign-in → OTP flow
		 * 2. Users who completed setup - has flag → Password flow
		 * 3. Users who verified OTP but never set password - no flag, has sign-in → OTP flow (fixed!)
		 * 4. Existing users (before flag was added) - no flag, has sign-in → Password flow (backward compat)
		 * 5. Forgot password users - will get flag set when they reset password
		 */

		// Priority 1: Check metadata flag (most reliable - set when password is actually created)
		const hasPasswordSetupFlag = fullUser.user_metadata?.password_setup_completed === true;

		// Priority 2: For existing users (backward compatibility) - if they've signed in and don't have the flag,
		// assume they have a password (they were created before we added the flag)
		const isExistingUserWithSignIn = fullUser.last_sign_in_at !== null &&
		                                  !fullUser.user_metadata?.hasOwnProperty('password_setup_completed');

		// User has password if:
		// 1. They have the password_setup_completed flag set to true (most reliable), OR
		// 2. They're an existing user who has signed in before (created before we added the flag)
		const hasPassword = hasPasswordSetupFlag || isExistingUserWithSignIn;

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
