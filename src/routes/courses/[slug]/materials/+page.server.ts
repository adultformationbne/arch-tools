import { error, redirect } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries, groupMaterialsBySession } from '$lib/server/course-data.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	// Check if materials are enabled for this course
	const materialSettings = getCourseSettings(course?.settings);
	if (materialSettings.features?.materialsEnabled === false) {
		throw redirect(302, `/courses/${courseSlug}`);
	}

	// Get user's enrollment
	const { data: enrollment, error: enrollmentError } = await CourseQueries.getEnrollment(
		user.id,
		courseSlug,
		cohortId
	);

	if (enrollmentError || !enrollment) {
		throw error(404, 'User enrollment not found. Please contact an administrator.');
	}

	// Clear stale cohort cookie if it didn't match the actual enrollment
	if (course && cohortId && enrollment.cohort_id !== cohortId) {
		event.cookies.delete(`active_cohort_${course.id}`, { path: '/' });
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

	// Get course settings for visibility rules
	const courseSettings = getCourseSettings(course?.settings);
	const coordinatorAccessAhead = courseSettings.coordinatorAccess?.sessionsAhead ?? 'all';

	// Filter sessions based on role and settings:
	// - Students only see sessions up to and including the current session
	// - Coordinators see ahead based on settings (all or N sessions ahead)
	// - Admins always see all sessions
	// - If currentSession is null/undefined, students only see session 0 (pre-start materials)
	const effectiveSession = currentSession ?? 0;

	let maxVisibleSession: number;
	if (isAdmin) {
		// Admins always see everything
		maxVisibleSession = Infinity;
	} else if (userRole === 'coordinator') {
		// Coordinators see based on settings
		if (coordinatorAccessAhead === 'all') {
			maxVisibleSession = Infinity;
		} else {
			maxVisibleSession = effectiveSession + coordinatorAccessAhead;
		}
	} else {
		// Students see only up to their current session
		maxVisibleSession = effectiveSession;
	}

	// For participants (not admin/coordinator), also include the next session
	// so early-access materials from it can be shown
	const earlyAccessSessionNumber = (!isAdmin && userRole !== 'coordinator') ? effectiveSession + 1 : null;

	const sessions = allSessions.filter((s) => {
		if (s.session_number <= maxVisibleSession) return true;
		if (earlyAccessSessionNumber !== null && s.session_number === earlyAccessSessionNumber) return true;
		return false;
	});
	const sessionIds = sessions.map((s) => s.id);

	// Get materials for the filtered sessions
	const { data: materials, error: materialsError } = await CourseQueries.getMaterials(sessionIds);

	if (materialsError) {
		throw error(500, 'Failed to load materials');
	}

	const userHubId = enrollment.hub_id;

	const filteredMaterials = (materials || []).filter((m) => {
		if (m.min_role === 'coordinator' && !isStaffRole) return false;
		const hubRestrictions = (m.hub_visibility || []) as { hub_id: string }[];
		if (hubRestrictions.length > 0 && !userHubId) return false;
		if (hubRestrictions.length > 0 && !hubRestrictions.some((h) => h.hub_id === userHubId)) return false;
		// For next-session early-access materials, only show if flagged available_early
		if (earlyAccessSessionNumber !== null && m.session?.session_number === earlyAccessSessionNumber && !m.available_early) return false;
		return true;
	});

	// Group filtered materials by session
	const materialsBySession = groupMaterialsBySession(filteredMaterials);

	return {
		materials: filteredMaterials,
		materialsBySession,
		currentSession,
		earlyAccessSessionNumber,
		courseName: enrollment.cohort.module.name || 'Course Materials'
	};
};
