import { supabaseAdmin } from '$lib/server/supabase.js';
import { getDevUserFromRequest, defaultDevUser } from '$lib/server/dev-user.js';
import { getReflectionStatus } from '$lib/utils/reflection-status.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	// Get current user from dev mode cookies - in production this would come from auth
	const devUser = getDevUserFromRequest(request) || defaultDevUser;
	const currentUserId = devUser.id;

	// Get user's enrollment to determine cohort and current session
	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('accf_users')
		.select('cohort_id, current_session')
		.eq('id', currentUserId)
		.single();

	let cohortId = '82d230c2-6ecc-4eab-96fc-c90a11dbd5fe'; // fallback
	let currentSession = devUser.current_session || 3; // fallback

	if (enrollment && !enrollmentError) {
		cohortId = enrollment.cohort_id;
		currentSession = enrollment.current_session;
	}

	try {
		// Get cohort's module_id first
		const { data: cohort } = await supabaseAdmin
			.from('cohorts')
			.select('module_id')
			.eq('id', cohortId)
			.single();

		const moduleId = cohort?.module_id;

		// Fetch user's reflection responses (using correct field names)
		const { data: myReflectionResponses, error: myResponsesError } = await supabaseAdmin
			.from('reflection_responses')
			.select(`
				*,
				module_reflection_questions!question_id (
					question_text,
					module_sessions!inner (
						session_number
					)
				),
				marked_by_profile:marked_by (
					full_name
				)
			`)
			.eq('accf_user_id', currentUserId)
			.order('created_at', { ascending: false });

		if (myResponsesError) {
			console.error('Error fetching my reflection responses:', myResponsesError);
		}

		// Fetch all reflection questions for this module
		const { data: reflectionQuestions, error: questionsError } = await supabaseAdmin
			.from('module_reflection_questions')
			.select(`
				*,
				module_sessions!inner (
					session_number
				)
			`)
			.eq('module_sessions.module_id', moduleId);

		// Sort by session number in code (can't order by joined columns in Supabase)
		reflectionQuestions?.sort((a, b) =>
			a.module_sessions.session_number - b.module_sessions.session_number
		);

		if (questionsError) {
			console.error('Error fetching reflection questions:', questionsError);
		}

		// Fetch cohort reflections (public reflections from same cohort)
		const { data: cohortReflections, error: cohortError } = await supabaseAdmin
			.from('reflection_responses')
			.select(`
				*,
				module_reflection_questions!question_id (
					question_text,
					module_sessions!inner (
						session_number
					)
				),
				user_profile:accf_user_id (
					full_name
				)
			`)
			.eq('cohort_id', cohortId)
			.eq('is_public', true)
			.not('accf_user_id', 'eq', currentUserId) // Exclude current user's reflections
			.order('created_at', { ascending: false })
			.limit(20);

		if (cohortError) {
			console.error('Error fetching cohort reflections:', cohortError);
		}

		const sameCohortReflections = cohortReflections || [];

		// Process my reflections to match component format
		const processedMyReflections = [];
		const responsesBySession = {};

		// First, organize existing responses by session
		myReflectionResponses?.forEach(response => {
			const sessionNumber = response.module_reflection_questions?.module_sessions?.session_number;
			if (sessionNumber) {
				responsesBySession[sessionNumber] = response;
			}
		});

		// Create entries for all sessions (1 through currentSession)
		for (let session = 1; session <= currentSession; session++) {
			const question = reflectionQuestions?.find(q => q.module_sessions?.session_number === session);
			const response = responsesBySession[session];

			if (question) {
				// Add session_number to response for utility compatibility
				const responseWithSession = response ? {
					...response,
					session_number: session
				} : null;

				// Use centralized status utility
				const status = getReflectionStatus(responseWithSession);

				processedMyReflections.push({
					id: response?.id || `new-${session}`,
					sessionNumber: session,
					question: question.question_text,
					questionId: question.id,
					myResponse: response?.response_text || '',
					submittedAt: response?.created_at || null,
					status: status, // Use centralized status logic
					feedback: response?.feedback || null,
					grade: response?.grade, // Use correct field name
					markedAt: response?.marked_at || null,
					markedBy: response?.marked_by_profile?.full_name || null,
					isPublic: response?.is_public || false,
					// Pass through raw response for debugging
					_raw: response
				});
			}
		}

		// Sort by session number descending (newest first)
		processedMyReflections.sort((a, b) => b.sessionNumber - a.sessionNumber);

		// Process cohort reflections
		const processedCohortReflections = sameCohortReflections?.map(response => {
			const getInitials = (fullName) => {
				if (!fullName) return 'AN';
				return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
			};

			return {
				id: response.id,
				studentName: response.user_profile?.full_name || 'Anonymous',
				studentInitials: getInitials(response.user_profile?.full_name),
				sessionNumber: response.module_reflection_questions?.module_sessions?.session_number || 0,
				question: response.module_reflection_questions?.question_text || '',
				response: response.response_text || '',
				submittedAt: response.created_at,
				status: response.status || 'submitted',
				isPublic: response.is_public
			};
		}) || [];

		// Get current reflection question (if there's one due)
		const currentReflectionQuestion = reflectionQuestions?.find(q => q.module_sessions?.session_number === currentSession);
		const hasCurrentSubmission = responsesBySession[currentSession];

		const currentQuestion = currentReflectionQuestion ? {
			sessionNumber: currentSession,
			questionId: currentReflectionQuestion.id,
			question: currentReflectionQuestion.question_text,
			dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now (placeholder)
			isOverdue: false, // TODO: Implement proper due date logic
			hasSubmitted: !!hasCurrentSubmission
		} : null;

		return {
			myReflections: processedMyReflections,
			cohortReflections: processedCohortReflections,
			currentReflectionQuestion: currentQuestion,
			currentUserId,
			cohortId,
			currentSession
		};

	} catch (error) {
		console.error('Error in reflections load function:', error);
		return {
			myReflections: [],
			cohortReflections: [],
			currentReflectionQuestion: null,
			currentUserId,
			cohortId,
			currentSession,
			error: 'Failed to load reflections data'
		};
	}
};