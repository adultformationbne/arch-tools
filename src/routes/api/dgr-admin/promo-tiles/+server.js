import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { listUpcomingDGRPosts } from '$lib/server/dgr-wordpress.js';

const MAX_TILES = 3;

function formatTile(tile) {
	return {
		id: tile.id,
		position: tile.position,
		image_url: tile.image_url,
		title: tile.title || '',
		link_url: tile.link_url || '',
		active: tile.active ?? true,
		starts_at: tile.starts_at || null,
		expires_at: tile.expires_at || null
	};
}

export async function GET() {
	try {
		// Fetch all promo tiles ordered by position
		const { data: tiles, error } = await supabaseAdmin
			.from('dgr_promo_tiles')
			.select('*')
			.order('position');

		if (error) {
			console.error('Error fetching promo tiles:', error);
			return json({ error: error.message }, { status: 500 });
		}

		// Return all tiles (including expired / not-yet-started) for admin management
		const formattedTiles = (tiles || [])
			.filter((tile) => tile.image_url && tile.image_url.trim())
			.map(formatTile)
			.sort((a, b) => a.position - b.position);

		return json({ tiles: formattedTiles });
	} catch (error) {
		console.error('Failed to fetch promo tiles:', error);
		return json({ error: 'Failed to fetch promo tiles' }, { status: 500 });
	}
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HTTP_URL_RE = /^https?:\/\/\S+$/i;

/**
 * Validate and normalise the submitted tiles.
 * Returns { tiles } on success or { error } describing the first problem.
 */
function validateTiles(input) {
	if (!Array.isArray(input)) return { error: 'Invalid tiles data' };
	if (input.length > MAX_TILES) return { error: `At most ${MAX_TILES} tiles are allowed` };

	const tiles = [];
	for (let i = 0; i < input.length; i++) {
		const raw = input[i] || {};
		const label = `Tile ${i + 1}`;

		const image_url = typeof raw.image_url === 'string' ? raw.image_url.trim() : '';
		if (!image_url) return { error: `${label}: image URL is required` };
		if (!HTTP_URL_RE.test(image_url)) return { error: `${label}: image URL must start with http:// or https://` };

		const link_url = typeof raw.link_url === 'string' ? raw.link_url.trim() : '';
		if (link_url && !HTTP_URL_RE.test(link_url)) return { error: `${label}: link URL must start with http:// or https://` };

		const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : '';

		const dates = {};
		for (const field of ['starts_at', 'expires_at']) {
			const value = raw[field];
			if (value == null || value === '') {
				dates[field] = null;
			} else if (typeof value === 'string' && DATE_RE.test(value)) {
				dates[field] = value;
			} else {
				return { error: `${label}: ${field === 'starts_at' ? 'start' : 'expiry'} date must be YYYY-MM-DD` };
			}
		}
		if (dates.starts_at && dates.expires_at && dates.starts_at > dates.expires_at) {
			return { error: `${label}: start date must be on or before the expiry date` };
		}

		tiles.push({
			position: i + 1, // positions are always the submitted order
			image_url,
			title,
			link_url,
			active: true,
			...dates
		});
	}
	return { tiles };
}

export async function POST({ request }) {
	try {
		const body = await request.json();
		const validated = validateTiles(body?.tiles);
		if (validated.error) return json({ error: validated.error }, { status: 400 });
		const tiles = validated.tiles || [];

		// Positions are unique, so overwrite rows 1..n in place, then drop any
		// leftover rows beyond the submitted count. Old tiles stay put if the
		// upsert fails rather than the table being emptied first.
		if (tiles.length > 0) {
			const { error: upsertError } = await supabaseAdmin
				.from('dgr_promo_tiles')
				.upsert(tiles, { onConflict: 'position' });
			if (upsertError) {
				console.error('Error saving tiles:', upsertError);
				throw upsertError;
			}
		}

		const { error: clearError } = await supabaseAdmin
			.from('dgr_promo_tiles')
			.delete()
			.gt('position', tiles.length);
		if (clearError) {
			console.error('Error clearing leftover tiles:', clearError);
			throw clearError;
		}

		// Saving never touches WordPress. Report which already-published posts now
		// show out-of-date tiles so the admin can update them with one click.
		let upcomingPosts = [];
		let wordpressError = null;
		try {
			upcomingPosts = await listUpcomingDGRPosts();
		} catch (err) {
			console.warn('Could not check published posts after saving tiles:', err);
			wordpressError = err instanceof Error ? err.message : String(err);
		}

		return json({
			success: true,
			message: 'Promo tiles updated successfully',
			upcomingPosts,
			wordpressError
		});
	} catch (error) {
		console.error('Failed to update promo tiles:', error);
		return json({ error: error.message || 'Failed to update promo tiles' }, { status: 500 });
	}
}
