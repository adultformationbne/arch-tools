import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAuth } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * GET /api/courses/sessions
 * Get session by module_id and session_number
 */
export const GET: RequestHandler = async (event) => {
	await requireAuth(event);

	const moduleId = event.url.searchParams.get('module_id');
	const sessionNumber = event.url.searchParams.get('session_number');

	if (!moduleId || sessionNumber === null) {
		throw error(400, 'module_id and session_number are required');
	}

	try {
		const { data: session, error: sessionError } = await supabaseAdmin
			.from('courses_sessions')
			.select('*')
			.eq('module_id', moduleId)
			.eq('session_number', parseInt(sessionNumber))
			.single();

		if (sessionError) {
			console.error('Error fetching session:', sessionError);
			throw error(500, 'Failed to fetch session');
		}

		return json({ session });
	} catch (err) {
		console.error('Error in GET /api/courses/sessions:', err);
		throw error(500, 'Failed to fetch session');
	}
};

/**
 * PUT /api/courses/sessions
 * Update session (including reflections_enabled)
 */
export const PUT: RequestHandler = async (event) => {
	await requireAuth(event);

	const { session_id, reflections_enabled } = await event.request.json();

	if (!session_id) {
		throw error(400, 'session_id is required');
	}

	try {
		const { data: session, error: updateError } = await supabaseAdmin
			.from('courses_sessions')
			.update({
				reflections_enabled,
				updated_at: new Date().toISOString()
			})
			.eq('id', session_id)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating session:', updateError);
			throw error(500, 'Failed to update session');
		}

		return json({ success: true, session });
	} catch (err) {
		console.error('Error in PUT /api/courses/sessions:', err);
		throw error(500, 'Failed to update session');
	}
};
