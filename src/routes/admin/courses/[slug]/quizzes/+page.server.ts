import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo || {};
	const courseId = courseInfo.id;
	const cohorts = layoutData?.cohorts || [];

	if (!courseId) throw error(404, 'Course not found');

	const { user } = await event.locals.safeGetSession();
	const { data: currentUserProfile } = await supabaseAdmin
		.from('user_profiles')
		.select('full_name')
		.eq('id', user.id)
		.single();

	// Fetch all quizzes for this course with question counts and settings
	const { data: quizzes } = await supabaseAdmin
		.from('courses_quizzes')
		.select(`
			id, mode, title, pass_threshold, require_pass_to_advance, published, quiz_feedback_snippets,
			session:session_id (
				id, session_number, title,
				module:module_id (
					course:course_id (id, slug)
				)
			),
			questions:courses_quiz_questions (id, question_text, order_index, image_url)
		`)
		.eq('course_id', courseId)
		.order('created_at');

	// Filter to quizzes belonging to this course
	const courseQuizzes = (quizzes ?? []).filter(
		q => (q.session as any)?.module?.course?.slug === courseSlug
	).map(q => ({
		...q,
		question_count: (q.questions as any[]).length,
		session_number: (q.session as any)?.session_number ?? 0,
		session_title: (q.session as any)?.title ?? null
	}));

	if (courseQuizzes.length === 0) {
		return {
			quizAttempts: [],
			quizzes: [],
			cohorts: [],
			courseSlug,
			currentUserId: user.id,
			currentUserName: currentUserProfile?.full_name ?? null
		};
	}

	const quizIds = courseQuizzes.map(q => q.id);

	// Fetch all attempts across all quizzes for this course
	const { data: allAttempts } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select(`
			id, quiz_id, attempt_number, status, score, points_earned, points_possible,
			overall_feedback, submitted_at, marked_at, reviewing_by, reviewing_started_at,
			enrollment:enrollment_id (
				id, full_name, email,
				hub:hub_id (name),
				cohort:cohort_id (id, name)
			),
			responses:courses_quiz_responses (
				id, question_id, response_text, selected_option_id,
				is_correct, points_awarded, feedback
			)
		`)
		.in('quiz_id', quizIds)
		.order('submitted_at', { ascending: false });

	// Add quiz info to each attempt
	const quizMap = new Map(courseQuizzes.map(q => [q.id, q]));
	const attemptsWithQuiz = (allAttempts ?? []).map(a => ({
		...a,
		quiz: quizMap.get(a.quiz_id) ?? null
	}));

	// Enrich each attempt with previous attempts from same enrollment+quiz
	const byEnrollmentQuiz = new Map<string, any[]>();
	for (const a of attemptsWithQuiz) {
		const key = `${(a.enrollment as any)?.id}::${a.quiz_id}`;
		if (!byEnrollmentQuiz.has(key)) byEnrollmentQuiz.set(key, []);
		byEnrollmentQuiz.get(key)!.push(a);
	}
	const enrichedAttempts = attemptsWithQuiz.map(a => {
		const key = `${(a.enrollment as any)?.id}::${a.quiz_id}`;
		const all = byEnrollmentQuiz.get(key) ?? [];
		return {
			...a,
			previous_attempts: all
				.filter(p => p.attempt_number < a.attempt_number)
				.sort((x, y) => x.attempt_number - y.attempt_number)
		};
	});

	// Compute per-question correct % for instant quizzes
	const questionStats: Record<string, { correctCount: number; totalCount: number }> = {};
	for (const a of attemptsWithQuiz) {
		const quiz = quizMap.get(a.quiz_id);
		if (quiz?.mode !== 'instant') continue;
		for (const r of (a.responses as any[]) ?? []) {
			if (!questionStats[r.question_id]) {
				questionStats[r.question_id] = { correctCount: 0, totalCount: 0 };
			}
			questionStats[r.question_id].totalCount++;
			if (r.is_correct) questionStats[r.question_id].correctCount++;
		}
	}

	return {
		quizAttempts: enrichedAttempts,
		quizzes: courseQuizzes,
		cohorts,
		courseSlug,
		currentUserId: user.id,
		currentUserName: currentUserProfile?.full_name ?? null,
		questionStats
	};
};
