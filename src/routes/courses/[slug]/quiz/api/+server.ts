/**
 * Participant Quiz API
 *
 * GET  ?quiz_id=...               — get quiz definition + current attempt status
 * POST { action: 'start', quiz_id } — start a new attempt
 * PUT  { attempt_id, responses }   — submit attempt (auto-grades instant, queues qualitative)
 */

import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries } from '$lib/server/course-data.js';
import type { RequestHandler } from './$types';

async function getEnrollment(userId: string, courseSlug: string, cohortId?: string | null) {
	let query = supabaseAdmin
		.from('courses_enrollments')
		.select('id, cohort_id')
		.eq('user_profile_id', userId)
		.in('status', ['active', 'invited', 'accepted']);

	if (cohortId) query = query.eq('cohort_id', cohortId);

	const { data, error: err } = await query.order('created_at', { ascending: false }).limit(1);
	if (err || !data?.[0]) return null;
	return data[0];
}

export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAccess(event, courseSlug);

	const quizId = event.url.searchParams.get('quiz_id');
	if (!quizId) throw error(400, 'quiz_id is required');

	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : null;
	const enrollment = await getEnrollment(user.id, courseSlug, cohortId);
	if (!enrollment) throw error(403, 'Enrollment not found');

	// Fetch quiz with questions (no options — options only shown when taking the quiz)
	const { data: quiz, error: quizError } = await supabaseAdmin
		.from('courses_quizzes')
		.select(`
			id, mode, title, instructions, pass_threshold, allow_retakes,
			max_attempts, show_correct_answers, require_pass_to_advance,
			questions:courses_quiz_questions (
				id, question_text, question_type, order_index, points, word_limit, image_url,
				options:courses_quiz_options (id, option_text, order_index)
			)
		`)
		.eq('id', quizId)
		.eq('published', true)
		.single();

	if (quizError || !quiz) throw error(404, 'Quiz not found');

	// Sort questions and options
	quiz.questions.sort((a: any, b: any) => a.order_index - b.order_index);
	for (const q of quiz.questions as any[]) {
		if (q.options) q.options.sort((a: any, b: any) => a.order_index - b.order_index);
	}

	// Fetch attempts for this enrollment
	const { data: attempts } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select('id, attempt_number, status, score, points_earned, points_possible, overall_feedback, submitted_at, marked_at')
		.eq('quiz_id', quizId)
		.eq('enrollment_id', enrollment.id)
		.order('attempt_number', { ascending: false });

	return json({ quiz, attempts: attempts ?? [] });
};

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAccess(event, courseSlug);

	const body = await event.request.json();
	const { quiz_id } = body;
	if (!quiz_id) throw error(400, 'quiz_id is required');

	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : null;
	const enrollment = await getEnrollment(user.id, courseSlug, cohortId);
	if (!enrollment) throw error(403, 'Enrollment not found');

	// Fetch quiz to check retake policy (published only)
	const { data: quiz } = await supabaseAdmin
		.from('courses_quizzes')
		.select('id, mode, allow_retakes, max_attempts')
		.eq('id', quiz_id)
		.eq('published', true)
		.single();

	if (!quiz) throw error(404, 'Quiz not found');

	// Count existing submitted attempts
	const { count: attemptCount } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select('id', { count: 'exact', head: true })
		.eq('quiz_id', quiz_id)
		.eq('enrollment_id', enrollment.id)
		.neq('status', 'in_progress');

	const existingCount = attemptCount ?? 0;

	// Mode-agnostic attempt limit enforcement
	if (existingCount > 0) {
		if (!quiz.allow_retakes) {
			throw error(403, 'Retakes are not allowed for this quiz');
		}
		if (quiz.max_attempts !== null && existingCount >= quiz.max_attempts) {
			throw error(403, 'Maximum attempts reached');
		}
	}

	// Guard: quiz must have at least one question
	const { count: questionCount } = await supabaseAdmin
		.from('courses_quiz_questions')
		.select('id', { count: 'exact', head: true })
		.eq('quiz_id', quiz_id);
	if ((questionCount ?? 0) === 0) {
		throw error(400, 'This quiz has no questions yet');
	}

	// Check for any in_progress attempt and delete it (clean start)
	await supabaseAdmin
		.from('courses_quiz_attempts')
		.delete()
		.eq('quiz_id', quiz_id)
		.eq('enrollment_id', enrollment.id)
		.eq('status', 'in_progress');

	const { data: attempt, error: insertError } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.insert({
			quiz_id,
			enrollment_id: enrollment.id,
			cohort_id: enrollment.cohort_id,
			attempt_number: existingCount + 1,
			status: 'in_progress'
		})
		.select()
		.single();

	if (insertError) {
		console.error('Error creating attempt:', insertError);
		throw error(500, 'Failed to start attempt');
	}

	return json({ attempt }, { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAccess(event, courseSlug);

	const body = await event.request.json();
	const { attempt_id, responses } = body;

	if (!attempt_id || !Array.isArray(responses)) {
		throw error(400, 'attempt_id and responses are required');
	}

	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : null;
	const enrollment = await getEnrollment(user.id, courseSlug, cohortId);
	if (!enrollment) throw error(403, 'Enrollment not found');

	// Fetch attempt (verify ownership and state)
	const { data: attempt } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select('id, quiz_id, enrollment_id, status, attempt_number')
		.eq('id', attempt_id)
		.eq('enrollment_id', enrollment.id)
		.single();

	if (!attempt) throw error(404, 'Attempt not found');
	if (attempt.status !== 'in_progress') throw error(409, 'Attempt already submitted');

	// Fetch quiz and questions
	const { data: quiz } = await supabaseAdmin
		.from('courses_quizzes')
		.select(`
			id, mode, pass_threshold, show_correct_answers,
			questions:courses_quiz_questions (
				id, points,
				options:courses_quiz_options (id, option_text, is_correct)
			)
		`)
		.eq('id', attempt.quiz_id)
		.single();

	if (!quiz) throw error(404, 'Quiz not found');

	const now = new Date().toISOString();

	if (quiz.mode === 'instant') {
		// Auto-grade: evaluate each response against the correct option
		const questionMap = new Map<string, any>();
		for (const q of quiz.questions as any[]) {
			const correctOption = q.options.find((o: any) => o.is_correct);
			const optionTextMap = new Map((q.options as any[]).map((o: any) => [o.id, o.option_text]));
			questionMap.set(q.id, {
				points: q.points,
				correctOptionId: correctOption?.id ?? null,
				correctOptionText: correctOption?.option_text ?? null,
				optionTextMap
			});
		}

		let pointsEarned = 0;
		let pointsPossible = 0;

		const responseInserts = responses.map((r: any) => {
			const qInfo = questionMap.get(r.question_id);
			const isCorrect = qInfo ? r.selected_option_id === qInfo.correctOptionId : false;
			const pts = qInfo?.points ?? 1;
			pointsPossible += pts;
			if (isCorrect) pointsEarned += pts;

			const selectedText = r.selected_option_id ? qInfo?.optionTextMap?.get(r.selected_option_id) ?? null : null;
			return {
				attempt_id,
				question_id: r.question_id,
				selected_option_id: r.selected_option_id ?? null,
				selected_option_text: selectedText,
				correct_option_text: qInfo?.correctOptionText ?? null,
				is_correct: isCorrect,
				points_awarded: isCorrect ? pts : 0
			};
		});

		const score = pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 0;
		const passed = score >= (quiz.pass_threshold ?? 70);

		// Update attempt status atomically — only if still in_progress (guards concurrent submits)
		const { data: updatedAttempt } = await supabaseAdmin
			.from('courses_quiz_attempts')
			.update({
				status: passed ? 'passed' : 'failed',
				score,
				points_earned: pointsEarned,
				points_possible: pointsPossible,
				submitted_at: now,
				updated_at: now
			})
			.eq('id', attempt_id)
			.eq('status', 'in_progress')
			.select()
			.single();

		if (!updatedAttempt) throw error(409, 'Attempt already submitted');

		// Insert responses only after we've confirmed the status transition
		await supabaseAdmin.from('courses_quiz_responses').insert(responseInserts);

		// Build result with per-question detail
		const questionDetails = [];
		for (const r of responses) {
			const qInfo = questionMap.get(r.question_id);
			const isCorrect = qInfo ? r.selected_option_id === qInfo.correctOptionId : false;

			const selectedText = r.selected_option_id ? qInfo?.optionTextMap?.get(r.selected_option_id) ?? null : null;
			const detail: Record<string, unknown> = {
				question_id: r.question_id,
				selected_option_id: r.selected_option_id,
				selected_option_text: selectedText,
				is_correct: isCorrect
			};

			// Include correct answer if show_correct_answers is true
			if (quiz.show_correct_answers) {
				detail.correct_option_id = qInfo?.correctOptionId ?? null;
				detail.correct_option_text = qInfo?.correctOptionText ?? null;
			}

			questionDetails.push(detail);
		}

		return json({
			result: {
				status: passed ? 'passed' : 'failed',
				score,
				points_earned: pointsEarned,
				points_possible: pointsPossible,
				show_correct_answers: quiz.show_correct_answers,
				responses: questionDetails,
				attempt: updatedAttempt
			}
		});
	} else {
		// Qualitative: save responses and set to pending_review
		const responseInserts = responses.map((r: any) => ({
			attempt_id,
			question_id: r.question_id,
			response_text: r.response_text ?? null
		}));

		// Update atomically — only if still in_progress (guards concurrent submits)
		const { data: updatedAttempt } = await supabaseAdmin
			.from('courses_quiz_attempts')
			.update({
				status: 'pending_review',
				submitted_at: now,
				updated_at: now
			})
			.eq('id', attempt_id)
			.eq('status', 'in_progress')
			.select()
			.single();

		if (!updatedAttempt) throw error(409, 'Attempt already submitted');

		await supabaseAdmin.from('courses_quiz_responses').insert(responseInserts);

		return json({ result: { status: 'pending_review', attempt: updatedAttempt } });
	}
};
