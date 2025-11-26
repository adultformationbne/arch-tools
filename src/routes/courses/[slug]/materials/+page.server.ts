import { error } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries, groupMaterialsBySession } from '$lib/server/course-data.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get user's enrollment
	const { data: enrollment, error: enrollmentError } = await CourseQueries.getEnrollment(
		user.id,
		courseSlug
	);

	if (enrollmentError || !enrollment) {
		throw error(404, 'User enrollment not found. Please contact an administrator.');
	}

	const moduleId = enrollment.cohort.module.id;
	const currentSession = enrollment.current_session;

	// Get sessions for the module
	const { data: sessions, error: sessionsError } = await CourseQueries.getSessions(moduleId);

	if (sessionsError || !sessions) {
		throw error(500, 'Failed to load sessions');
	}

	const sessionIds = sessions.map((s) => s.id);

	// Get materials for all sessions
	const { data: materials, error: materialsError } = await CourseQueries.getMaterials(sessionIds);

	if (materialsError) {
		throw error(500, 'Failed to load materials');
	}

	// Check if user can see coordinator-only materials
	const userRole = enrollment.role || 'student';
	const canSeeCoordinatorMaterials = userRole === 'coordinator' || userRole === 'admin';

	// Filter materials based on coordinator_only flag
	const filteredMaterials = (materials || []).filter(
		(m) => !m.coordinator_only || canSeeCoordinatorMaterials
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
