import { error, redirect } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries, CourseAggregates, groupQuestionsBySession } from '$lib/server/course-data.js';
import { getReflectionStatus } from '$lib/utils/reflection-status.js';
import { getUserInitials } from '$lib/utils/avatar.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	// Check if reflections are enabled for this course
	const courseSettings = getCourseSettings(course?.settings);
	if (courseSettings.features?.reflectionsEnabled === false) {
		throw redirect(302, `/courses/${courseSlug}`);
	}

	// Get all reflections page data in one optimized call
	const result = await CourseAggregates.getReflectionsPage(user.id, courseSlug, cohortId);

	if (result.error || !result.data) {
		throw error(500, 'Failed to load reflections');
	}

	const { enrollment, sessions, questions, responses, publicReflections } = result.data;

	// Clear stale cohort cookie if it didn't match the actual enrollment
	if (course && cohortId && enrollment.cohort_id !== cohortId) {
		event.cookies.delete(`active_cohort_${course.id}`, { path: '/' });
	}

	// Group questions by session number
	const questionsBySession = groupQuestionsBySession(questions);

	// Build responsesBySession lookup
	const responsesBySession: Record<number, any> = {};
	responses.forEach((response) => {
		const sessionNumber = response.question?.session?.session_number;
		if (sessionNumber) {
			responsesBySession[sessionNumber] = response;
		}
	});

	// Process my reflections to match component format
	const processedMyReflections = [];

	// Create entries for all sessions (1 through currentSession)
	// Only include sessions where reflections are enabled
	for (let session = 1; session <= enrollment.current_session; session++) {
		const question = questionsBySession[session];
		const response = responsesBySession[session];

		if (question) {
			// Use centralized status utility
			const status = getReflectionStatus(response);

			processedMyReflections.push({
				id: response?.id || `new-${session}`,
				sessionNumber: session,
				question: question.text,
				questionId: question.id,
				myResponse: response?.response_text || '',
				submittedAt: response?.created_at || null,
				status: status,
				feedback: response?.feedback || null,
				grade: response?.grade,
				markedAt: response?.marked_at || null,
				markedBy: response?.marked_by_profile?.full_name || null,
				isPublic: response?.is_public || false,
				_raw: response
			});
		}
	}

	// Sort by session number descending (newest first)
	processedMyReflections.sort((a, b) => b.sessionNumber - a.sessionNumber);

	// Process cohort reflections
	const processedCohortReflections =
		publicReflections?.map((response) => {
			const studentName =
				response.enrollment?.user_profile?.full_name ||
				response.user_profile?.full_name ||
				'Anonymous';

			return {
				id: response.id,
				studentName,
				studentInitials: getUserInitials(studentName),
				sessionNumber: response.question?.session?.session_number || 0,
				question: response.question?.question_text || '',
				response: response.response_text || '',
				submittedAt: response.created_at,
				status: response.status || 'submitted',
				isPublic: response.is_public
			};
		}) || [];

	// Get current reflection question (if there's one due and reflections are enabled)
	const currentSession = enrollment.current_session;
	const currentReflectionQuestion = questionsBySession[currentSession];
	const hasCurrentSubmission = responsesBySession[currentSession];

	const currentQuestion = currentReflectionQuestion
		? {
				sessionNumber: currentSession,
				questionId: currentReflectionQuestion.id,
				question: currentReflectionQuestion.text,
				dueDate: null, // Due dates not currently tracked in database
				isOverdue: false,
				hasSubmitted: !!hasCurrentSubmission
			}
		: null;

	return {
		myReflections: processedMyReflections,
		cohortReflections: processedCohortReflections,
		currentReflectionQuestion: currentQuestion,
		userId: user.id,
		cohortId: enrollment.cohort_id,
		currentSession,
		courseSlug
	};
};
