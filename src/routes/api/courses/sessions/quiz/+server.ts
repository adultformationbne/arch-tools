/**
 * Admin Quiz Management API
 *
 * GET    ?session_id=...  — fetch quiz for a session
 * POST                    — create quiz for a session
 * PUT                     — update quiz settings
 * DELETE                  — delete quiz (with confirmation if attempts exist)
 */

import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAnyModule } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const sessionId = event.url.searchParams.get('session_id');
	if (!sessionId) {
		throw error(400, 'session_id is required');
	}

	const { data: quiz, error: quizError } = await supabaseAdmin
		.from('courses_quizzes')
		.select(`
			*,
			questions:courses_quiz_questions (
				*,
				options:courses_quiz_options (*)
			)
		`)
		.eq('session_id', sessionId)
		.maybeSingle();

	if (quizError) {
		console.error('Error fetching quiz:', quizError);
		throw error(500, 'Failed to fetch quiz');
	}

	if (quiz?.questions) {
		quiz.questions.sort((a: any, b: any) => a.order_index - b.order_index);
		for (const q of quiz.questions) {
			if (q.options) q.options.sort((a: any, b: any) => a.order_index - b.order_index);
		}
	}

	return json({ quiz: quiz ?? null });
};

export const POST: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { session_id, course_id, mode, title, instructions, pass_threshold, allow_retakes, max_attempts, show_correct_answers, require_pass_to_advance } = body;

	if (!session_id || !course_id || !mode) {
		throw error(400, 'session_id, course_id, and mode are required');
	}
	if (mode !== 'instant' && mode !== 'qualitative') {
		throw error(400, 'mode must be "instant" or "qualitative"');
	}

	const { data, error: insertError } = await supabaseAdmin
		.from('courses_quizzes')
		.insert({
			session_id,
			course_id,
			mode,
			title: title || null,
			instructions: instructions || null,
			pass_threshold: mode === 'instant' ? (pass_threshold ?? 70) : null,
			allow_retakes: mode === 'instant' ? (allow_retakes ?? false) : false,
			max_attempts: mode === 'instant' ? (max_attempts ?? null) : null,
			show_correct_answers: mode === 'instant' ? (show_correct_answers ?? true) : false,
			require_pass_to_advance: require_pass_to_advance ?? false
		})
		.select()
		.single();

	if (insertError) {
		console.error('Error creating quiz:', insertError);
		throw error(500, 'Failed to create quiz');
	}

	return json({ quiz: data }, { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { id, ...updates } = body;

	if (!id) throw error(400, 'id is required');

	const allowed = ['title', 'instructions', 'pass_threshold', 'allow_retakes', 'max_attempts', 'show_correct_answers', 'require_pass_to_advance', 'published', 'quiz_feedback_snippets'];
	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	for (const key of allowed) {
		if (key in updates) patch[key] = updates[key];
	}

	const { data, error: updateError } = await supabaseAdmin
		.from('courses_quizzes')
		.update(patch)
		.eq('id', id)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating quiz:', updateError);
		throw error(500, 'Failed to update quiz');
	}

	return json({ quiz: data });
};

export const DELETE: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { id, confirm } = body;

	if (!id) throw error(400, 'id is required');

	// Check if any submitted attempts exist
	const { count, error: countError } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select('id', { count: 'exact', head: true })
		.eq('quiz_id', id)
		.neq('status', 'in_progress');

	if (countError) {
		throw error(500, 'Failed to check existing attempts');
	}

	if ((count ?? 0) > 0 && !confirm) {
		return json({ needs_confirmation: true, attempt_count: count });
	}

	const { error: deleteError } = await supabaseAdmin
		.from('courses_quizzes')
		.delete()
		.eq('id', id);

	if (deleteError) {
		console.error('Error deleting quiz:', deleteError);
		throw error(500, 'Failed to delete quiz');
	}

	return json({ success: true });
};
