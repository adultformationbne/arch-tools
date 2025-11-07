import { json, error } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth.js';
import { PUBLIC_SITE_URL } from '$env/static/public';
import { createInvitation, resendInvitation, getInvitationUrl } from '$lib/server/invite-codes.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function POST(event) {
	try {
		// Check if user has users module access (admins automatically have access)
		const { user } = await requireModule(event, 'users');

		const { request } = event;

		const { email, full_name, modules } = await request.json();

		// Validate required fields
		if (!email) {
			throw error(400, 'Email is required');
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			throw error(400, 'Invalid email format');
		}

		// Validate modules
		const allowedModules = [
			'users',
			'editor',
			'dgr',
			'courses.participant',
			'courses.manager',
			'courses.admin'
		];

		if (modules && !Array.isArray(modules)) {
			throw error(400, 'Modules must be an array');
		}

		const requestedModules = Array.isArray(modules) ? modules : [];
		const cleanModules = requestedModules
			.filter((value) => typeof value === 'string')
			.map((value) => value.trim())
			.filter((value) => value.length > 0);

		if (cleanModules.some((m) => !allowedModules.includes(m))) {
			throw error(400, 'Invalid module specified');
		}

		// Ensure unique modules
		const uniqueModules = Array.from(new Set(cleanModules));

		// Check if user already exists in auth system
		const { data: { users: existingAuthUsers } } = await supabaseAdmin.auth.admin.listUsers();
		const existingAuthUser = existingAuthUsers?.find(u => u.email === email);

		let authData;

		if (existingAuthUser) {
			// User exists in Auth but was deleted from user_profiles
			// Re-use the existing auth user instead of creating new one
			console.log('Re-using existing auth user:', existingAuthUser.id);
			authData = { user: existingAuthUser };

			// Send OTP for existing user to set up their account
			const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
				email,
				options: {
					shouldCreateUser: false
				}
			});

			if (otpError) {
				console.error('OTP send error:', otpError);
				throw error(400, otpError.message || 'Failed to send OTP');
			}
		} else {
			// Create new user and send OTP code (not magic link)
			// This sends a 6-digit code via email that works in locked-down environments
			const { data: newAuthData, error: authError } = await supabaseAdmin.auth.admin.createUser({
				email,
				email_confirm: false, // User will confirm via OTP
				user_metadata: {
					full_name: full_name || null,
					invited_by: user.email
				}
			});

			if (authError) {
				console.error('Auth user creation error:', authError);
				throw error(400, authError.message || 'Failed to create user');
			}

			authData = newAuthData;

			// Now send OTP for the new user
			const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
				email,
				options: {
					shouldCreateUser: false // User already created above
				}
			});

			if (otpError) {
				console.error('OTP send error:', otpError);
				// Clean up the created user
				await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
				throw error(400, otpError.message || 'Failed to send OTP');
			}
		}

		// Wait a moment for the trigger to potentially create the profile
		await new Promise(resolve => setTimeout(resolve, 500));

		// Check if profile was created by trigger, if not create it manually
		let { data: existingProfile } = await supabaseAdmin
			.from('user_profiles')
			.select()
			.eq('id', authData.user.id)
			.single();

		let profileData;

		if (existingProfile) {
			// Profile exists, update it with the provided information
			const { data: updatedProfile, error: updateError } = await supabaseAdmin
				.from('user_profiles')
				.update({
					full_name: full_name || null,
					modules: uniqueModules
				})
				.eq('id', authData.user.id)
				.select()
				.single();

			if (updateError) {
				console.error('Profile update error:', updateError);
				await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
				throw error(500, 'Failed to update user profile: ' + updateError.message);
			}
			profileData = updatedProfile;
		} else {
			// Profile doesn't exist, create it manually
			const { data: newProfile, error: insertError } = await supabaseAdmin
				.from('user_profiles')
				.insert({
					id: authData.user.id,
					email: email,
					full_name: full_name || null,
					modules: uniqueModules
				})
				.select()
				.single();

			if (insertError) {
				console.error('Profile insert error:', insertError);
				await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
				throw error(500, 'Failed to create user profile: ' + insertError.message);
			}
			profileData = newProfile;
		}

		// Create pending invitation with shareable code
		// This provides a fallback if email OTP doesn't work
		const invitation = await createInvitation({
			email: email,
			modules: uniqueModules,
			createdBy: user.id,
			userId: authData.user.id
		});

		return json({
			success: true,
			user: {
				...profileData,
				modules: uniqueModules
			},
			invitation: {
				code: invitation.code,
				url: getInvitationUrl(invitation.code, PUBLIC_SITE_URL),
				expires_at: invitation.expires_at
			}
		});

	} catch (err) {
		console.error('Error creating user:', err);

		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Internal server error');
	}
}

export async function DELETE(event) {
	try {
		// Check if user has users module access (admins automatically have access)
		const { user } = await requireModule(event, 'users');

		const { request } = event;

		const { userId } = await request.json();

		if (!userId) {
			throw error(400, 'User ID is required');
		}

		// Prevent self-deletion
		if (userId === user.id) {
			throw error(400, 'You cannot delete your own account');
		}

		// Try to delete from Supabase Auth first
		const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

		// If user not found in auth, they might be a pending invite - just delete from user_profiles
		if (deleteError && deleteError.code === 'user_not_found') {
			console.log('User not found in auth, deleting from user_profiles only');

			// Delete directly from user_profiles (will cascade to related tables)
			const { error: profileDeleteError } = await supabaseAdmin
				.from('user_profiles')
				.delete()
				.eq('id', userId);

			if (profileDeleteError) {
				console.error('Error deleting user profile:', profileDeleteError);
				throw error(400, 'Failed to delete user profile');
			}

			return json({
				success: true,
				message: 'User profile deleted successfully'
			});
		}

		if (deleteError) {
			console.error('Delete error:', deleteError);
			throw error(400, deleteError.message || 'Failed to delete user');
		}

		// Auth user deleted successfully - now also delete from user_profiles
		const { error: profileDeleteError } = await supabaseAdmin
			.from('user_profiles')
			.delete()
			.eq('id', userId);

		if (profileDeleteError) {
			console.error('Error deleting user profile after auth deletion:', profileDeleteError);
			// Don't throw error here - auth user is already deleted
			// Just log the warning
			console.warn('Auth user was deleted but profile cleanup failed');
		}

		return json({
			success: true,
			message: 'User deleted successfully'
		});

	} catch (err) {
		console.error('Error deleting user:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
}

export async function PUT(event) {
	try {
		// Check if user has users module access (admins automatically have access)
		const { user } = await requireModule(event, 'users');

		const { request } = event;

		// Parse body once and store it
		const body = await request.json();
		const { userId, action, modules } = body;

		if (!userId) {
			throw error(400, 'User ID is required');
		}

		if (!action) {
			throw error(400, 'Action is required');
		}

		// Handle resend invitation
		if (action === 'resend_invitation') {
			// Get user email from auth
			const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

			if (getUserError || !authUser) {
				throw error(400, 'User not found');
			}

			// Resend OTP code instead of magic link
			const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
				email: authUser.user.email,
				options: {
					shouldCreateUser: false
				}
			});

			if (otpError) {
				throw error(400, otpError.message || 'Failed to resend OTP');
			}

			// Update invitation record if it exists
			const { data: invitation } = await supabaseAdmin
				.from('pending_invitations')
				.select('id')
				.eq('user_id', userId)
				.eq('status', 'pending')
				.single();

			if (invitation) {
				await resendInvitation(invitation.id);
			}

			return json({
				success: true,
				message: 'OTP code resent successfully'
			});
		}

		// Handle update modules
		if (action === 'update_modules') {
			// Validate modules (removed accf_admin as it's deprecated)
			const allowedModules = [
				'users',
				'editor',
				'dgr',
				'courses.participant',
				'courses.manager',
				'courses.admin'
			];

			if (!Array.isArray(modules)) {
				throw error(400, 'Modules must be an array');
			}

			const cleanModules = modules
				.filter((value) => typeof value === 'string')
				.map((value) => value.trim())
				.filter((value) => value.length > 0);

			if (cleanModules.some((m) => !allowedModules.includes(m))) {
				throw error(400, 'Invalid module specified');
			}

			const uniqueModules = Array.from(new Set(cleanModules));

			console.log('Updating modules:', { original: modules, cleaned: uniqueModules });

			// Update user modules (use cleaned modules)
			const { error: updateError } = await supabaseAdmin
				.from('user_profiles')
				.update({ modules: uniqueModules })
				.eq('id', userId);

			if (updateError) {
				console.error('Error updating modules:', updateError);
				throw error(500, 'Failed to update user modules');
			}

			return json({
				success: true,
				message: 'User modules updated successfully'
			});
		}

		throw error(400, 'Invalid action');

	} catch (err) {
		console.error('Error updating user:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
}
