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

		// Check if user has user_management module access
		const { data: adminProfile } = await supabase
			.from('user_profiles')
			.select('modules')
			.eq('id', user.id)
			.single();

		const hasUserManagement = adminProfile?.modules?.includes('user_management');
		if (!hasUserManagement) {
			throw error(403, 'Insufficient permissions. User management access required.');
		}

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
		const validModules = ['user_management', 'dgr', 'editor', 'courses', 'admin'];
		if (modules && !Array.isArray(modules)) {
			throw error(400, 'Modules must be an array');
		}
		if (modules && modules.some(m => !validModules.includes(m))) {
			throw error(400, 'Invalid module specified');
		}

		// Create admin client with service role key
		const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		// Check if user already exists in auth system
		const { data: { users: existingAuthUsers } } = await adminSupabase.auth.admin.listUsers();
		const existingAuthUser = existingAuthUsers?.find(u => u.email === email);

		let authData;

		if (existingAuthUser) {
			// User exists in Auth but was deleted from user_profiles
			// Re-use the existing auth user instead of creating new one
			console.log('Re-using existing auth user:', existingAuthUser.id);
			authData = { user: existingAuthUser };
		} else {
			// Send invitation email using Supabase's built-in system
			// This sends a magic link that allows the user to set their password
			const { data: newAuthData, error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(
				email,
				{
					data: {
						full_name: full_name || null,
						invited_by: user.email
					},
					redirectTo: `${PUBLIC_SUPABASE_URL}/auth/callback`
				}
			);

			if (authError) {
				console.error('Auth invitation error:', authError);
				throw error(400, authError.message || 'Failed to send invitation');
			}

			authData = newAuthData;
		}

		// Wait a moment for the trigger to potentially create the profile
		await new Promise(resolve => setTimeout(resolve, 500));

		// Check if profile was created by trigger, if not create it manually
		let { data: existingProfile } = await adminSupabase
			.from('user_profiles')
			.select()
			.eq('id', authData.user.id)
			.single();

		let profileData;

		if (existingProfile) {
			// Profile exists, update it with the provided information
			const { data: updatedProfile, error: updateError } = await adminSupabase
				.from('user_profiles')
				.update({
					full_name: full_name || null,
					role: 'admin', // All admin users have role='admin'
					modules: modules || []
				})
				.eq('id', authData.user.id)
				.select()
				.single();

			if (updateError) {
				console.error('Profile update error:', updateError);
				await adminSupabase.auth.admin.deleteUser(authData.user.id);
				throw error(500, 'Failed to update user profile: ' + updateError.message);
			}
			profileData = updatedProfile;
		} else {
			// Profile doesn't exist, create it manually
			const { data: newProfile, error: insertError } = await adminSupabase
				.from('user_profiles')
				.insert({
					id: authData.user.id,
					email: email,
					full_name: full_name || null,
					role: 'admin', // All admin users have role='admin'
					modules: modules || []
				})
				.select()
				.single();

			if (insertError) {
				console.error('Profile insert error:', insertError);
				await adminSupabase.auth.admin.deleteUser(authData.user.id);
				throw error(500, 'Failed to create user profile: ' + insertError.message);
			}
			profileData = newProfile;
		}

		return json({
			success: true,
			user: profileData
		});

	} catch (err) {
		console.error('Error creating user:', err);

		if (err.status) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Internal server error');
	}
}

export async function DELETE({ request, locals: { supabase, safeGetSession } }) {
	try {
		const { session, user } = await safeGetSession();

		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user has user_management module access
		const { data: adminProfile } = await supabase
			.from('user_profiles')
			.select('modules')
			.eq('id', user.id)
			.single();

		const hasUserManagement = adminProfile?.modules?.includes('user_management');
		if (!hasUserManagement) {
			throw error(403, 'Insufficient permissions. User management access required.');
		}

		const { userId } = await request.json();

		if (!userId) {
			throw error(400, 'User ID is required');
		}

		// Prevent self-deletion
		if (userId === user.id) {
			throw error(400, 'You cannot delete your own account');
		}

		// Create admin client with service role key
		const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		// Try to delete from Supabase Auth first
		const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(userId);

		// If user not found in auth, they might be a pending invite - just delete from user_profiles
		if (deleteError && deleteError.code === 'user_not_found') {
			console.log('User not found in auth, deleting from user_profiles only');

			// Delete directly from user_profiles (will cascade to related tables)
			const { error: profileDeleteError } = await adminSupabase
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

export async function PUT({ request, locals: { supabase, safeGetSession } }) {
	try {
		const { session, user } = await safeGetSession();

		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user has user_management module access
		const { data: adminProfile } = await supabase
			.from('user_profiles')
			.select('modules')
			.eq('id', user.id)
			.single();

		const hasUserManagement = adminProfile?.modules?.includes('user_management');
		if (!hasUserManagement) {
			throw error(403, 'Insufficient permissions. User management access required.');
		}

		const { userId, action } = await request.json();

		if (!userId) {
			throw error(400, 'User ID is required');
		}

		if (!action) {
			throw error(400, 'Action is required');
		}

		// Create admin client with service role key
		const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		// Handle resend invitation
		if (action === 'resend_invitation') {
			// Get user email from auth
			const { data: authUser, error: getUserError } = await adminSupabase.auth.admin.getUserById(userId);

			if (getUserError || !authUser) {
				throw error(400, 'User not found');
			}

			// Resend invitation using inviteUserByEmail
			const { error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
				authUser.user.email,
				{
					data: {
						full_name: authUser.user.user_metadata?.full_name || null,
						invited_by: user.email
					},
					redirectTo: `${PUBLIC_SUPABASE_URL}/auth/callback`
				}
			);

			if (inviteError) {
				throw error(400, inviteError.message || 'Failed to resend invitation');
			}

			return json({
				success: true,
				message: 'Invitation resent successfully'
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