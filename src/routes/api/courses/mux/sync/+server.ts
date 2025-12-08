/**
 * Mux Sync Endpoint
 *
 * Manually syncs a material's Mux status by checking the upload/asset directly.
 * Useful when webhooks haven't fired (e.g., local development).
 */

import { json } from '@sveltejs/kit';
import { requireAnyModule } from '$lib/server/auth';
import { video } from '$lib/server/mux';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		await requireAnyModule(event, ['courses.admin', 'platform.admin']);

		const body = await event.request.json();
		const { material_id } = body;

		if (!material_id) {
			return json({ error: 'material_id is required' }, { status: 400 });
		}

		// Get the material
		const { data: material, error: fetchError } = await supabaseAdmin
			.from('courses_materials')
			.select('id, mux_upload_id, mux_asset_id')
			.eq('id', material_id)
			.single();

		if (fetchError || !material) {
			return json({ error: 'Material not found' }, { status: 404 });
		}

		let assetId = material.mux_asset_id;
		let playbackId = null;
		let status = 'processing';

		// If we don't have an asset_id yet, check the upload
		if (!assetId && material.mux_upload_id) {
			try {
				const upload = await video.uploads.retrieve(material.mux_upload_id);
				assetId = upload.asset_id;
			} catch (e) {
				console.error('Failed to retrieve upload:', e);
			}
		}

		// If we have an asset_id, get the asset details
		if (assetId) {
			try {
				const asset = await video.assets.retrieve(assetId);
				status = asset.status === 'ready' ? 'ready' :
				         asset.status === 'errored' ? 'errored' : 'processing';
				playbackId = asset.playback_ids?.[0]?.id || null;
			} catch (e) {
				console.error('Failed to retrieve asset:', e);
			}
		}

		// Update the material
		const { error: updateError } = await supabaseAdmin
			.from('courses_materials')
			.update({
				mux_asset_id: assetId,
				mux_playback_id: playbackId,
				mux_status: status,
				updated_at: new Date().toISOString()
			})
			.eq('id', material_id);

		if (updateError) {
			return json({ error: 'Failed to update material' }, { status: 500 });
		}

		return json({
			success: true,
			material: {
				id: material_id,
				mux_asset_id: assetId,
				mux_playback_id: playbackId,
				mux_status: status
			}
		});
	} catch (error) {
		console.error('Mux sync failed:', error);
		return json({ error: 'Failed to sync with Mux' }, { status: 500 });
	}
};
