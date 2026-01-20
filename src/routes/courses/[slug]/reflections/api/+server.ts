import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries } from '$lib/server/course-data.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;

	// Require authenticated user
	const { user } = await requireCourseAccess(event, courseSlug);
	const userId = user.id;

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	try {
		const body = await event.request.json();

		const { action, reflection_question_id, content, is_public, status } = body;

		// Validate required fields
		if (!reflection_question_id || !content?.trim()) {
			console.error('Validation failed:', { reflection_question_id, contentLength: content?.trim().length });
			throw error(400, 'Missing required fields');
		}

		// Get question details to extract session info
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


		if (questionError || !questionData) {
			console.error('Question lookup error:', questionError);
			throw error(400, 'Invalid reflection question');
		}

		// Get student's courses_enrollments record (need id and cohort_id)
		// Use the cohort cookie if available to select the correct enrollment
		let enrollmentQuery = supabaseAdmin
			.from('courses_enrollments')
			.select('id, cohort_id')
			.eq('user_profile_id', userId)
			.in('status', ['active', 'invited', 'accepted']);

		if (cohortId) {
			enrollmentQuery = enrollmentQuery.eq('cohort_id', cohortId);
		}

		const { data: studentDataArr, error: studentError } = await enrollmentQuery
			.order('created_at', { ascending: false })
			.limit(1);

		const studentData = studentDataArr?.[0] || null;


		if (studentError || !studentData) {
			console.error('Student lookup error:', studentError);
			throw error(400, 'Student enrollment not found');
		}

		// Check existing reflection to enforce status transition rules
		const { data: existingReflection } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select('id, status, marked_by')
			.eq('enrollment_id', studentData.id)
			.eq('question_id', reflection_question_id)
			.maybeSingle();

		// Validate status - only allow valid student-submittable statuses
		const validStatuses = ['draft', 'submitted', 'resubmitted'];
		let finalStatus = validStatuses.includes(status) ? status : 'submitted';

		// Enforce status transition rules to prevent race conditions and invalid states
		if (existingReflection) {
			const currentStatus = existingReflection.status;

			// If already passed or under_review, student can't modify
			if (['passed', 'under_review'].includes(currentStatus)) {
				throw error(403, 'This reflection has been reviewed and cannot be modified');
			}

			// If submitted (not yet reviewed), student can't downgrade to draft
			if (currentStatus === 'submitted' && !existingReflection.marked_by && finalStatus === 'draft') {
				// Allow auto-save to preserve content without changing status
				finalStatus = 'submitted';
			}

			// If needs_revision, only allow resubmitted (not draft downgrade)
			if (currentStatus === 'needs_revision' && finalStatus === 'draft') {
				// Auto-save while editing needs_revision - keep status as needs_revision
				finalStatus = 'needs_revision';
			}

			// If resubmitted (awaiting re-review), don't allow changes
			if (currentStatus === 'resubmitted' && finalStatus === 'draft') {
				finalStatus = 'resubmitted';
			}
		}

		const responseData = {
			enrollment_id: studentData.id,
			cohort_id: studentData.cohort_id,
			question_id: reflection_question_id,
			// session_number removed - obtained via question_id -> session_id -> session.session_number
			response_text: content.trim(),
			is_public: is_public || false,
			status: finalStatus,
			updated_at: new Date().toISOString()
		};


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


		if (upsertError) {
			console.error('Upsert error:', upsertError);
			throw error(500, 'Failed to save reflection');
		}

		// Log activity for submissions (not drafts)
		if (finalStatus === 'submitted' || finalStatus === 'resubmitted') {
			// Get student name for activity log
			const { data: profile } = await supabaseAdmin
				.from('user_profiles')
				.select('full_name')
				.eq('id', userId)
				.single();

			const studentName = profile?.full_name || 'Student';
			await supabaseAdmin.from('courses_activity_log').insert({
				cohort_id: studentData.cohort_id,
				enrollment_id: studentData.id,
				activity_type: finalStatus === 'resubmitted' ? 'reflection_resubmitted' : 'reflection_submitted',
				actor_name: studentName,
				description: `${studentName} ${finalStatus === 'resubmitted' ? 'resubmitted' : 'submitted'} reflection for Session ${questionData.courses_sessions.session_number}`,
				metadata: {
					session_number: questionData.courses_sessions.session_number,
					question_id: reflection_question_id
				}
			});
		}

		const message = finalStatus === 'draft'
			? 'Draft saved'
			: finalStatus === 'resubmitted'
				? 'Reflection resubmitted successfully'
				: 'Reflection submitted successfully';

		return json({
			success: true,
			data: result,
			message
		});

	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
