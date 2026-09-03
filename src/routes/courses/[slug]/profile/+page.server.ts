import { requireCourseAccess } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role). The enrolment it
	// resolves carries the cohort, hub and profile this page shows.
	const { user, enrollment } = await requireCourseAccess(event, courseSlug);

	const profileData = {
		name: enrollment?.user_profile?.full_name || enrollment?.full_name || user.email,
		email: enrollment?.user_profile?.email || enrollment?.email || user.email,
		displayName: enrollment?.user_profile?.display_name || null,
		phone: enrollment?.user_profile?.phone || null,
		parishCommunity: enrollment?.user_profile?.parish_community || null,
		parishRole: enrollment?.user_profile?.parish_role || null,
		address: enrollment?.user_profile?.address || null,
		organization: enrollment?.user_profile?.organization || null,
		bio: enrollment?.user_profile?.bio || null,
		cohortName: enrollment?.cohort?.name || 'No cohort assigned',
		moduleName: enrollment?.cohort?.module?.name || 'Unknown module',
		hubName: enrollment?.hub?.name || 'No hub assigned',
		hubLocation: enrollment?.hub?.location || null,
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
