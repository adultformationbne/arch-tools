import { json, error } from '@sveltejs/kit';
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
		// Build update object with only provided fields
		const updateData: any = {
			updated_at: new Date().toISOString()
		};

		if (reflections_enabled !== undefined) {
			updateData.reflections_enabled = reflections_enabled;
		}

		if (description !== undefined) {
			updateData.description = description;
		}

		if (title !== undefined) {
			updateData.title = title;
		}

		const { data: session, error: updateError } = await supabaseAdmin
			.from('courses_sessions')
			.update(updateData)
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
