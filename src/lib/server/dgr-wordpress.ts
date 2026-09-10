/**
 * DGR WordPress helpers — finding published posts and syncing promo tiles into them.
 *
 * Promo tiles are swapped into existing posts surgically: only the marked promo
 * block is replaced, the rest of the post content is left byte-for-byte as it was.
 * Only DGR-category posts dated today or later (Brisbane) are ever touched.
 */

import { WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { minifyHTML } from '$lib/utils/wordpress-safe-html.js';
import {
	brisbaneToday,
	renderPromoTilesBlock,
	replacePromoBlock,
	tilesForDate
} from '$lib/utils/dgr-promo-tiles.js';

const DGR_CATEGORY_NAME = 'Daily Reflections';
const WP_PAGE_SIZE = 100; // WordPress REST maximum
const SYNC_CONCURRENCY = 4;

export interface PromoTile {
	id?: number;
	position: number;
	image_url: string | null;
	title: string | null;
	link_url: string | null;
	active: boolean | null;
	starts_at: string | null;
	expires_at: string | null;
}

export interface UpcomingPost {
	id: number;
	date: string; // YYYY-MM-DD (Brisbane)
	status: string;
	link: string;
	title: string;
	/** True when the post's promo block differs from what current tiles would render. */
	stale: boolean;
	/** Set when the post has no promo block and no </article> to insert one before. */
	error?: string;
	/** Tiles that would appear on this post with the current configuration. */
	tiles: { image_url: string; title: string }[];
}

interface WpPost {
	id: number;
	date: string;
	date_gmt: string;
	status: string;
	link: string;
	categories: number[];
	title: { raw?: string; rendered?: string };
	content: { raw: string };
}

const POST_FIELDS = 'id,date,date_gmt,status,link,categories,title,content.raw';

function authHeader() {
	return 'Basic ' + Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64');
}

async function wp(path: string, init: RequestInit = {}) {
	const res = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2${path}`, {
		...init,
		headers: {
			Authorization: authHeader(),
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...(init.headers || {})
		}
	});
	if (!res.ok) {
		let message = await res.text();
		try {
			message = JSON.parse(message).message || message;
		} catch {
			/* keep raw text */
		}
		throw new Error(`WordPress ${res.status}: ${message}`);
	}
	return res;
}

/** All active promo tiles with an image, in position order (no date filtering). */
export async function fetchPromoTiles(): Promise<PromoTile[]> {
	const { data, error } = await supabaseAdmin
		.from('dgr_promo_tiles')
		.select('*')
		.eq('active', true)
		.not('image_url', 'is', null)
		.neq('image_url', '')
		.order('position');
	if (error) throw new Error(error.message);
	return (data || []) as PromoTile[];
}

/** Exact-name lookup; `search=` is fuzzy so never fall back to the first hit. */
async function getDGRCategoryId(): Promise<number | null> {
	const res = await wp(`/categories?search=${encodeURIComponent(DGR_CATEGORY_NAME)}&_fields=id,name`);
	const cats = (await res.json()) as { id: number; name: string }[];
	return cats.find((c) => c.name === DGR_CATEGORY_NAME)?.id ?? null;
}

/**
 * The post's Brisbane calendar date. Derived from date_gmt so the result does
 * not depend on the WordPress site's configured timezone.
 */
function postBrisbaneDate(p: { date_gmt: string; date: string }) {
	if (p.date_gmt) {
		return new Date(p.date_gmt + 'Z').toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
	}
	return p.date.slice(0, 10);
}

function toUpcomingPost(p: WpPost, tiles: PromoTile[]): UpcomingPost {
	const date = postBrisbaneDate(p);
	const newBlock = minifyHTML(renderPromoTilesBlock(tiles, date));
	const { changed, error } = replacePromoBlock(p.content.raw, newBlock);
	return {
		id: p.id,
		date,
		status: p.status,
		link: p.link,
		title: p.title.raw || p.title.rendered || date,
		stale: changed,
		...(error ? { error } : {}),
		tiles: tilesForDate(tiles, date).map((t) => ({
			image_url: t.image_url || '',
			title: t.title || ''
		}))
	};
}

/**
 * DGR posts dated today or later (published + scheduled), with a staleness check
 * against the tiles supplied (defaults to the current DB tiles).
 */
export async function listUpcomingDGRPosts(tiles?: PromoTile[]): Promise<UpcomingPost[]> {
	const currentTiles = tiles ?? (await fetchPromoTiles());
	const today = brisbaneToday();
	const categoryId = await getDGRCategoryId();
	if (!categoryId) return [];

	// `after` is a coarse pre-filter in site-local time; start a day early and
	// filter precisely on the Brisbane date below.
	const dayBefore = new Date(today + 'T00:00:00Z');
	dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
	const after = dayBefore.toISOString().slice(0, 10) + 'T00:00:00';

	const posts: WpPost[] = [];
	for (let page = 1; ; page++) {
		const res = await wp(
			`/posts?categories=${categoryId}&status=publish,future&after=${after}&per_page=${WP_PAGE_SIZE}&page=${page}&orderby=date&order=asc&context=edit&_fields=${POST_FIELDS}`
		);
		const batch = (await res.json()) as WpPost[];
		posts.push(...batch);
		const totalPages = Number(res.headers.get('x-wp-totalpages') || 1);
		if (page >= totalPages || batch.length < WP_PAGE_SIZE) break;
	}

	return posts
		.map((p) => toUpcomingPost(p, currentTiles))
		.filter((p) => p.date >= today)
		.sort((a, b) => a.date.localeCompare(b.date));
}

export interface SyncResult {
	id: number;
	date: string;
	link: string;
	updated: boolean;
	error?: string;
}

async function syncOnePost(
	id: number,
	tiles: PromoTile[],
	today: string,
	categoryId: number
): Promise<SyncResult> {
	try {
		const res = await wp(`/posts/${id}?context=edit&_fields=${POST_FIELDS}`);
		const post = (await res.json()) as WpPost;
		const date = postBrisbaneDate(post);
		const base = { id, date, link: post.link, updated: false };

		if (!post.categories?.includes(categoryId)) {
			return { ...base, error: 'Not a Daily Reflections post; not modified' };
		}
		if (date < today) {
			return { ...base, error: 'Post is in the past; not modified' };
		}

		const newBlock = minifyHTML(renderPromoTilesBlock(tiles, date));
		const { html, changed, error } = replacePromoBlock(post.content.raw, newBlock);
		if (error) return { ...base, error };
		if (!changed) return base;

		// Send only `content` so status, date and everything else stay untouched.
		await wp(`/posts/${id}`, { method: 'POST', body: JSON.stringify({ content: html }) });
		return { ...base, updated: true };
	} catch (err) {
		return { id, date: '', link: '', updated: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/**
 * Re-render the promo block for each given post with current tiles and update
 * the post in place. Refuses posts outside the DGR category or dated before today.
 * Runs a few posts at a time so large batches finish within the function timeout.
 */
export async function syncPromoTilesToPosts(postIds: number[]): Promise<SyncResult[]> {
	const [tiles, categoryId] = await Promise.all([fetchPromoTiles(), getDGRCategoryId()]);
	const today = brisbaneToday();
	if (!categoryId) {
		return postIds.map((id) => ({ id, date: '', link: '', updated: false, error: 'Daily Reflections category not found' }));
	}

	const results: SyncResult[] = new Array(postIds.length);
	let next = 0;
	const worker = async () => {
		while (next < postIds.length) {
			const i = next++;
			results[i] = await syncOnePost(postIds[i], tiles, today, categoryId);
		}
	};
	await Promise.all(Array.from({ length: Math.min(SYNC_CONCURRENCY, postIds.length) }, worker));
	return results;
}
