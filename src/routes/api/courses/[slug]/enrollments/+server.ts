import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

/**
 * GET /api/courses/[slug]/enrollments
 *
 * Fetch enrollments with filtering support for email recipient selection.
 *
 * Query params:
 * - cohort_id (required): Filter by cohort
 * - status: Filter by enrollment status (default: 'active')
 * - role: Filter by role ('student' | 'coordinator')
 * - hub_id: Filter by hub assignment
 * - current_session: Filter by student's current session number
 * - has_pending_reflections: Filter students who have ANY outstanding reflections
 */
export const GET: RequestHandler = async (event) => {
	try {
		const { slug } = event.params;

		// Auth check - require course admin
		await requireCourseAdmin(event, slug);

		// Parse query params
		const url = new URL(event.request.url);
		const cohortId = url.searchParams.get('cohort_id');
		const status = url.searchParams.get('status') || 'active';
		const role = url.searchParams.get('role');
		const hubId = url.searchParams.get('hub_id');
		const currentSession = url.searchParams.get('current_session');
		const hasPendingReflections = url.searchParams.get('has_pending_reflections') === 'true';

		// Validation
		if (!cohortId) {
			return json({ error: 'cohort_id is required' }, { status: 400 });
		}

		// Build query
		let query = supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id,
				email,
				full_name,
				role,
				status,
				current_session,
				cohort_id,
				hub_id,
				courses_hubs (
					id,
					name
				)
			`)
			.eq('cohort_id', cohortId);

		// Apply filters
		if (status) {
			query = query.eq('status', status);
		}

		if (role) {
			query = query.eq('role', role);
		}

		if (hubId) {
			query = query.eq('hub_id', hubId);
		}

		if (currentSession) {
			query = query.eq('current_session', parseInt(currentSession));
		}

		// Order by name
		query = query.order('full_name', { ascending: true });

		const { data: enrollments, error: enrollmentsError } = await query;

		if (enrollmentsError) {
			console.error('Error fetching enrollments:', enrollmentsError);
			return json({ error: 'Failed to fetch enrollments' }, { status: 500 });
		}

		let filteredEnrollments = enrollments || [];

		// Handle has_pending_reflections filter
		// Returns students who have ANY outstanding reflections (for sessions up to their current_session)
		if (hasPendingReflections) {
			// Get the cohort's module
			const { data: cohort } = await supabaseAdmin
				.from('courses_cohorts')
				.select('module_id')
				.eq('id', cohortId)
				.single();

			if (cohort) {
				// Get ALL sessions with reflection questions for this module
				const { data: sessionsWithQuestions } = await supabaseAdmin
					.from('courses_sessions')
					.select(`
						id,
						session_number,
						courses_reflection_questions (id)
					`)
					.eq('module_id', cohort.module_id)
					.not('courses_reflection_questions', 'is', null);

				// Filter to only sessions that actually have questions
				const sessionsWithReflections = (sessionsWithQuestions || []).filter(
					s => s.courses_reflection_questions && s.courses_reflection_questions.length > 0
				);

				if (sessionsWithReflections.length > 0) {
					// Get all question IDs
					const questionIds = sessionsWithReflections.flatMap(
						s => s.courses_reflection_questions.map((q: { id: string }) => q.id)
					);

					// Get all submitted responses for these questions
					const { data: submittedResponses } = await supabaseAdmin
						.from('courses_reflection_responses')
						.select('enrollment_id, question_id')
						.in('question_id', questionIds);

					// Build a map of enrollment -> submitted question IDs
					const submissionsByEnrollment = new Map<string, Set<string>>();
					(submittedResponses || []).forEach(r => {
						if (!submissionsByEnrollment.has(r.enrollment_id)) {
							submissionsByEnrollment.set(r.enrollment_id, new Set());
						}
						submissionsByEnrollment.get(r.enrollment_id)!.add(r.question_id);
					});

					// Filter to students who are missing at least one reflection
					// that they should have completed (session_number <= their current_session)
					filteredEnrollments = filteredEnrollments.filter(enrollment => {
						const studentCurrentSession = enrollment.current_session || 1;
						const submittedQuestions = submissionsByEnrollment.get(enrollment.id) || new Set();

						// Check each session with a reflection
						for (const session of sessionsWithReflections) {
							// Only check sessions up to student's current session
							if (session.session_number <= studentCurrentSession) {
								// Check if they've submitted for this session's question(s)
								for (const question of session.courses_reflection_questions) {
									if (!submittedQuestions.has(question.id)) {
										// Missing at least one reflection
										return true;
									}
								}
							}
						}
						return false;
					});
				} else {
					// No sessions have reflections, so no one has pending reflections
					filteredEnrollments = [];
				}
			}
		}

		return json({
			enrollments: filteredEnrollments,
			count: filteredEnrollments.length
		});
	} catch (error) {
		console.error('GET /api/courses/[slug]/enrollments error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Internal server error' },
			{ status: 500 }
		);
	}
};
