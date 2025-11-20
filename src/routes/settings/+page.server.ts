import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';
import { PlatformAggregates } from '$lib/server/course-data';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const load: PageServerLoad = async (event) => {
	// Check if user has platform admin module access
	const { user, profile: currentUserProfile } = await requireModule(event, 'platform.admin', {
		mode: 'redirect',
		redirectTo: '/login'
	});

	// Fetch all platform data in parallel
	const result = await PlatformAggregates.getAdminSettings();

	if (result.error) {
		console.error('Error loading admin settings:', result.error);
	}

	const { users, enrollments, courses, cohorts } = result.data;

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

	// Group enrollments by user
	const enrollmentsByUser = {};
	(enrollments || []).forEach((enrollment) => {
		if (!enrollmentsByUser[enrollment.user_profile_id]) {
			enrollmentsByUser[enrollment.user_profile_id] = [];
		}
		enrollmentsByUser[enrollment.user_profile_id].push(enrollment);
	});

	// Add enrollments to each user
	const usersWithEnrollments = enrichedUsers.map((user) => ({
		...user,
		enrollments: enrollmentsByUser[user.id] || []
	}));

	return {
		users: usersWithEnrollments,
		currentUser: user,
		currentUserProfile,
		courses: courses || [],
		cohorts: cohorts || []
	};
};
