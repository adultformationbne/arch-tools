import { error, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { course_slug } = params;

	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id, name, short_name, description, slug, settings, public_title_page')
		.eq('slug', course_slug)
		.maybeSingle();

	if (!course) throw error(404, 'Course not found');

	const settings = getCourseSettings(course.settings);
	if (!settings.features?.publicPagesEnabled) throw error(404, 'Course not found');

	const { data: modules } = await supabaseAdmin
		.from('courses_modules')
		.select('id, name, description, order_number, section_name, public_page_content')
		.eq('course_id', course.id)
		.order('order_number');

	// Each module is a self-contained guide. With a single module there is nothing
	// to choose between, so the course link goes straight to it.
	if (modules?.length === 1) {
		throw redirect(307, `/p/${course.slug}/${modules[0].order_number}`);
	}

	// A module is worth listing if it, or any of its sessions, has public content
	const { data: sessionsWithContent } = await supabaseAdmin
		.from('courses_sessions')
		.select('module_id')
		.in('module_id', (modules ?? []).map(m => m.id))
		.not('public_page_content', 'is', null);
	const modulesWithSessionContent = new Set((sessionsWithContent ?? []).map(s => s.module_id));

	return {
		course: {
			name: course.name,
			shortName: course.short_name,
			description: course.description,
			slug: course.slug,
			titlePage: course.public_title_page
		},
		modules: (modules ?? []).map(m => ({
			id: m.id,
			name: m.name,
			description: m.description,
			orderNumber: m.order_number,
			sectionName: m.section_name ?? null,
			hasContent: !!m.public_page_content || modulesWithSessionContent.has(m.id)
		}))
	};
};
