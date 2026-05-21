import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const { course_slug, module_order } = params;
	const orderNum = parseInt(module_order, 10);
	if (isNaN(orderNum)) throw error(404, 'Not found');

	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id, name, short_name, slug, settings')
		.eq('slug', course_slug)
		.maybeSingle();

	if (!course) throw error(404, 'Not found');

	const settings = getCourseSettings(course.settings);
	if (!settings.features?.publicPagesEnabled) throw error(404, 'Not found');

	const { data: module } = await supabaseAdmin
		.from('courses_modules')
		.select('id, name, description, order_number, section_name, public_page_content')
		.eq('course_id', course.id)
		.eq('order_number', orderNum)
		.maybeSingle();

	if (!module) throw error(404, 'Not found');

	const { data: sessions } = await supabaseAdmin
		.from('courses_sessions')
		.select('id, session_number, title, description, public_page_content')
		.eq('module_id', module.id)
		.order('session_number');

	// All modules for sidebar
	const { data: allModules } = await supabaseAdmin
		.from('courses_modules')
		.select('id, name, order_number, section_name')
		.eq('course_id', course.id)
		.order('order_number');

	return {
		course: { name: course.name, shortName: course.short_name, slug: course.slug },
		module: {
			id: module.id,
			name: module.name,
			description: module.description,
			orderNumber: module.order_number,
			sectionName: module.section_name ?? null,
			blocks: (module.public_page_content as any[]) ?? []
		},
		sessions: (sessions ?? []).map(s => ({
			id: s.id,
			sessionNumber: s.session_number,
			title: s.title,
			description: s.description,
			hasContent: !!s.public_page_content
		})),
		allModules: (allModules ?? []).map(m => ({
			id: m.id,
			name: m.name,
			orderNumber: m.order_number,
			sectionName: m.section_name ?? null
		}))
	};
};
