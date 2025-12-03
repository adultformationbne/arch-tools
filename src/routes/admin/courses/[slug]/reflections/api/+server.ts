/**
 * Admin Reflections API
 *
 * Endpoints:
 * - POST: Claim a reflection for review (prevents concurrent marking)
 * - PUT: Mark a reflection as passed/needs_revision
 * - DELETE: Release a claim on a reflection
 *
 * Claim System:
 * - When opening modal, POST to claim the reflection
 * - Claims expire after 5 minutes of inactivity
 * - On submit (PUT), claim is automatically released
 * - On cancel, DELETE to release the claim
 */

import { error, json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth.js';
import { CourseMutations } from '$lib/server/course-data.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { RequestHandler } from './$types';

// Claim expiry time in minutes
const CLAIM_EXPIRY_MINUTES = 5;

/**
 * POST: Claim a reflection for review
 * Prevents multiple people from marking the same reflection simultaneously
 */
export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user, profile } = await requireCourseAdmin(event, courseSlug);

	try {
		const body = await event.request.json();
		const { reflection_id } = body;

		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		// Check if reflection exists and get current claim status
		const { data: reflection, error: fetchError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select('id, reviewing_by, reviewing_started_at, status, marked_by')
			.eq('id', reflection_id)
			.single();

		if (fetchError || !reflection) {
			throw error(404, 'Reflection not found');
		}

		// Check if already marked
		if (reflection.status === 'passed' || reflection.status === 'needs_revision') {
			// Allow original marker to edit their own marking
			if (reflection.marked_by === user.id) {
				// Skip claim process for editing own marking - just open modal
				return json({
					success: true,
					isEdit: true,
					message: 'Opening for edit'
				});
			}
			// Block others from editing
			return json({
				success: false,
				alreadyMarked: true,
				message: 'This reflection has already been marked'
			});
		}

		// Check if someone else has an active claim
		const fiveMinutesAgo = new Date(Date.now() - CLAIM_EXPIRY_MINUTES * 60 * 1000);

		if (reflection.reviewing_by && reflection.reviewing_by !== user.id) {
			const claimTime = reflection.reviewing_started_at
				? new Date(reflection.reviewing_started_at)
				: new Date(0);

			// If claim is still fresh (not expired)
			if (claimTime > fiveMinutesAgo) {
				// Get reviewer name
				const { data: reviewer } = await supabaseAdmin
					.from('user_profiles')
					.select('full_name')
					.eq('id', reflection.reviewing_by)
					.single();

				return json({
					success: false,
					claimed: true,
					claimedBy: reviewer?.full_name || 'Another user',
					claimedAt: reflection.reviewing_started_at,
					message: `This reflection is being reviewed by ${reviewer?.full_name || 'another user'}`
				});
			}
		}

		// Claim the reflection
		const { error: claimError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				reviewing_by: user.id,
				reviewing_started_at: new Date().toISOString()
			})
			.eq('id', reflection_id);

		if (claimError) {
			console.error('Error claiming reflection:', claimError);
			throw error(500, 'Failed to claim reflection');
		}

		return json({
			success: true,
			message: 'Reflection claimed for review'
		});
	} catch (err: any) {
		console.error('Claim error:', err);
		if (err?.status) throw err;
		throw error(500, 'Internal server error');
	}
};

/**
 * PUT: Mark a reflection as passed/needs_revision
 */
export const PUT: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	try {
		const body = await event.request.json();
		const { reflection_id, feedback, grade } = body;

		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		if (!grade || !['pass', 'fail'].includes(grade)) {
			throw error(400, 'Valid grade (pass/fail) is required');
		}

		// Check if reflection was already marked by someone else
		const { data: current } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select('status, marked_by, reviewing_by')
			.eq('id', reflection_id)
			.single();

		if (current?.status === 'passed' || current?.status === 'needs_revision') {
			// Already marked - check if by same user (allowing re-edit)
			if (current.marked_by !== user.id) {
				const { data: marker } = await supabaseAdmin
					.from('user_profiles')
					.select('full_name')
					.eq('id', current.marked_by)
					.single();

				return json({
					success: false,
					alreadyMarked: true,
					markedBy: marker?.full_name || 'Another user',
					message: `This reflection was already marked by ${marker?.full_name || 'another user'}`
				});
			}
		}

		// Mark reflection using repository mutation
		const result = await CourseMutations.markReflection(
			reflection_id,
			grade,
			feedback?.trim() || '',
			user.id
		);

		if (result.error) {
			console.error('Error marking reflection:', result.error);
			throw error(500, 'Failed to mark reflection');
		}

		// Clear the review claim
		await supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				reviewing_by: null,
				reviewing_started_at: null
			})
			.eq('id', reflection_id);

		return json({
			success: true,
			data: result.data,
			message: grade === 'pass' ? 'Reflection marked as passed' : 'Reflection marked as needs revision'
		});
	} catch (err: any) {
		console.error('API error:', err);
		if (err?.status) throw err;
		throw error(500, 'Internal server error');
	}
};

/**
 * DELETE: Release a claim on a reflection (when closing modal without marking)
 */
export const DELETE: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	try {
		const reflection_id = event.url.searchParams.get('reflection_id');

		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		// Only release if current user owns the claim
		const { error: updateError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				reviewing_by: null,
				reviewing_started_at: null
			})
			.eq('id', reflection_id)
			.eq('reviewing_by', user.id); // Only clear own claims

		if (updateError) {
			console.error('Error releasing claim:', updateError);
			throw error(500, 'Failed to release claim');
		}

		return json({
			success: true,
			message: 'Claim released'
		});
	} catch (err: any) {
		console.error('Release claim error:', err);
		if (err?.status) throw err;
		throw error(500, 'Internal server error');
	}
};
