import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import type { PageServerLoad } from './$types';

function resolveMaterialBlock(block: any, materialsById: Map<string, any>): any {
	if (block.type !== 'material') return block;
	const mat = materialsById.get(block.materialId);
	if (!mat) return null;

	if (mat.type === 'mux_video' && mat.mux_playback_id) {
		return { type: 'video', url: `https://stream.mux.com/${mat.mux_playback_id}`, caption: block.caption ?? mat.title };
	}
	if (mat.type === 'video' || mat.type === 'embed') {
		return { type: 'video', url: mat.content, caption: block.caption ?? mat.title };
	}
	if (mat.type === 'image') {
		return { type: 'image', url: mat.content, caption: block.caption ?? mat.title };
	}
	if (mat.type === 'document' || mat.type === 'link' || mat.type === 'native') {
		return { type: 'download', url: mat.content, title: block.title ?? mat.title, caption: block.caption };
	}
	return null;
}

export const load: PageServerLoad = async ({ params }) => {
	const { course_slug, module_order, session_number } = params;
	const orderNum = parseInt(module_order, 10);
	const sessionNum = parseInt(session_number, 10);
	if (isNaN(orderNum) || isNaN(sessionNum)) throw error(404, 'Not found');

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
		.select('id, name, order_number, section_name')
		.eq('course_id', course.id)
		.eq('order_number', orderNum)
		.maybeSingle();

	if (!module) throw error(404, 'Not found');

	const { data: sessions } = await supabaseAdmin
		.from('courses_sessions')
		.select('id, session_number, title, description, public_page_content')
		.eq('module_id', module.id)
		.order('session_number');

	if (!sessions?.length) throw error(404, 'Not found');

	const session = sessions.find(s => s.session_number === sessionNum);
	if (!session) throw error(404, 'Not found');

	const rawBlocks: any[] = (session.public_page_content as any[]) ?? [];

	// Resolve any material blocks
	const materialIds = rawBlocks
		.filter(b => b.type === 'material' && b.materialId)
		.map(b => b.materialId);

	let blocks = rawBlocks;
	if (materialIds.length > 0) {
		const { data: materials } = await supabaseAdmin
			.from('courses_materials')
			.select('id, type, title, content, mux_playback_id')
			.in('id', materialIds);

		const materialsById = new Map((materials ?? []).map(m => [m.id, m]));
		blocks = rawBlocks
			.map(b => resolveMaterialBlock(b, materialsById))
			.filter(Boolean);
	}

	return {
		course: { name: course.name, shortName: course.short_name, slug: course.slug },
		module: {
			id: module.id,
			name: module.name,
			orderNumber: module.order_number,
			sectionName: module.section_name ?? null
		},
		sessions: sessions.map(s => ({
			id: s.id,
			sessionNumber: s.session_number,
			title: s.title,
			hasContent: !!s.public_page_content
		})),
		session: {
			id: session.id,
			sessionNumber: session.session_number,
			title: session.title,
			description: session.description,
			blocks
		}
	};
};
