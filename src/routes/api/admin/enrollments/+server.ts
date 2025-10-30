import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireModule } from '$lib/server/auth';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// POST - Create new enrollment
export const POST: RequestHandler = async (event) => {
	const { user } = await requireModule(event, 'user_management');

	// Use admin client to bypass RLS
	const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	const { userId, cohortId, role } = await event.request.json();

	if (!userId || !cohortId || !role) {
		throw error(400, 'Missing required fields: userId, cohortId, role');
	}

	// Validate role
	if (!['student', 'admin', 'coordinator'].includes(role)) {
		throw error(400, 'Invalid role. Must be: student, admin, or coordinator');
	}

	// Check if enrollment already exists
	const { data: existing } = await supabaseAdmin
		.from('courses_enrollments')
		.select('id')
		.eq('user_profile_id', userId)
		.eq('cohort_id', cohortId)
		.single();

	if (existing) {
		throw error(409, 'User is already enrolled in this cohort');
	}

	// Create enrollment
	const { data, error: insertError } = await supabaseAdmin
		.from('courses_enrollments')
		.insert({
			user_profile_id: userId,
			cohort_id: cohortId,
			role: role
		})
		.select()
		.single();

	if (insertError) {
		console.error('Error creating enrollment:', insertError);
		throw error(500, 'Failed to create enrollment');
	}

	return json({ success: true, enrollment: data });
};

// PUT - Update enrollment role
export const PUT: RequestHandler = async (event) => {
	const { user } = await requireModule(event, 'user_management');

	// Use admin client to bypass RLS
	const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	const { enrollmentId, role } = await event.request.json();

	if (!enrollmentId || !role) {
		throw error(400, 'Missing required fields: enrollmentId, role');
	}

	// Validate role
	if (!['student', 'admin', 'coordinator'].includes(role)) {
		throw error(400, 'Invalid role. Must be: student, admin, or coordinator');
	}

	// Update enrollment
	const { data, error: updateError } = await supabaseAdmin
		.from('courses_enrollments')
		.update({ role })
		.eq('id', enrollmentId)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating enrollment:', updateError);
		throw error(500, 'Failed to update enrollment');
	}

	return json({ success: true, enrollment: data });
};

// DELETE - Remove enrollment
export const DELETE: RequestHandler = async (event) => {
	const { user } = await requireModule(event, 'user_management');

	// Use admin client to bypass RLS
	const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	const { enrollmentId } = await event.request.json();

	if (!enrollmentId) {
		throw error(400, 'Missing required field: enrollmentId');
	}

	// Delete enrollment
	const { error: deleteError } = await supabaseAdmin
		.from('courses_enrollments')
		.delete()
		.eq('id', enrollmentId);

	if (deleteError) {
		console.error('Error deleting enrollment:', deleteError);
		throw error(500, 'Failed to delete enrollment');
	}

	return json({ success: true });
};
