import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCoursesUser } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
	// Require ACCF admin authentication
	const { user } = await requireCoursesUser(event);
	// TODO: Add admin role check here when role system is implemented

	try {
		const body = await event.request.json();
		const { reflection_id, feedback, grade } = body;

		// Validate required fields
		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		if (!grade || !['pass', 'fail'].includes(grade)) {
			throw error(400, 'Valid grade (pass/fail) is required');
		}

		// Map grade to new enum status
		const newStatus = grade === 'pass' ? 'passed' : 'needs_revision';

		// Update reflection with marking details
		const { data: updatedReflection, error: updateError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				feedback: feedback?.trim() || null,
				status: newStatus,
				marked_at: new Date().toISOString(),
				marked_by: user.id,
				updated_at: new Date().toISOString()
			})
			.eq('id', reflection_id)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating reflection:', updateError);
			throw error(500, 'Failed to mark reflection');
		}

		return json({
			success: true,
			data: updatedReflection,
			message: grade === 'pass' ? 'Reflection marked as passed' : 'Reflection marked as needs revision'
		});

	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
