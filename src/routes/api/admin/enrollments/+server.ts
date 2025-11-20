import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireModule } from '$lib/server/auth';
import { CourseMutations } from '$lib/server/course-data';

// POST - Create new enrollment
export const POST: RequestHandler = async (event) => {
	await requireModule(event, 'platform.admin');

	const { userId, cohortId, role } = await event.request.json();

	if (!userId || !cohortId || !role) {
		throw error(400, 'Missing required fields: userId, cohortId, role');
	}

	// Validate role (only participants - managers/admins are NOT enrolled)
	if (!['student', 'coordinator'].includes(role)) {
		throw error(400, 'Invalid role. Must be: student or coordinator');
	}

	// Create enrollment using repository
	const result = await CourseMutations.createEnrollment({
		userId,
		cohortId,
		role
	});

	if (result.error) {
		if (result.error.message === 'User is already enrolled in this cohort') {
			throw error(409, result.error.message);
		}
		if (result.error.message === 'User profile not found') {
			throw error(404, result.error.message);
		}
		console.error('Error creating enrollment:', result.error);
		throw error(500, 'Failed to create enrollment');
	}

	return json({ success: true, enrollment: result.data });
};

// PUT - Update enrollment role
export const PUT: RequestHandler = async (event) => {
	await requireModule(event, 'platform.admin');

	const { enrollmentId, role } = await event.request.json();

	if (!enrollmentId || !role) {
		throw error(400, 'Missing required fields: enrollmentId, role');
	}

	// Validate role (only participants - managers/admins are NOT enrolled)
	if (!['student', 'coordinator'].includes(role)) {
		throw error(400, 'Invalid role. Must be: student or coordinator');
	}

	// Update enrollment using repository
	const result = await CourseMutations.updateEnrollment({
		userId: enrollmentId,
		updates: { role }
	});

	if (result.error) {
		if (result.error.message === 'No valid updates provided') {
			throw error(400, result.error.message);
		}
		console.error('Error updating enrollment:', result.error);
		throw error(500, 'Failed to update enrollment');
	}

	if (!result.data) {
		throw error(404, 'Enrollment not found');
	}

	return json({ success: true, enrollment: result.data });
};

// DELETE - Remove enrollment
export const DELETE: RequestHandler = async (event) => {
	await requireModule(event, 'platform.admin');

	const { enrollmentId } = await event.request.json();

	if (!enrollmentId) {
		throw error(400, 'Missing required field: enrollmentId');
	}

	// Delete enrollment using repository
	const result = await CourseMutations.deleteEnrollment(enrollmentId);

	if (result.error) {
		if (result.error.message === 'Cannot delete user who has completed signup') {
			throw error(403, result.error.message);
		}
		console.error('Error deleting enrollment:', result.error);
		throw error(500, 'Failed to delete enrollment');
	}

	return json({ success: true });
};
