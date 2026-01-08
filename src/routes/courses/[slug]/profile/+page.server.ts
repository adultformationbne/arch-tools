import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries } from '$lib/server/course-data.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	// Get user's enrollment details with cohort and hub information using repository
	const { data: enrollment } = await CourseQueries.getEnrollment(user.id, courseSlug, cohortId);

	const profileData = {
		name: enrollment?.user_profile?.full_name || enrollment?.full_name || user.email,
		email: enrollment?.user_profile?.email || enrollment?.email || user.email,
		displayName: enrollment?.user_profile?.display_name || null,
		phone: enrollment?.user_profile?.phone || null,
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
