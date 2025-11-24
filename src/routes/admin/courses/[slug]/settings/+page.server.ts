import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

export async function load(event) {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	// Fetch course details
	const { data: course, error } = await supabaseAdmin
		.from('courses')
		.select('*')
		.eq('slug', courseSlug)
		.single();

	if (error || !course) {
		console.error('Failed to fetch course:', error);
		throw new Error('Course not found');
	}

	return {
		courseSlug,
		course
	};
}
