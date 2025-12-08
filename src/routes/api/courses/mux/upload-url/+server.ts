/**
 * Mux Direct Upload URL Endpoint
 *
 * Creates a Mux Direct Upload URL for client-side video uploads.
 * The URL is used by the @mux/mux-uploader component.
 */

import { json } from '@sveltejs/kit';
import { requireAnyModule } from '$lib/server/auth';
import { video } from '$lib/server/mux';
import { PUBLIC_SITE_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	try {
		// Only admins can upload videos
		await requireAnyModule(event, ['courses.admin', 'platform.admin']);

		const body = await event.request.json();
		const { session_id } = body;

		if (!session_id) {
			return json({ error: 'session_id is required' }, { status: 400 });
		}

		// Create Direct Upload with passthrough data for webhook correlation
		const upload = await video.uploads.create({
			cors_origin: PUBLIC_SITE_URL || '*',
			new_asset_settings: {
				playback_policy: ['public'],
				// Pass session context - material will be created when upload starts
				passthrough: JSON.stringify({
					session_id
				})
			}
		});

		return json({
			uploadUrl: upload.url,
			uploadId: upload.id
		});
	} catch (error) {
		console.error('Mux upload URL creation failed:', error);
		return json({ error: 'Failed to create upload URL' }, { status: 500 });
	}
};
