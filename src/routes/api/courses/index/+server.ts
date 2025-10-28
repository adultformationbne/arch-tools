import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { RequestHandler } from './$types';

/**
 * GET - List all courses with module counts
 */
export const GET: RequestHandler = async ({ locals: { safeGetSession, supabase } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user is admin
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (!profile || !['admin', 'admin'].includes(profile.role)) {
			throw error(403, 'Forbidden - Admin access required');
		}

		// Fetch all courses with module count and cohort count
		const { data: courses, error: coursesError } = await supabaseAdmin
			.from('courses')
			.select(`
				*,
				modules:courses_modules(count),
				cohorts:courses_cohorts(
					id,
					name,
					status,
					start_date,
					end_date,
					module:courses_modules(name)
				)
			`)
			.order('created_at', { ascending: false });

		if (coursesError) {
			console.error('Error fetching courses:', coursesError);
			throw error(500, 'Failed to fetch courses');
		}

		// Transform data for easier consumption
		const transformedCourses = courses?.map(course => ({
			...course,
			module_count: course.modules?.[0]?.count || 0,
			cohort_count: course.cohorts?.length || 0,
			active_cohorts: course.cohorts?.filter(c => c.status === 'active').length || 0
		}));

		return json({ courses: transformedCourses || [] });

	} catch (err) {
		console.error('API error:', err);
		if (err?.status) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};

/**
 * POST - Create a new course
 */
export const POST: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user is admin
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (!profile || !['admin', 'admin'].includes(profile.role)) {
			throw error(403, 'Forbidden - Admin access required');
		}

		const body = await request.json();
		const { name, short_name, description, duration_weeks, is_active, status, settings } = body;

		if (!name || !short_name) {
			throw error(400, 'Name and short_name are required');
		}

		const { data: course, error: createError } = await supabaseAdmin
			.from('courses')
			.insert({
				name,
				short_name,
				description,
				duration_weeks,
				is_active: is_active !== undefined ? is_active : true,
				status: status || 'draft',
				settings: settings || {}
			})
			.select()
			.single();

		if (createError) {
			console.error('Error creating course:', createError);
			throw error(500, 'Failed to create course');
		}

		return json({ course }, { status: 201 });

	} catch (err) {
		console.error('API error:', err);
		if (err?.status) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};

/**
 * PUT - Update a course
 */
export const PUT: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user is admin
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (!profile || !['admin', 'admin'].includes(profile.role)) {
			throw error(403, 'Forbidden - Admin access required');
		}

		const body = await request.json();
		const { id, name, short_name, description, duration_weeks, is_active, status, settings } = body;

		if (!id) {
			throw error(400, 'Course id is required');
		}

		const updates: any = { updated_at: new Date().toISOString() };
		if (name !== undefined) updates.name = name;
		if (short_name !== undefined) updates.short_name = short_name;
		if (description !== undefined) updates.description = description;
		if (duration_weeks !== undefined) updates.duration_weeks = duration_weeks;
		if (is_active !== undefined) updates.is_active = is_active;
		if (status !== undefined) updates.status = status;
		if (settings !== undefined) updates.settings = settings;

		const { data: course, error: updateError } = await supabaseAdmin
			.from('courses')
			.update(updates)
			.eq('id', id)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating course:', updateError);
			throw error(500, 'Failed to update course');
		}

		return json({ course });

	} catch (err) {
		console.error('API error:', err);
		if (err?.status) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};

/**
 * DELETE - Archive a course (soft delete)
 */
export const DELETE: RequestHandler = async ({ url, locals: { safeGetSession, supabase } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user is admin
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (!profile || !['admin', 'admin'].includes(profile.role)) {
			throw error(403, 'Forbidden - Admin access required');
		}

		const id = url.searchParams.get('id');
		if (!id) {
			throw error(400, 'Course id is required');
		}

		// Soft delete by setting status to archived
		const { error: archiveError } = await supabaseAdmin
			.from('courses')
			.update({ status: 'archived', is_active: false, updated_at: new Date().toISOString() })
			.eq('id', id);

		if (archiveError) {
			console.error('Error archiving course:', archiveError);
			throw error(500, 'Failed to archive course');
		}

		return json({ success: true });

	} catch (err) {
		console.error('API error:', err);
		if (err?.status) {
			throw err;
		}
		throw error(500, 'Internal server error');
	}
};
