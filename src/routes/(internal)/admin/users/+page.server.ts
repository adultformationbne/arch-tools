import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

export const load: PageServerLoad = async (event) => {
	// Check if user has user_management module access (admins automatically have access)
	const { user, profile: currentUserProfile } = await requireModule(event, 'user_management', {
		mode: 'redirect',
		redirectTo: '/profile'
	});

	// Fetch ALL users (not just admins)
	const { data: users, error } = await event.locals.supabase
		.from('user_profiles')
		.select('*')
		.order('created_at', { ascending: false});

	if (error) {
		console.error('Error loading users:', error);
	}

	// Fetch all course enrollments with course/cohort details
	const { data: enrollments, error: enrollmentsError } = await event.locals.supabase
		.from('courses_enrollments')
		.select(`
			id,
			user_profile_id,
			role,
			cohort:courses_cohorts(
				id,
				name,
				module:courses_modules(
					id,
					name,
					course:courses(
						id,
						name,
						slug
					)
				)
			)
		`)
		.order('created_at', { ascending: false });

	if (enrollmentsError) {
		console.error('Error loading enrollments:', enrollmentsError);
	}

	// Fetch all available courses
	const { data: courses, error: coursesError } = await event.locals.supabase
		.from('courses')
		.select('id, name, slug')
		.order('name');

	if (coursesError) {
		console.error('Error loading courses:', coursesError);
	}

	// Fetch all available cohorts
	const { data: cohorts, error: cohortsError } = await event.locals.supabase
		.from('courses_cohorts')
		.select(`
			id,
			name,
			module:courses_modules(
				id,
				name,
				course:courses(
					id,
					name,
					slug
				)
			)
		`)
		.order('name');

	if (cohortsError) {
		console.error('Error loading cohorts:', cohortsError);
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