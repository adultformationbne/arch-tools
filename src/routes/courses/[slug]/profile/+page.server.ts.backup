import { requireCourseAccess } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get user's enrollment details with cohort and hub information
	const { data: enrollment } = await supabaseAdmin
		.from('courses_enrollments')
		.select(
			`
			id,
			cohort_id,
			current_session,
			role,
			hub_id,
			enrolled_at,
			full_name,
			email,
			user_profiles!user_profile_id (
				full_name,
				email,
				display_name,
				phone,
				organization,
				bio
			),
			courses_cohorts!cohort_id (
				name,
				current_session,
				start_date,
				courses_modules!module_id (
					name,
					description
				)
			),
			courses_hubs!hub_id (
				name,
				location
			)
		`
		)
		.eq('user_profile_id', user.id)
		.single();

	const profileData = {
		name: enrollment?.user_profiles?.full_name || enrollment?.full_name || user.email,
		email: enrollment?.user_profiles?.email || enrollment?.email || user.email,
		displayName: enrollment?.user_profiles?.display_name || null,
		phone: enrollment?.user_profiles?.phone || null,
		organization: enrollment?.user_profiles?.organization || null,
		bio: enrollment?.user_profiles?.bio || null,
		cohortName: enrollment?.courses_cohorts?.name || 'No cohort assigned',
		moduleName: enrollment?.courses_cohorts?.courses_modules?.name || 'Unknown module',
		hubName: enrollment?.courses_hubs?.name || 'No hub assigned',
		hubLocation: enrollment?.courses_hubs?.location || null,
		currentSession: enrollment?.current_session || 0,
		role: enrollment?.role || 'student',
		joinDate: enrollment?.enrolled_at
			? new Date(enrollment.enrolled_at).toLocaleDateString('en-US', {
					month: 'long',
					day: 'numeric',
					year: 'numeric'
			  })
			: 'Unknown',
		userId: user.id
	};

	return {
		profileData
	};
};
