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
			// User doesn't exist - check if they have a pending invitation
			const { data: invitation } = await supabaseAdmin
				.from('pending_invitations')
				.select('id, status')
				.eq('email', email.toLowerCase())
				.eq('status', 'pending')
				.gt('expires_at', new Date().toISOString())
				.single();

			if (invitation) {
				// Has valid invitation - can receive OTP
				return json({
					exists: false,
					nextStep: 'otp',
					hasInvitation: true,
					message: 'Invitation found - OTP code will be sent to your email'
				});
			} else {
				// No invitation - invite-only system
				return json({
					exists: false,
					nextStep: 'error',
					hasInvitation: false,
					message: 'No invitation found for this email'
				});
			}
		}

		// User exists - check if they have a password set
		// Users with confirmed_at have completed setup (have password)
		// Users without confirmed_at are pending (need OTP)
		const hasPassword = existingUser.confirmed_at !== null;

		if (hasPassword) {
			return json({
				exists: true,
				nextStep: 'password',
				hasPassword: true,
				message: 'Enter your password to continue'
			});
		} else {
			return json({
				exists: true,
				nextStep: 'otp',
				hasPassword: false,
				message: 'Account pending - OTP code will be sent to your email'
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
