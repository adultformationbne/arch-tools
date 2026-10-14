import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import type { PageServerLoad } from './$types';

/**
 * Public watch page for a single video: /p/watch/<material id>.
 *
 * A leader sends this to one person who needs to rewatch a session. It carries the
 * video, which session it is and a link to the Companion Guide, and nothing else:
 * no way to reach any other video. It only exists for a Mux video an admin has
 * switched on ("Make available at a public link"); anything else is a plain 404
 * so the page never confirms what does or does not exist.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	if (!UUID.test(params.id)) throw error(404, 'Not found');

	const { data: material } = await supabaseAdmin
		.from('courses_materials')
		.select(
			`id, type, title, mux_playback_id, mux_status, public_watch_enabled,
			 session:courses_sessions!session_id (
				session_number, title, section_name,
				module:courses_modules!module_id (
					order_number, name,
					course:courses!course_id ( slug, name, settings )
				)
			 )`
		)
		.eq('id', params.id)
		.maybeSingle();

	const session = Array.isArray(material?.session) ? material?.session[0] : material?.session;
	const module = Array.isArray(session?.module) ? session?.module[0] : session?.module;
	const course = Array.isArray(module?.course) ? module?.course[0] : module?.course;

	if (!material || material.type !== 'mux_video' || !material.public_watch_enabled) throw error(404, 'Not found');
	if (!session || !module || !course) throw error(404, 'Not found');

	// Unlisted: keep it out of search results, and out of any shared cache
	setHeaders({ 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'private, no-store' });

	const settings = getCourseSettings(course.settings);

	return {
		course: { slug: course.slug as string, name: course.name as string },
		session: {
			number: session.session_number as number,
			title: session.title as string,
			sectionName: (session.section_name as string | null) ?? null
		},
		video: {
			title: material.title as string,
			playbackId: (material.mux_playback_id as string | null) ?? null,
			status: (material.mux_status as string | null) ?? null
		},
		// The whole guide, never a single session; only when the course has public pages
		guideUrl: settings.features?.publicPagesEnabled ? `/p/${course.slug}/${module.order_number}` : null
	};
};
