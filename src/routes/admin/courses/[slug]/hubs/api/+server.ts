import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;

	// Require admin authentication
	await requireCourseAdmin(event, courseSlug);

	try {
		// Get course ID
		const { data: course } = await supabaseAdmin
			.from('courses')
			.select('id')
			.eq('slug', courseSlug)
			.single();

		if (!course) {
			throw error(404, 'Course not found');
		}

		// Get hubs for THIS COURSE only
		const { data: hubs, error: fetchError } = await supabaseAdmin
			.from('courses_hubs')
			.select('id, name, location, coordinator_id')
			.eq('course_id', course.id)
			.order('name', { ascending: true });

		if (fetchError) {
			console.error('Error fetching hubs:', fetchError);
			throw error(500, 'Failed to fetch hubs');
		}

		return json({
			success: true,
			data: hubs || []
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};
