import { error, redirect } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries } from '$lib/server/course-data.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;
	const quizId = event.params.quizId;

	const { user } = await requireCourseAccess(event, courseSlug);

	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const courseSettings = getCourseSettings(course?.settings);
	if (courseSettings.features?.quizzesEnabled === false) throw error(404, 'Not found');
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : null;

	// Fetch quiz with questions and options
	const { data: quiz, error: quizError } = await supabaseAdmin
		.from('courses_quizzes')
		.select(`
			id, mode, title, instructions, pass_threshold, allow_retakes,
			max_attempts, show_correct_answers, require_pass_to_advance,
			session:session_id (
				id, session_number, title,
				module:module_id (
					course:course_id (slug)
				)
			),
			questions:courses_quiz_questions (
				id, question_text, question_type, order_index, points, word_limit, image_url,
				options:courses_quiz_options (id, option_text, order_index)
			)
		`)
		.eq('id', quizId)
		.eq('published', true)
		.single();

	if (quizError || !quiz) throw error(404, 'Quiz not found');

	// Verify quiz belongs to this course
	if ((quiz.session as any)?.module?.course?.slug !== courseSlug) {
		throw error(403, 'Quiz does not belong to this course');
	}

	// Sort questions and options
	const questions = (quiz.questions as any[])
		.sort((a, b) => a.order_index - b.order_index)
		.map(q => ({
			...q,
			options: q.options ? [...q.options].sort((a: any, b: any) => a.order_index - b.order_index) : []
		}));

	// Get enrollment
	let enrollmentQuery = supabaseAdmin
		.from('courses_enrollments')
		.select('id, cohort_id')
		.eq('user_profile_id', user.id)
		.in('status', ['active', 'invited', 'accepted']);
	if (cohortId) enrollmentQuery = enrollmentQuery.eq('cohort_id', cohortId);
	const { data: enrollments } = await enrollmentQuery.order('created_at', { ascending: false }).limit(1);
	const enrollment = enrollments?.[0];
	if (!enrollment) throw error(403, 'Enrollment not found');

	// Get all attempts for this quiz+enrollment
	const { data: attempts } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select(`
			id, attempt_number, status, score, points_earned, points_possible,
			overall_feedback, submitted_at, marked_at,
			responses:courses_quiz_responses (
				id, question_id, selected_option_id, response_text,
				is_correct, points_awarded, feedback
			)
		`)
		.eq('quiz_id', quizId)
		.eq('enrollment_id', enrollment.id)
		.order('attempt_number', { ascending: false });

	const session = quiz.session as any;

	return {
		quiz: { ...quiz, questions },
		attempts: attempts ?? [],
		enrollment,
		courseSlug,
		sessionNumber: session?.session_number ?? 0,
		sessionTitle: session?.title ?? null
	};
};
