import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;
	const questionId = event.params.questionId;

	// Require user to be enrolled in this course
	const { user } = await requireCourseAccess(event, courseSlug);

	try {
		// Get the reflection question
		const { data: questionData, error: questionError } = await supabaseAdmin
			.from('courses_reflection_questions')
			.select(`
				id,
				question_text,
				courses_sessions!inner (
					session_number,
					courses_modules!inner (
						courses!inner (
							slug
						)
					)
				)
			`)
			.eq('id', questionId)
			.single();

		if (questionError || !questionData) {
			throw error(404, 'Reflection question not found');
		}

		// Verify the question belongs to this course
		const questionCourseSlug = questionData.courses_sessions?.courses_modules?.courses?.slug;
		if (questionCourseSlug !== courseSlug) {
			throw error(403, 'This reflection question does not belong to this course');
		}

		// Get user's enrollment to check for existing reflection
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id')
			.eq('user_profile_id', user.id)
			.single();

		if (!enrollment) {
			throw error(404, 'Enrollment not found');
		}

		// Check for existing reflection
		const { data: existingReflection } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select('*')
			.eq('enrollment_id', enrollment.id)
			.eq('question_id', questionId)
			.maybeSingle();

		// Determine if the reflection is editable
		// Allow editing if:
		// - No reflection exists (new)
		// - Status is 'draft'
		// - Status is 'submitted' AND hasn't been reviewed yet (marked_by is null)
		// - Status is 'needs_revision' (instructor requested changes)
		const isEditable = !existingReflection ||
			existingReflection.status === 'draft' ||
			(existingReflection.status === 'submitted' && !existingReflection.marked_by) ||
			existingReflection.status === 'needs_revision';

		return {
			question: questionData.question_text,
			questionId: questionData.id,
			courseSlug,
			existingReflection,
			isEditable
		};
	} catch (err) {
		console.error('Error loading reflection write page:', err);
		throw error(500, 'Failed to load reflection data');
	}
};
