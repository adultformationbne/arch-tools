import { json } from '@sveltejs/kit';
import { listUpcomingDGRPosts, syncPromoTilesToPosts } from '$lib/server/dgr-wordpress.js';

// Each post costs two WordPress round trips; allow time for a large batch.
export const config = { maxDuration: 60 };

/**
 * GET  — list DGR posts dated today or later, flagging which ones show
 *        promo tiles that differ from the current configuration.
 * POST — { postIds: number[] } update the promo block in those posts in place.
 *        Never touches posts dated before today.
 */
export async function GET() {
	try {
		const upcomingPosts = await listUpcomingDGRPosts();
		return json({ upcomingPosts });
	} catch (error) {
		console.error('Failed to check published DGR posts:', error);
		return json({ error: error.message || 'Failed to check published posts' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const { postIds } = await request.json();
		if (!Array.isArray(postIds) || postIds.length === 0 || postIds.length > 50) {
			return json({ error: 'postIds must be a non-empty array (max 50)' }, { status: 400 });
		}
		const ids = postIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);
		if (ids.length !== postIds.length) {
			return json({ error: 'postIds must be positive integers' }, { status: 400 });
		}

		const results = await syncPromoTilesToPosts(ids);
		const updated = results.filter((r) => r.updated).length;
		const failed = results.filter((r) => r.error);
		return json({ success: failed.length === 0, updated, results });
	} catch (error) {
		console.error('Failed to update promo tiles in published posts:', error);
		return json({ error: error.message || 'Failed to update published posts' }, { status: 500 });
	}
}
