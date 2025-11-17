import { json, error } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth.js';
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
		} else {
			// Generate invite link without sending email
			// This creates the user and gives us the auth token but doesn't send any email
			const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
				type: 'invite',
				email,
				options: {
					data: {
						full_name: full_name || null,
						invited_by: user.email
					}
				}
			});

			if (linkError) {
				console.error('Generate link error:', linkError);
				throw error(400, linkError.message || 'Failed to generate invitation');
			}

			// The user is now created but no email was sent
			authData = linkData;
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

		return json({
			success: true,
			user: {
				...profileData,
				modules: uniqueModules
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

		// Handle resend invitation (sends OTP to user's email)
		if (action === 'resend_invitation') {
			// Get user email from auth
			const { data: authUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

			if (getUserError || !authUser) {
				throw error(400, 'User not found');
			}

			// Send OTP code to user's email
			const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
				email: authUser.user.email,
				options: {
					shouldCreateUser: false
				}
			});

			if (otpError) {
				throw error(400, otpError.message || 'Failed to send OTP');
			}

			return json({
				success: true,
				message: 'Login instructions sent to user\'s email'
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
