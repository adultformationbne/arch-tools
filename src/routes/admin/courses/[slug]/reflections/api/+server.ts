import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	try {
		const body = await event.request.json();
		const { reflection_id, feedback, grade } = body;

		console.log('Marking reflection:', { reflection_id, feedback, grade });

		// Validate required fields
		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		if (!grade || !['pass', 'fail'].includes(grade)) {
			throw error(400, 'Valid grade (pass/fail) is required');
		}

		// Map grade to new enum status
		const newStatus = grade === 'pass' ? 'passed' : 'needs_revision';
		console.log('Mapped status:', newStatus);

		// Update reflection with marking details
		const updateData = {
			feedback: feedback?.trim() || null,
			status: newStatus,
			marked_at: new Date().toISOString(),
			marked_by: user.id,
			updated_at: new Date().toISOString()
		};

		console.log('Update data:', updateData);

		const { data: updatedReflection, error: updateError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.update(updateData)
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
