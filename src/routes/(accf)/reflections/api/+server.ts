import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals: { supabase, getSession } }) => {
	const session = await getSession();

	if (!session) {
		throw error(401, 'Unauthorized');
	}

	try {
		const { action, reflection_question_id, content, is_public, status } = await request.json();

		// Validate required fields
		if (!reflection_question_id || !content?.trim()) {
			throw error(400, 'Missing required fields');
		}

		const userId = session.user.id;

		// Check if reflection response already exists
		const { data: existingResponse, error: checkError } = await supabase
			.from('reflection_responses')
			.select('*')
			.eq('user_id', userId)
			.eq('reflection_question_id', reflection_question_id)
			.single();

		let result;

		if (existingResponse) {
			// Update existing response
			const updates = {
				content: content.trim(),
				is_public: is_public || false,
				status: status || 'draft',
				updated_at: new Date().toISOString()
			};

			// If submitting (not just saving draft), add submitted_at timestamp
			if (status === 'submitted') {
				updates.submitted_at = new Date().toISOString();
				updates.status = 'submitted';
			}

			const { data: updatedResponse, error: updateError } = await supabase
				.from('reflection_responses')
				.update(updates)
				.eq('id', existingResponse.id)
				.select()
				.single();

			if (updateError) {
				console.error('Update error:', updateError);
				throw error(500, 'Failed to update reflection');
			}

			result = updatedResponse;
		} else {
			// Create new response
			const newResponse = {
				user_id: userId,
				reflection_question_id,
				content: content.trim(),
				is_public: is_public || false,
				status: status || 'draft',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			};

			// If submitting (not just saving draft), add submitted_at timestamp
			if (status === 'submitted') {
				newResponse.submitted_at = new Date().toISOString();
			}

			const { data: createdResponse, error: createError } = await supabase
				.from('reflection_responses')
				.insert(newResponse)
				.select()
				.single();

			if (createError) {
				console.error('Create error:', createError);
				throw error(500, 'Failed to save reflection');
			}

			result = createdResponse;
		}

		return json({
			success: true,
			data: result,
			message: status === 'submitted' ? 'Reflection submitted successfully' : 'Draft saved'
		});

	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};