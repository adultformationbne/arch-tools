/**
 * Admin Quiz Options API (for multiple choice questions)
 *
 * POST   — add option to question
 * PUT    — update option text or correct answer
 * DELETE — delete option
 */

import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAnyModule } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { question_id, option_text, is_correct, order_index } = body;

	if (!question_id || !option_text) {
		throw error(400, 'question_id and option_text are required');
	}

	// Determine next order_index if not provided
	let nextOrder = order_index;
	if (nextOrder === undefined || nextOrder === null) {
		const { count } = await supabaseAdmin
			.from('courses_quiz_options')
			.select('id', { count: 'exact', head: true })
			.eq('question_id', question_id);
		nextOrder = count ?? 0;
	}

	const { data, error: insertError } = await supabaseAdmin
		.from('courses_quiz_options')
		.insert({
			question_id,
			option_text,
			is_correct: is_correct ?? false,
			order_index: nextOrder
		})
		.select()
		.single();

	if (insertError) {
		console.error('Error creating option:', insertError);
		throw error(500, 'Failed to create option');
	}

	return json({ option: data }, { status: 201 });
};

export const PUT: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { id, option_text, is_correct, order_index, correct_option_id, question_id } = body;

	// Special case: set correct answer for a question (clears all others first)
	if (correct_option_id && question_id) {
		// Clear all is_correct flags for this question
		await supabaseAdmin
			.from('courses_quiz_options')
			.update({ is_correct: false })
			.eq('question_id', question_id);

		// Set the correct one
		const { data, error: updateError } = await supabaseAdmin
			.from('courses_quiz_options')
			.update({ is_correct: true })
			.eq('id', correct_option_id)
			.select()
			.single();

		if (updateError) {
			throw error(500, 'Failed to set correct answer');
		}
		return json({ option: data });
	}

	if (!id) throw error(400, 'id is required');

	const patch: Record<string, unknown> = {};
	if (option_text !== undefined) patch.option_text = option_text;
	if (is_correct !== undefined) patch.is_correct = is_correct;
	if (order_index !== undefined) patch.order_index = order_index;

	const { data, error: updateError } = await supabaseAdmin
		.from('courses_quiz_options')
		.update(patch)
		.eq('id', id)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating option:', updateError);
		throw error(500, 'Failed to update option');
	}

	return json({ option: data });
};

export const DELETE: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { id } = body;

	if (!id) throw error(400, 'id is required');

	const { error: deleteError } = await supabaseAdmin
		.from('courses_quiz_options')
		.delete()
		.eq('id', id);

	if (deleteError) {
		console.error('Error deleting option:', deleteError);
		throw error(500, 'Failed to delete option');
	}

	return json({ success: true });
};
