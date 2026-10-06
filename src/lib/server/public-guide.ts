import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCourseSettings } from '$lib/types/course-settings.js';

export interface PublicGuideSession {
	sessionNumber: number;
	title: string;
	sectionName: string | null;
	blocks: any[];
}

export interface PublicGuide {
	course: { name: string; slug: string };
	module: { name: string; description: string | null; orderNumber: number; blocks: any[] };
	sessions: PublicGuideSession[];
}

export function resolveMaterialBlock(block: any, materialsById: Map<string, any>): any {
	if (block.type !== 'material') return block;
	const mat = materialsById.get(block.materialId);
	if (!mat) return null;

	if (mat.type === 'mux_video' && mat.mux_playback_id) {
		return { type: 'video', url: `https://player.mux.com/${mat.mux_playback_id}`, caption: block.caption ?? mat.title };
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

/**
 * A module's whole public guide — landing blocks plus every session that has
 * public content — with material blocks resolved. Used by the print page and
 * the PDF builder. Returns null when the course, module or feature flag is missing.
 */
export async function loadPublicGuide(courseSlug: string, moduleOrder: number): Promise<PublicGuide | null> {
	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id, name, slug, settings')
		.eq('slug', courseSlug)
		.maybeSingle();

	if (!course) return null;
	if (!getCourseSettings(course.settings).features?.publicPagesEnabled) return null;

	const { data: module } = await supabaseAdmin
		.from('courses_modules')
		.select('id, name, description, order_number, public_page_content')
		.eq('course_id', course.id)
		.eq('order_number', moduleOrder)
		.maybeSingle();

	if (!module) return null;

	const { data: sessions } = await supabaseAdmin
		.from('courses_sessions')
		.select('session_number, title, section_name, public_page_content')
		.eq('module_id', module.id)
		.not('public_page_content', 'is', null)
		.order('session_number');

	const withContent = (sessions ?? []).filter(s => Array.isArray(s.public_page_content) && s.public_page_content.length > 0);

	const materialIds = withContent
		.flatMap(s => s.public_page_content as any[])
		.filter(b => b.type === 'material' && b.materialId)
		.map(b => b.materialId);

	const materialsById = new Map<string, any>();
	if (materialIds.length > 0) {
		const { data: materials } = await supabaseAdmin
			.from('courses_materials')
			.select('id, type, title, content, mux_playback_id')
			.in('id', materialIds);
		for (const m of materials ?? []) materialsById.set(m.id, m);
	}

	return {
		course: { name: course.name, slug: course.slug },
		module: {
			name: module.name,
			description: module.description,
			orderNumber: module.order_number,
			blocks: (module.public_page_content as any[]) ?? []
		},
		sessions: withContent.map(s => ({
			sessionNumber: s.session_number,
			title: s.title,
			sectionName: s.section_name ?? null,
			blocks: (s.public_page_content as any[]).map(b => resolveMaterialBlock(b, materialsById)).filter(Boolean)
		}))
	};
}
