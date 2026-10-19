/**
 * Captions for course videos.
 *
 * Every upload asks Mux for free auto-generated English captions, and Mux Player shows
 * captions by default when a track exists. Auto captions mishear names and theological
 * terms, so an admin can download them, correct the text, and upload the file back: the
 * corrected track then replaces every other caption track on the video, so viewers only
 * ever see one "English" option.
 *
 * Mux fetches an uploaded caption file from a URL, so the file is put in the public
 * materials bucket first. Caption text is not private (it is the video's own words).
 */
import { video } from '$lib/server/mux';
import { supabaseAdmin } from '$lib/server/supabase.js';

const BUCKET = 'materials';
const MAX_BYTES = 2 * 1024 * 1024;

export interface CaptionTrack {
	id: string;
	name: string;
	source: 'generated' | 'uploaded';
	status: string;
}

export interface CaptionState {
	tracks: CaptionTrack[];
	audioTrackId: string | null;
}

interface MuxTrackLike {
	id?: string;
	type?: string;
	name?: string;
	status?: string;
	text_source?: string;
}

function toCaptionTracks(tracks: MuxTrackLike[] = []): CaptionTrack[] {
	return tracks
		.filter((t) => t.type === 'text' && t.id && t.status !== 'deleted')
		.map((t) => ({
			id: t.id!,
			name: t.name ?? 'English',
			source: t.text_source?.startsWith('generated') ? 'generated' : 'uploaded',
			status: t.status ?? 'preparing'
		}));
}

export async function getCaptionState(assetId: string): Promise<CaptionState> {
	const asset = await video.assets.retrieve(assetId);
	const audio = (asset.tracks ?? []).find((t: MuxTrackLike) => t.type === 'audio');
	return { tracks: toCaptionTracks(asset.tracks), audioTrackId: audio?.id ?? null };
}

/** Ask Mux to transcribe the video. Free; takes about a tenth of the video's length. */
export async function generateCaptions(assetId: string): Promise<CaptionState> {
	const state = await getCaptionState(assetId);
	if (!state.audioTrackId) throw new Error('This video has no audio to caption');
	if (state.tracks.some((t) => t.status === 'preparing')) return state;
	await video.assets.generateSubtitles(assetId, state.audioTrackId, {
		generated_subtitles: [{ language_code: 'en', name: 'English (generated)' }]
	});
	return getCaptionState(assetId);
}

/**
 * Basic check that the file is WebVTT or SRT with at least one cue, so an obviously
 * wrong file is refused here rather than silently failing at Mux.
 */
export function validateCaptionFile(text: string): 'vtt' | 'srt' {
	const body = text.replace(/^﻿/, '');
	if (!/-->/.test(body)) throw new Error('This file has no caption timings (expected a .vtt or .srt file)');
	if (/^WEBVTT/.test(body)) return 'vtt';
	if (/^\s*\d+\s*\r?\n\s*\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(body)) return 'srt';
	throw new Error('This file is not a WebVTT (.vtt) or SubRip (.srt) caption file');
}

/**
 * Replace the video's captions with a corrected file. The new track is added first and
 * the old ones removed after, so a refused upload leaves the existing captions in place.
 */
export async function uploadCaptions(materialId: string, assetId: string, text: string): Promise<CaptionState> {
	if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Caption file is too large (2 MB max)');
	const format = validateCaptionFile(text);

	const before = await getCaptionState(assetId);

	const path = `captions/${materialId}/${Date.now()}.${format}`;
	const { error: uploadError } = await supabaseAdmin.storage
		.from(BUCKET)
		.upload(path, new Blob([text], { type: 'text/plain' }), { contentType: 'text/plain', upsert: true });
	if (uploadError) throw new Error(`Could not store the caption file: ${uploadError.message}`);
	const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

	await video.assets.createTrack(assetId, {
		url: data.publicUrl,
		type: 'text',
		text_type: 'subtitles',
		language_code: 'en',
		name: 'English',
		closed_captions: false
	});

	await Promise.all(before.tracks.map((t) => video.assets.deleteTrack(assetId, t.id)));
	return getCaptionState(assetId);
}

export function captionsVttUrl(playbackId: string, trackId: string): string {
	return `https://stream.mux.com/${playbackId}/text/${trackId}.vtt`;
}
