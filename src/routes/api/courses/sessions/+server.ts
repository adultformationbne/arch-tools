import { json, error } from '@sveltejs/kit';
import { CourseMutations } from '$lib/server/course-data.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAuth } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * GET /api/courses/sessions
 * Get session by module_id and session_number
 * Creates session if it doesn't exist
 */
export const GET: RequestHandler = async (event) => {
	await requireAuth(event);

	const moduleId = event.url.searchParams.get('module_id');
	const sessionNumber = event.url.searchParams.get('session_number');

	if (!moduleId || sessionNumber === null) {
		throw error(400, 'module_id and session_number are required');
	}

	try {
		const sessionNum = parseInt(sessionNumber);

		// Use upsert to avoid race conditions when multiple requests happen simultaneously
		const sessionTitle = sessionNum === 0 ? 'Pre-Start' : `Session ${sessionNum}`;
		const sessionData = {
			module_id: moduleId,
			session_number: sessionNum,
			title: sessionTitle,
			description: '',
			reflections_enabled: true
		};

		const { data: session, error: upsertError } = await supabaseAdmin
			.from('courses_sessions')
			.upsert(sessionData, {
				onConflict: 'module_id,session_number',
				ignoreDuplicates: false
			})
			.select()
			.single();

		if (upsertError) {
			console.error('Error creating/fetching session:', upsertError);
			throw error(500, 'Failed to fetch or create session');
		}

		return json({ session });
	} catch (err) {
		console.error('Error in GET /api/courses/sessions:', err);
		throw error(500, 'Failed to fetch or create session');
	}
};

/**
 * PUT /api/courses/sessions
 * Update session (including reflections_enabled and description)
 */
export const PUT: RequestHandler = async (event) => {
	await requireAuth(event);

	const { session_id, reflections_enabled, description, title } = await event.request.json();

	if (!session_id) {
		throw error(400, 'session_id is required');
	}

	try {
		const { data, error: updateError } = await CourseMutations.updateSession(session_id, {
			title,
			description,
			reflectionsEnabled: reflections_enabled
		});

		if (updateError) {
			console.error('Error updating session:', updateError);
			throw error(500, 'Failed to update session');
		}

		return json({ success: true, session: data });
	} catch (err) {
		console.error('Error in PUT /api/courses/sessions:', err);
		throw error(500, 'Failed to update session');
	}
};

/**
 * DELETE /api/courses/sessions
 * Delete a session and all its related data (materials, reflection questions)
 */
export const DELETE: RequestHandler = async (event) => {
	await requireAuth(event);

	const { session_id } = await event.request.json();

	if (!session_id) {
		throw error(400, 'session_id is required');
	}

	try {
		// Delete session (cascade will delete materials and reflection questions)
		const { error: deleteError } = await supabaseAdmin
			.from('courses_sessions')
			.delete()
			.eq('id', session_id);

		if (deleteError) {
			console.error('Error deleting session:', deleteError);
			throw error(500, 'Failed to delete session');
		}

		return json({ success: true });
	} catch (err) {
		console.error('Error in DELETE /api/courses/sessions:', err);
		throw error(500, 'Failed to delete session');
	}
};
