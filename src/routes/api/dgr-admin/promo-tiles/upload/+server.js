import { json } from '@sveltejs/kit';
import { uploadMediaToWordPress } from '$lib/server/dgr-wordpress.js';

// Auth: hooks.server.ts requires the `dgr` module for all /api/dgr-admin/* routes.

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB — WordPress will keep the original
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const config = { maxDuration: 30 };

/**
 * POST multipart/form-data { image: File, title?: string }
 * Uploads the image to the WordPress media library and returns its CDN URL,
 * so promo tile images live alongside the DGR posts on WordPress.
 */
export async function POST({ request }) {
	let formData;
	try {
		formData = await request.formData();
	} catch {
		return json({ error: 'Expected multipart form data' }, { status: 400 });
	}

	const file = formData.get('image');
	const rawTitle = formData.get('title');
	const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';

	if (!(file instanceof File) || file.size === 0) {
		return json({ error: 'No image provided' }, { status: 400 });
	}
	if (!ALLOWED_TYPES.includes(file.type)) {
		return json({ error: 'Image must be JPEG, PNG, GIF, or WebP' }, { status: 400 });
	}
	if (file.size > MAX_FILE_SIZE) {
		return json({ error: `Image must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB` }, { status: 400 });
	}

	try {
		const media = await uploadMediaToWordPress(file, {
			title: title || undefined,
			altText: title || undefined
		});
		return json({ success: true, url: media.url, mediaId: media.id });
	} catch (error) {
		console.error('Failed to upload promo tile image to WordPress:', error);
		return json({ error: error.message || 'Upload to WordPress failed' }, { status: 502 });
	}
}
