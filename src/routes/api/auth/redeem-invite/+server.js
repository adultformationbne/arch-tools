import { json, error } from '@sveltejs/kit';
import { redeemInviteCode, markInvitationAccepted } from '$lib/server/invite-codes.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { checkRateLimit } from '$lib/server/rate-limit.js';

export async function POST({ request, cookies, locals, getClientAddress }) {
	try {
		// SECURITY: Rate limiting to prevent brute force enumeration
		// Limit: 5 attempts per minute per IP address
		const clientIp = getClientAddress();

		try {
			checkRateLimit(clientIp, 5, 60000); // 5 requests per minute
		} catch (rateLimitError) {
			throw error(429, rateLimitError.message);
		}

		const { code } = await request.json();

		if (!code) {
			throw error(400, 'Invitation code is required');
		}

		// Validate and get invitation
		const invitation = await redeemInviteCode(code);

		// Check if user already exists in auth
		const { data: { users: existingUsers } } = await supabaseAdmin.auth.admin.listUsers();
		const existingUser = existingUsers?.find(u => u.email === invitation.email);

		let authData;

		if (existingUser) {
			// User exists - send OTP to log them in
			const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
				email: invitation.email,
				options: {
					shouldCreateUser: false
				}
			});

			if (otpError) {
				throw error(500, 'Failed to send authentication code');
			}

			authData = { user: existingUser };
		} else if (invitation.user_id) {
			// User was created but hasn't confirmed yet
			// Send OTP for authentication
			const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
				email: invitation.email,
				options: {
					shouldCreateUser: false
				}
			});

			if (otpError) {
				throw error(500, 'Failed to send authentication code');
			}

			// Get the user
			const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(invitation.user_id);
			authData = { user };
		} else {
			// Create new user
			const { data: newAuthData, error: authError } = await supabaseAdmin.auth.admin.createUser({
				email: invitation.email,
				email_confirm: false,
				user_metadata: {
					invited_via: 'code'
				}
			});

			if (authError) {
				console.error('Error creating user:', authError);
				throw error(500, 'Failed to create user account');
			}

			authData = newAuthData;

			// Update invitation with user_id
			await supabaseAdmin
				.from('pending_invitations')
				.update({ user_id: authData.user.id })
				.eq('id', invitation.id);

			// Send OTP for first login
			const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
				email: invitation.email,
				options: {
					shouldCreateUser: false
				}
			});

			if (otpError) {
				console.error('Error sending OTP:', otpError);
				// Don't fail here - user can still use password if needed
			}
		}

		// Ensure user profile exists
		const { data: existingProfile } = await supabaseAdmin
			.from('user_profiles')
			.select('id')
			.eq('id', authData.user.id)
			.single();

		if (!existingProfile) {
			// Create profile
			await supabaseAdmin
				.from('user_profiles')
				.insert({
					id: authData.user.id,
					email: invitation.email,
					modules: invitation.modules
				});
		} else {
			// Update modules
			await supabaseAdmin
				.from('user_profiles')
				.update({ modules: invitation.modules })
				.eq('id', authData.user.id);
		}

		// Don't mark as accepted yet - wait for OTP verification
		// Don't create session yet - wait for OTP verification
		// The user will verify OTP on /auth page, then we'll mark as accepted

		// SECURITY: Don't return email - prevents email harvesting attack
		// The OTP was already sent to invitation.email above
		return json({
			success: true,
			message: 'A 6-digit verification code has been sent to your email'
			// Intentionally NOT returning email for security
		});

	} catch (err) {
		console.error('Error redeeming invite code:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, err.message || 'Failed to redeem invitation code');
	}
}
