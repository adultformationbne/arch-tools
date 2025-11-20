/**
 * Admin Reflections API - PUT Handler
 *
 * Marks student reflections as passed/needs_revision with optional feedback.
 * Uses CourseMutations.markReflection() for database updates.
 *
 * Request body:
 * - reflection_id: string (required)
 * - grade: 'pass' | 'fail' (required)
 * - feedback: string (optional)
 *
 * Response:
 * - success: boolean
 * - data: updated reflection object
 * - message: status message
 */

import { error, json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth.js';
import { CourseMutations } from '$lib/server/course-data.js';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

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

		return json({
			success: true,
			data: result.data,
			message: grade === 'pass' ? 'Reflection marked as passed' : 'Reflection marked as needs revision'
		});
	} catch (err) {
		console.error('API error:', err);

		// Re-throw SvelteKit errors (they have status codes)
		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
