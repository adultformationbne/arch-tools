/**
 * Admin Quiz Questions Reorder API
 *
 * PATCH — reorder questions by providing ordered array of IDs
 */

import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAnyModule } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const body = await event.request.json();
	const { ordered_ids } = body;

	if (!Array.isArray(ordered_ids) || ordered_ids.length === 0) {
		throw error(400, 'ordered_ids array is required');
	}

	// Update each question's order_index based on its position in the array
	const updates = ordered_ids.map((id: string, index: number) =>
		supabaseAdmin
			.from('courses_quiz_questions')
			.update({ order_index: index, updated_at: new Date().toISOString() })
			.eq('id', id)
	);

	const results = await Promise.all(updates);
	const failed = results.find(r => r.error);
	if (failed?.error) {
		console.error('Error reordering questions:', failed.error);
		throw error(500, 'Failed to reorder questions');
	}

	return json({ success: true });
};
