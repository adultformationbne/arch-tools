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

		const { email, password, full_name, role } = await request.json();

		// Validate required fields
		if (!email || !password) {
			throw error(400, 'Email and password are required');
		}

		// Validate password length
		if (password.length < 6) {
			throw error(400, 'Password must be at least 6 characters');
		}

		// Validate role
		const validRoles = ['admin', 'editor', 'contributor', 'viewer'];
		if (!validRoles.includes(role)) {
			throw error(400, 'Invalid role');
		}

		// Create admin client with service role key
		const adminSupabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		// Create the user in Supabase Auth using Admin API
		const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
			email,
			password,
			email_confirm: true // Auto-confirm email for admin-created users
		});

		if (authError) {
			console.error('Auth error:', authError);
			throw error(400, authError.message || 'Failed to create user');
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
					role: role
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
					email: authData.user.email,
					full_name: full_name || null,
					role: role
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