import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/utils/auth-helpers';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	// Check if user has user_management module access
	const currentUserProfile = await requireModule(supabase, user.id, 'user_management');

	// Fetch all admin users only (exclude students/coordinators)
	const { data: users, error } = await supabase
		.from('user_profiles')
		.select('*')
		.eq('role', 'admin')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('Error loading users:', error);
	}

	// Create admin client to check auth status
	const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	// Enrich users with auth status (pending vs active)
	const enrichedUsers = await Promise.all(
		(users || []).map(async (user) => {
			try {
				// Check if user exists in auth
				const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(
					user.id
				);

				// If user exists in auth and has confirmed email, they're active
				const isPending = !authUser || !authUser.user?.email_confirmed_at;

				return {
					...user,
					isPending,
					lastSignInAt: authUser?.user?.last_sign_in_at || null
				};
			} catch (err) {
				// If error fetching auth, assume pending
				return {
					...user,
					isPending: true,
					lastSignInAt: null
				};
			}
		})
	);

	return {
		users: enrichedUsers,
		currentUser: user,
		currentUserProfile
	};
};