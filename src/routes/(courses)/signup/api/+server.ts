import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { RequestHandler } from './$types';

// GET - Validate invitation token
export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		throw error(400, 'Missing token');
	}

	try {
		// Look up the pending user by invitation token
		const { data: pendingUser, error: fetchError } = await supabaseAdmin
			.from('pending_users')
			.select('*, pending_cohort:cohorts(name)')
			.eq('invitation_token', token)
			.eq('status', 'invited')
			.single();

		if (fetchError || !pendingUser) {
			return json({
				success: false,
				message: 'Invalid or expired invitation link'
			});
		}

		// Check if already accepted
		if (pendingUser.invitation_accepted_at) {
			return json({
				success: false,
				message: 'This invitation has already been used'
			});
		}

		// Return user data (without sensitive info)
		return json({
			success: true,
			data: {
				email: pendingUser.email,
				full_name: pendingUser.full_name,
				role: pendingUser.role,
				cohort_name: pendingUser.pending_cohort?.name || null
			}
		});
	} catch (err) {
		console.error('Token validation error:', err);
		throw error(500, 'Failed to validate invitation');
	}
};

// POST - Complete signup with password
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { token, password } = await request.json();

		if (!token || !password) {
			throw error(400, 'Missing token or password');
		}

		// Validate password strength
		if (password.length < 8) {
			throw error(400, 'Password must be at least 8 characters');
		}

		// Get pending user
		const { data: pendingUser, error: fetchError } = await supabaseAdmin
			.from('pending_users')
			.select('*')
			.eq('invitation_token', token)
			.eq('status', 'invited')
			.single();

		if (fetchError || !pendingUser) {
			throw error(400, 'Invalid or expired invitation');
		}

		// Check if already used
		if (pendingUser.invitation_accepted_at) {
			throw error(400, 'This invitation has already been used');
		}

		// Create Supabase Auth user
		const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
			email: pendingUser.email,
			password: password,
			email_confirm: true, // Auto-confirm email since they were invited
			user_metadata: {
				full_name: pendingUser.full_name,
				role: pendingUser.role
			}
		});

		if (authError) {
			console.error('Auth user creation error:', authError);
			throw error(500, `Failed to create account: ${authError.message}`);
		}

		// Create user profile
		const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
			id: authData.user.id,
			email: pendingUser.email,
			full_name: pendingUser.full_name,
			role: pendingUser.role
		});

		if (profileError) {
			console.error('Profile creation error:', profileError);
			// Try to clean up auth user if profile creation fails
			await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
			throw error(500, 'Failed to create user profile');
		}

		// Update courses_users with auth_user_id and activate
		if (pendingUser.pending_cohort_id) {
			const { error: updateError } = await supabaseAdmin
				.from('courses_users')
				.update({
					auth_user_id: authData.user.id,
					status: 'active',
					invitation_accepted_at: new Date().toISOString()
				})
				.eq('id', pendingUser.id);

			if (updateError) {
				console.error('User activation error:', updateError);
				// Don't fail the whole signup, just log it
			}
		}

		// Update pending user status
		await supabaseAdmin
			.from('pending_users')
			.update({
				status: 'accepted',
				invitation_accepted_at: new Date().toISOString()
			})
			.eq('id', pendingUser.id);

		return json({
			success: true,
			message: 'Account created successfully'
		});
	} catch (err) {
		console.error('Signup error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'An error occurred during signup');
	}
};