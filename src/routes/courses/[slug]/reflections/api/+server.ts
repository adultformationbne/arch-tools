import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;

	// Require authenticated user
	const { user } = await requireCourseAccess(event, courseSlug);
	const userId = user.id;

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

		// Get student's courses_enrollments record (need id and cohort_id)
		console.log('Looking up student by user_profile_id:', userId);
		const { data: studentData, error: studentError } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, cohort_id')
			.eq('user_profile_id', userId)
			.single();

		console.log('Student data:', studentData);
		console.log('Student error:', studentError);

		if (studentError || !studentData) {
			console.error('Student lookup error:', studentError);
			throw error(400, 'Student enrollment not found');
		}

		// Use upsert to avoid race conditions when multiple requests happen simultaneously
		console.log('Upserting reflection response...');
		const responseData = {
			enrollment_id: studentData.id,
			cohort_id: studentData.cohort_id,
			question_id: reflection_question_id,
			// session_number removed - obtained via question_id -> session_id -> session.session_number
			response_text: content.trim(),
			is_public: is_public || false,
			status: status === 'draft' ? 'draft' : 'submitted',
			updated_at: new Date().toISOString()
		};

		console.log('Upsert payload:', responseData);

		// Upsert will insert or update based on the unique constraint (enrollment_id, question_id)
		// Note: marked_at is only set by admin when marking, not on submission
		const { data: result, error: upsertError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.upsert(responseData, {
				onConflict: 'enrollment_id,question_id',
				ignoreDuplicates: false
			})
			.select()
			.single();

		console.log('Upsert result:', result);
		console.log('Upsert error:', upsertError);

		if (upsertError) {
			console.error('Upsert error:', upsertError);
			throw error(500, 'Failed to save reflection');
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
