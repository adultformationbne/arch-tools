import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCoursesUser } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	console.log('=== API ENDPOINT HIT ===');

	// Require ACCF user authentication
	const { user } = await requireCoursesUser(event);
	console.log('Authenticated user:', { id: user.id, email: user.email });

	// Check for dev mode user
	const { getDevUserFromRequest } = await import('$lib/server/dev-user.js');
	const devUser = getDevUserFromRequest(event.request);
	const isDevMode = process.env.NODE_ENV === 'development' && devUser;

	// Use dev user ID if in dev mode, otherwise use authenticated user ID
	const userId = isDevMode ? devUser.id : user.id;
	console.log('Using userId for reflection:', userId, isDevMode ? '(dev mode)' : '(real user)');

	try {
		const body = await event.request.json();
		console.log('Request body:', body);

		const { action, reflection_question_id, content, is_public, status } = body;

		// Validate required fields
		if (!reflection_question_id || !content?.trim()) {
			console.error('Validation failed:', { reflection_question_id, contentLength: content?.trim().length });
			throw error(400, 'Missing required fields');
		}

		// Get question details to extract session info
		console.log('Looking up question:', reflection_question_id);
		const { data: questionData, error: questionError } = await supabaseAdmin
			.from('courses_reflection_questions')
			.select(`
				id,
				session_id,
				courses_sessions!inner (
					id,
					session_number,
					module_id
				)
			`)
			.eq('id', reflection_question_id)
			.single();

		console.log('Question data:', questionData);
		console.log('Question error:', questionError);

		if (questionError || !questionData) {
			console.error('Question lookup error:', questionError);
			throw error(400, 'Invalid reflection question');
		}

		// Get student's courses_users record (need id and cohort_id)
		console.log('Looking up student by user_profile_id:', userId);
		const { data: studentData, error: studentError } = await supabaseAdmin
			.from('courses_users')
			.select('id, cohort_id')
			.eq('user_profile_id', userId)
			.single();

		console.log('Student data:', studentData);
		console.log('Student error:', studentError);

		if (studentError || !studentData) {
			console.error('Student lookup error:', studentError);
			throw error(400, 'Student enrollment not found');
		}

		// Check if reflection response already exists
		console.log('Checking for existing response...');
		const { data: existingResponse, error: checkError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select('*')
			.eq('accf_user_id', studentData.id)
			.eq('question_id', reflection_question_id)
			.maybeSingle();

		console.log('Existing response:', existingResponse);
		console.log('Check error:', checkError);

		let result;

		if (existingResponse) {
			console.log('Updating existing response...');
			// Update existing response
			const updates = {
				response_text: content.trim(),
				is_public: is_public || false,
				status: status === 'draft' ? 'draft' : 'submitted',
				updated_at: new Date().toISOString()
			};

			console.log('Update payload:', updates);

			// Note: marked_at is only set by admin when marking, not on submission
			// Status stays 'submitted' until admin changes to 'passed' or 'needs_revision'

			const { data: updatedResponse, error: updateError } = await supabaseAdmin
				.from('courses_reflection_responses')
				.update(updates)
				.eq('id', existingResponse.id)
				.select()
				.single();

			console.log('Updated response:', updatedResponse);
			console.log('Update error:', updateError);

			if (updateError) {
				console.error('Update error:', updateError);
				throw error(500, 'Failed to update reflection');
			}

			result = updatedResponse;
		} else {
			console.log('Creating new response...');
			// Create new response with all required fields
			const newResponse = {
				accf_user_id: studentData.id,
				cohort_id: studentData.cohort_id,
				question_id: reflection_question_id,
				session_id: questionData.session_id, // Use session_id from question
				session_number: questionData.courses_sessions.session_number, // Keep session_number for convenience
				response_text: content.trim(),
				is_public: is_public || false,
				status: status === 'draft' ? 'draft' : 'submitted',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			};

			console.log('Insert payload:', newResponse);

			const { data: createdResponse, error: createError } = await supabaseAdmin
				.from('courses_reflection_responses')
				.insert(newResponse)
				.select()
				.single();

			console.log('Created response:', createdResponse);
			console.log('Create error:', createError);

			if (createError) {
				console.error('Create error:', createError);
				throw error(500, 'Failed to save reflection');
			}

			result = createdResponse;
		}

		console.log('Returning success response');
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