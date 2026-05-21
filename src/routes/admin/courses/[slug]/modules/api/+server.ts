import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();

	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id')
		.eq('slug', courseSlug)
		.maybeSingle();

	if (!course) return json({ error: 'Course not found' }, { status: 404 });

	// Course-level title page update
	if ('courseTitlePage' in body) {
		const { courseTitlePage } = body;
		if (courseTitlePage !== null && !Array.isArray(courseTitlePage)) {
			return json({ error: 'courseTitlePage must be an array or null' }, { status: 400 });
		}
		const { error } = await supabaseAdmin
			.from('courses')
			.update({ public_title_page: courseTitlePage })
			.eq('id', course.id);
		if (error) return json({ error: error.message }, { status: 500 });
		return json({ success: true });
	}

	// Module-level update (content + section name)
	const { moduleId, publicPageContent, sectionName } = body;
	if (!moduleId) return json({ error: 'moduleId required' }, { status: 400 });

	if (publicPageContent !== null && publicPageContent !== undefined && !Array.isArray(publicPageContent)) {
		return json({ error: 'publicPageContent must be an array or null' }, { status: 400 });
	}

	const updates: Record<string, unknown> = {};
	if ('publicPageContent' in body) updates.public_page_content = publicPageContent;
	if ('sectionName' in body) updates.section_name = sectionName || null;

	if (Object.keys(updates).length === 0) {
		return json({ error: 'Nothing to update' }, { status: 400 });
	}

	const { error } = await supabaseAdmin
		.from('courses_modules')
		.update(updates)
		.eq('id', moduleId)
		.eq('course_id', course.id);

	if (error) return json({ error: error.message }, { status: 500 });

	return json({ success: true });
};
