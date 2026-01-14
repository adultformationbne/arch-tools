import { error } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries, groupMaterialsBySession } from '$lib/server/course-data.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	// Get user's enrollment
	const { data: enrollment, error: enrollmentError } = await CourseQueries.getEnrollment(
		user.id,
		courseSlug,
		cohortId
	);

	if (enrollmentError || !enrollment) {
		throw error(404, 'User enrollment not found. Please contact an administrator.');
	}

	const moduleId = enrollment.cohort.module.id;
	const currentSession = enrollment.current_session;

	// Check user role for access permissions
	const userRole = enrollment.role || 'student';
	const isAdmin = userRole === 'admin';
	const isStaffRole = userRole === 'coordinator' || userRole === 'admin';

	// Get sessions for the module
	const { data: allSessions, error: sessionsError } = await CourseQueries.getSessions(moduleId);

	if (sessionsError || !allSessions) {
		throw error(500, 'Failed to load sessions');
	}

	// Filter sessions based on role:
	// - Students only see sessions up to and including the current session
	// - Coordinators and admins can see all sessions
	// - If currentSession is null/undefined, students only see session 0 (pre-start materials)
	const effectiveSession = currentSession ?? 0;
	const sessions = isStaffRole
		? allSessions
		: allSessions.filter((s) => s.session_number <= effectiveSession);
	const sessionIds = sessions.map((s) => s.id);

	// Get materials for the filtered sessions
	const { data: materials, error: materialsError } = await CourseQueries.getMaterials(sessionIds);

	if (materialsError) {
		throw error(500, 'Failed to load materials');
	}

	// Filter materials based on coordinator_only flag
	const filteredMaterials = (materials || []).filter(
		(m) => !m.coordinator_only || isStaffRole
	);

	// Group filtered materials by session
	const materialsBySession = groupMaterialsBySession(filteredMaterials);

	return {
		materials: filteredMaterials,
		materialsBySession,
		currentSession,
		courseName: enrollment.cohort.module.name || 'Course Materials'
	};
};
