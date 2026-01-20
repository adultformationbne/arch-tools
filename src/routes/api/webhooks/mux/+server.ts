/**
 * Mux Webhook Handler
 *
 * Receives webhooks from Mux when video processing completes.
 * Updates material records with playback ID and status.
 *
 * Webhook URL: https://app.arhdiocesanministries.org.au/api/webhooks/mux
 * Events to subscribe: video.asset.ready, video.asset.errored, video.upload.asset_created
 */

import { json } from '@sveltejs/kit';
import { MUX_WEBHOOK_SECRET } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import Mux from '@mux/mux-node';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const signature = event.request.headers.get('mux-signature');
	const body = await event.request.text();

	// Verify webhook signature if secret is configured
	if (MUX_WEBHOOK_SECRET) {
		try {
			Mux.webhooks.verifySignature(body, {
				'mux-signature': signature || ''
			}, MUX_WEBHOOK_SECRET);
		} catch (error) {
			console.error('Mux webhook signature verification failed:', error);
			return json({ error: 'Invalid signature' }, { status: 401 });
		}
	} else {
		console.warn('MUX_WEBHOOK_SECRET not configured - skipping signature verification');
	}

	let payload;
	try {
		payload = JSON.parse(body);
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const { type, data } = payload;

	// Extract passthrough data (contains material_id)
	let passthrough: { session_id?: string; material_id?: string } = {};
	try {
		if (data?.passthrough) {
			passthrough = JSON.parse(data.passthrough);
		}
	} catch {
		console.warn('Failed to parse passthrough data');
	}


	switch (type) {
		case 'video.upload.asset_created': {
			// Upload completed, asset created and now processing
			// data.id is the upload ID, data.asset_id is the new asset ID
			const { material_id } = passthrough;
			const uploadId = data.id;
			const assetId = data.asset_id;

			if (material_id) {
				// Primary path: update by material_id from passthrough
				const { error } = await supabaseAdmin
					.from('courses_materials')
					.update({
						mux_upload_id: uploadId,
						mux_asset_id: assetId,
						mux_status: 'processing',
						updated_at: new Date().toISOString()
					})
					.eq('id', material_id);

				if (error) {
					console.error('Failed to update material for asset_created:', error);
				} else {
				}
			} else if (uploadId) {
				// Fallback: find material by mux_upload_id
				const { error } = await supabaseAdmin
					.from('courses_materials')
					.update({
						mux_asset_id: assetId,
						mux_status: 'processing',
						updated_at: new Date().toISOString()
					})
					.eq('mux_upload_id', uploadId);

				if (error) {
					console.error('Failed to update material by upload_id for asset_created:', error);
				} else {
				}
			}
			break;
		}

		case 'video.asset.ready': {
			// Video processing complete, ready to play
			const playbackId = data.playback_ids?.[0]?.id;
			const assetId = data.id;
			const uploadId = data.upload_id; // Mux includes the original upload_id

			if (playbackId) {
				// First try by passthrough material_id
				if (passthrough.material_id) {
					const { error } = await supabaseAdmin
						.from('courses_materials')
						.update({
							mux_asset_id: assetId,
							mux_playback_id: playbackId,
							mux_status: 'ready',
							updated_at: new Date().toISOString()
						})
						.eq('id', passthrough.material_id);

					if (error) {
						console.error('Failed to update material for asset.ready:', error);
					} else {
					}
				} else {
					// Try finding by asset_id first
					const { data: assetMatch, error: assetError } = await supabaseAdmin
						.from('courses_materials')
						.update({
							mux_playback_id: playbackId,
							mux_status: 'ready',
							updated_at: new Date().toISOString()
						})
						.eq('mux_asset_id', assetId)
						.select('id');

					if (assetError) {
						console.error('Failed to update material by asset_id:', assetError);
					} else if (assetMatch && assetMatch.length > 0) {
					} else if (uploadId) {
						// Fallback: find by upload_id (handles race condition where asset_created ran before material was created)
						const { error: uploadError } = await supabaseAdmin
							.from('courses_materials')
							.update({
								mux_asset_id: assetId,
								mux_playback_id: playbackId,
								mux_status: 'ready',
								updated_at: new Date().toISOString()
							})
							.eq('mux_upload_id', uploadId);

						if (uploadError) {
							console.error('Failed to update material by upload_id:', uploadError);
						} else {
						}
					}
				}
			}
			break;
		}

		case 'video.asset.errored': {
			// Video processing failed
			const { material_id } = passthrough;
			const assetId = data.id;
			const uploadId = data.upload_id;

			if (material_id) {
				const { error } = await supabaseAdmin
					.from('courses_materials')
					.update({
						mux_status: 'errored',
						updated_at: new Date().toISOString()
					})
					.eq('id', material_id);

				if (error) {
					console.error('Failed to update material for asset.errored:', error);
				} else {
				}
			} else if (assetId) {
				// Try by asset_id first
				const { data: assetMatch, error: assetError } = await supabaseAdmin
					.from('courses_materials')
					.update({
						mux_status: 'errored',
						updated_at: new Date().toISOString()
					})
					.eq('mux_asset_id', assetId)
					.select('id');

				if (assetError) {
					console.error('Failed to update material by asset_id for error:', assetError);
				} else if (assetMatch && assetMatch.length > 0) {
				} else if (uploadId) {
					// Fallback: find by upload_id
					const { error: uploadError } = await supabaseAdmin
						.from('courses_materials')
						.update({
							mux_asset_id: assetId,
							mux_status: 'errored',
							updated_at: new Date().toISOString()
						})
						.eq('mux_upload_id', uploadId);

					if (uploadError) {
						console.error('Failed to update material by upload_id for error:', uploadError);
					} else {
					}
				}
			}
			break;
		}

		default:
			// Ignore other webhook types
	}

	return json({ received: true });
};
