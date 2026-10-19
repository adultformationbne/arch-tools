/**
 * Captions for a course video (admin only).
 *
 * GET  ?material_id=          -> the video's caption tracks and a download link for each
 * POST { material_id, action: 'generate' }        -> ask Mux for automatic captions
 * POST { material_id, action: 'upload', text }    -> replace the captions with a corrected .vtt/.srt
 */
import { json } from '@sveltejs/kit';
import { requireAnyModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { captionsVttUrl, generateCaptions, getCaptionState, uploadCaptions, type CaptionState } from '$lib/server/mux-captions';
import type { RequestHandler } from './$types';

async function loadVideo(materialId: string | null) {
	if (!materialId) return { error: json({ error: 'material_id is required' }, { status: 400 }) };
	const { data: material } = await supabaseAdmin
		.from('courses_materials')
		.select('id, type, mux_asset_id, mux_playback_id, mux_status')
		.eq('id', materialId)
		.maybeSingle();
	if (!material || material.type !== 'mux_video' || !material.mux_asset_id || !material.mux_playback_id) {
		return { error: json({ error: 'Captions are only available for uploaded videos' }, { status: 404 }) };
	}
	if (material.mux_status !== 'ready') {
		return { error: json({ error: 'The video is not ready yet' }, { status: 409 }) };
	}
	return { material: material as typeof material & { mux_asset_id: string; mux_playback_id: string } };
}

function withLinks(state: CaptionState, playbackId: string) {
	return {
		tracks: state.tracks.map((t) => ({
			...t,
			vttUrl: t.status === 'ready' ? captionsVttUrl(playbackId, t.id) : null
		}))
	};
}

export const GET: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);
	const { material, error } = await loadVideo(event.url.searchParams.get('material_id'));
	if (error) return error;
	try {
		return json(withLinks(await getCaptionState(material.mux_asset_id), material.mux_playback_id));
	} catch (err) {
		console.error('Could not read captions from Mux:', err);
		return json({ error: 'Could not read captions from Mux' }, { status: 502 });
	}
};

export const POST: RequestHandler = async (event) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);
	const body = await event.request.json();
	const { material_id, action, text } = body;

	const { material, error } = await loadVideo(material_id ?? null);
	if (error) return error;

	try {
		if (action === 'generate') {
			return json(withLinks(await generateCaptions(material.mux_asset_id), material.mux_playback_id));
		}
		if (action === 'upload') {
			if (typeof text !== 'string' || !text.trim()) {
				return json({ error: 'Caption file is empty' }, { status: 400 });
			}
			return json(withLinks(await uploadCaptions(material.id, material.mux_asset_id, text), material.mux_playback_id));
		}
		return json({ error: "action must be 'generate' or 'upload'" }, { status: 400 });
	} catch (err) {
		console.error('Caption update failed:', err);
		return json({ error: err instanceof Error ? err.message : 'Could not update captions' }, { status: 502 });
	}
};
