/**
 * Downloadable MP4s for course videos.
 *
 * A Mux video streams as HLS; a file a leader can save only exists once Mux has been
 * asked to make a "static rendition". We ask for one when an admin lets leaders
 * download a video, then hand out the file's own URL (the playback id is public) once
 * Mux says it is ready. The file's name comes from Mux, never assumed.
 *
 * Mux bills stored renditions, so this is opt-in per video, never automatic.
 */
import { video } from '$lib/server/mux';
import { supabaseAdmin } from '$lib/server/supabase.js';

export interface MuxAssetLike {
	status?: string;
	max_stored_resolution?: string;
	static_renditions?: {
		files?: Array<{ name?: string; status?: string; resolution?: string }>;
	};
}

/** The slice of the Mux assets API this module uses, so tests can stand in for it. */
export interface MuxAssetsApi {
	retrieve(assetId: string): Promise<MuxAssetLike>;
	createStaticRendition(assetId: string, body: { resolution: string }): Promise<unknown>;
}

export type DownloadState = { state: 'ready'; fileName: string } | { state: 'preparing' };

const isMp4 = (name?: string) => !!name && name.toLowerCase().endsWith('.mp4');

/**
 * 1080p is plenty to show a room and keeps a 40-minute video to about a gigabyte.
 * A source that is not Full HD or better cannot make a 1080p file (Mux never
 * upscales), so ask for its highest instead.
 */
export function chooseResolution(asset: MuxAssetLike): '1080p' | 'highest' {
	const max = asset.max_stored_resolution;
	return max === 'FHD' || max === 'UHD' ? '1080p' : 'highest';
}

/** The MP4 to hand out, if Mux has finished one. Prefers 1080p so a 4K file is not served by accident. */
export function readyDownloadFile(asset: MuxAssetLike): string | null {
	const ready = (asset.static_renditions?.files ?? []).filter((f) => f.status === 'ready' && isMp4(f.name));
	const byName = (name: string) => ready.find((f) => f.name === name)?.name;
	return byName('1080p.mp4') ?? byName('highest.mp4') ?? byName('720p.mp4') ?? ready[0]?.name ?? null;
}

/**
 * Make sure a downloadable file exists or is being made.
 * Throws if the video is not ready or Mux cannot make a file for it.
 */
export async function ensureDownloadRendition(
	assetId: string,
	assets: MuxAssetsApi = video.assets as unknown as MuxAssetsApi
): Promise<DownloadState> {
	const asset = await assets.retrieve(assetId);
	if (asset.status !== 'ready') throw new Error('The video is not ready yet');

	const fileName = readyDownloadFile(asset);
	if (fileName) return { state: 'ready', fileName };

	const mp4s = (asset.static_renditions?.files ?? []).filter((f) => isMp4(f.name));
	if (mp4s.some((f) => f.status === 'preparing')) return { state: 'preparing' };
	// Files exist but none is usable (errored or skipped): asking again would be refused
	if (mp4s.length > 0) throw new Error('Mux could not make a download for this video');

	await assets.createStaticRendition(assetId, { resolution: chooseResolution(asset) });
	return { state: 'preparing' };
}

/** Called when an admin lets leaders download a video: starts the file if it is not there yet. */
export async function enableLeaderDownload(materialId: string): Promise<DownloadState> {
	const { data: material } = await supabaseAdmin
		.from('courses_materials')
		.select('type, mux_asset_id')
		.eq('id', materialId)
		.maybeSingle();

	if (!material || material.type !== 'mux_video' || !material.mux_asset_id) {
		throw new Error('Downloads are only available for uploaded videos');
	}
	return ensureDownloadRendition(material.mux_asset_id);
}

/** The name the file is saved under, without the extension (Mux adds it). */
export function downloadSaveName(parts: { courseName: string; sessionNumber: number; title: string }): string {
	const clean = (text: string) =>
		text
			.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	const session = parts.sessionNumber === 0 ? 'Start' : `Session ${parts.sessionNumber}`;
	return [clean(parts.courseName), session, clean(parts.title)].filter(Boolean).join(' - ').slice(0, 150);
}

export function muxDownloadUrl(playbackId: string, fileName: string, saveName: string): string {
	return `https://stream.mux.com/${playbackId}/${fileName}?download=${encodeURIComponent(saveName)}`;
}
