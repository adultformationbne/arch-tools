import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAuth } from '$lib/server/auth';

/**
 * POST - Mark chat as read for a cohort
 * Upserts the read status with current timestamp
 */
export const POST: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const body = await event.request.json();
	const { cohort_id } = body;

	if (!cohort_id) {
		throw error(400, 'cohort_id is required');
	}

	const { error: upsertError } = await supabaseAdmin
		.from('courses_chat_read_status')
		.upsert(
			{
				cohort_id,
				user_id: user.id,
				last_read_at: new Date().toISOString()
			},
			{ onConflict: 'cohort_id,user_id' }
		);

	if (upsertError) {
		console.error('Read status upsert error:', upsertError);
		throw error(500, 'Failed to update read status');
	}

	return json({ success: true });
};
