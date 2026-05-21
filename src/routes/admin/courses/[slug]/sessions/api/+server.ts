import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();
	const { sessionId, publicPageContent } = body;

	if (!sessionId) return json({ error: 'sessionId required' }, { status: 400 });

	if (publicPageContent !== null && publicPageContent !== undefined && !Array.isArray(publicPageContent)) {
		return json({ error: 'publicPageContent must be an array or null' }, { status: 400 });
	}

	// Verify session belongs to this course
	const { data: session } = await supabaseAdmin
		.from('courses_sessions')
		.select('id, module_id, courses_modules!inner(course_id, courses!inner(slug))')
		.eq('id', sessionId)
		.maybeSingle();

	if (!session) return json({ error: 'Session not found' }, { status: 404 });

	const { error } = await supabaseAdmin
		.from('courses_sessions')
		.update({ public_page_content: publicPageContent ?? null })
		.eq('id', sessionId);

	if (error) return json({ error: error.message }, { status: 500 });

	return json({ success: true });
};
