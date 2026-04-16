/**
 * Admin Quiz Questions API
 *
 * POST   — add question to quiz
 * PUT    — update question
 * DELETE — delete question
 */

import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAnyModule } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { quiz_id, question_text, question_type, order_index, points, word_limit, image_url } = body;

	if (!quiz_id || !question_text || !question_type) {
		throw error(400, 'quiz_id, question_text, and question_type are required');
	}
	if (question_type !== 'multiple_choice' && question_type !== 'short_answer') {
		throw error(400, 'question_type must be "multiple_choice" or "short_answer"');
	}

	// Determine next order_index if not provided
	let nextOrder = order_index;
	if (nextOrder === undefined || nextOrder === null) {
		const { count } = await supabaseAdmin
			.from('courses_quiz_questions')
			.select('id', { count: 'exact', head: true })
			.eq('quiz_id', quiz_id);
		nextOrder = count ?? 0;
	}

	const { data, error: insertError } = await supabaseAdmin
		.from('courses_quiz_questions')
		.insert({
			quiz_id,
			question_text,
			question_type,
			order_index: nextOrder,
			points: points ?? 1,
			word_limit: word_limit ?? null,
			image_url: image_url ?? null
		})
		.select()
		.single();

	if (insertError) {
		console.error('Error creating question:', insertError);
		throw error(500, 'Failed to create question');
	}

	return json({ question: data }, { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { id, question_text, points, word_limit, image_url } = body;

	if (!id) throw error(400, 'id is required');

	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (question_text !== undefined) patch.question_text = question_text;
	if (points !== undefined) patch.points = points;
	if (word_limit !== undefined) patch.word_limit = word_limit;
	if (image_url !== undefined) patch.image_url = image_url;

	const { data, error: updateError } = await supabaseAdmin
		.from('courses_quiz_questions')
		.update(patch)
		.eq('id', id)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating question:', updateError);
		throw error(500, 'Failed to update question');
	}

	return json({ question: data });
};

export const DELETE: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { id } = body;

	if (!id) throw error(400, 'id is required');

	const { error: deleteError } = await supabaseAdmin
		.from('courses_quiz_questions')
		.delete()
		.eq('id', id);

	if (deleteError) {
		console.error('Error deleting question:', deleteError);
		throw error(500, 'Failed to delete question');
	}

	return json({ success: true });
};
