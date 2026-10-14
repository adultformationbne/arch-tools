import { error, json } from '@sveltejs/kit';
import { requireCourseAccess, requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';
import {
	downloadSaveName,
	ensureDownloadRendition,
	muxDownloadUrl
} from '$lib/server/mux-download';
import type { RequestHandler } from './$types';

/**
 * GET /api/courses/<slug>/video-download/<material id>
 *
 * For signed-in leaders of the course (or its admins): returns the address of the
 * video's downloadable MP4 once Mux has made it, or says it is still being prepared.
 * Only for a video an admin has allowed leaders to download. The public watch page
 * has no part in this.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async (event) => {
	const { slug, materialId } = event.params;
	if (!UUID.test(materialId)) throw error(404, 'Not found');

	// Part of this course, or one of its admins
	try {
		await requireCourseAccess(event, slug);
	} catch {
		await requireCourseAdmin(event, slug);
	}

	const { data: material } = await supabaseAdmin
		.from('courses_materials')
		.select(
			`id, type, title, mux_asset_id, mux_playback_id, leader_download_enabled,
			 session:courses_sessions!session_id (
				session_number, title,
				module:courses_modules!module_id (
					course:courses!course_id ( slug, name )
				)
			 )`
		)
		.eq('id', materialId)
		.maybeSingle();

	const session = Array.isArray(material?.session) ? material?.session[0] : material?.session;
	const module = Array.isArray(session?.module) ? session?.module[0] : session?.module;
	const course = Array.isArray(module?.course) ? module?.course[0] : module?.course;

	if (
		!material ||
		material.type !== 'mux_video' ||
		!material.leader_download_enabled ||
		!material.mux_asset_id ||
		!material.mux_playback_id ||
		!session ||
		course?.slug !== slug
	) {
		throw error(404, 'Not found');
	}

	try {
		const result = await ensureDownloadRendition(material.mux_asset_id);
		const headers = { 'Cache-Control': 'private, no-store' };

		if (result.state !== 'ready') return json({ state: 'preparing' }, { headers });

		const saveName = downloadSaveName({
			courseName: course.name as string,
			sessionNumber: session.session_number as number,
			title: session.title as string
		});
		return json(
			{ state: 'ready', url: muxDownloadUrl(material.mux_playback_id, result.fileName, saveName) },
			{ headers }
		);
	} catch (err) {
		console.error('Video download lookup failed:', err);
		throw error(502, 'The download is not available right now. Please try again shortly.');
	}
};
