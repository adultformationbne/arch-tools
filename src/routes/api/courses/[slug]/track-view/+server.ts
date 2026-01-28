import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

/**
 * POST /api/courses/[slug]/track-view
 * Tracks page view for the authenticated user's enrollment in this course.
 * Returns the updated view count so we know if it's their first visit.
 */
export const POST: RequestHandler = async (event) => {
	try {
		const { session } = await event.locals.safeGetSession();

		if (!session?.user) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const userId = session.user.id;
		const courseSlug = event.params.slug;
		const now = new Date().toISOString();

		// Get the course ID from slug
		const { data: course } = await supabaseAdmin
			.from('courses')
			.select('id')
			.eq('slug', courseSlug)
			.single();

		if (!course) {
			return json({ error: 'Course not found' }, { status: 404 });
		}

		// Get user's enrollment for this course (via cohort)
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id,
				view_count,
				cohort:courses_cohorts!inner(
					module:courses_modules!inner(
						course_id
					)
				)
			`)
			.eq('user_profile_id', userId)
			.eq('cohort.module.course_id', course.id)
			.single();

		if (!enrollment) {
			return json({ error: 'Not enrolled in this course' }, { status: 403 });
		}

		const currentCount = enrollment.view_count || 0;
		const newCount = currentCount + 1;

		// Update the enrollment with new view count
		const { error: updateError } = await supabaseAdmin
			.from('courses_enrollments')
			.update({
				last_viewed_at: now,
				view_count: newCount
			})
			.eq('id', enrollment.id);

		if (updateError) {
			console.error('Error updating view count:', updateError);
			return json({ error: 'Failed to track view' }, { status: 500 });
		}

		return json({
			success: true,
			viewCount: newCount,
			isFirstView: newCount === 1
		});
	} catch (error) {
		console.error('Track view error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
