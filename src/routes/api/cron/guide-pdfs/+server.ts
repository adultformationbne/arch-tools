import { json, type RequestEvent } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { rebuildGuidePdfs } from '$lib/server/guide-pdf.js';

// Its own function settings keep headless Chromium out of the shared server bundle
export const config = { maxDuration: 300, memory: 2048 };

export async function GET({ request, url }: RequestEvent) {
	// Verify cron secret
	const cronSecret = env.CRON_SECRET;
	if (cronSecret) {
		const authHeader = request.headers.get('authorization');
		if (authHeader !== `Bearer ${cronSecret}`) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	try {
		const result = await rebuildGuidePdfs(url.origin);
		if (result.errors.length > 0) console.error('Guide PDF errors:', result.errors);
		return json({ success: result.errors.length === 0, ...result }, { status: result.errors.length === 0 ? 200 : 500 });
	} catch (err) {
		console.error('Guide PDF cron failed:', err);
		return json({ success: false, error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
	}
}
