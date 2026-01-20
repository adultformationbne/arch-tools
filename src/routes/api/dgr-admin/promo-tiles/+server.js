import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

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

		// Only return tiles that have image URLs
		const formattedTiles = tiles
			?.filter(tile => tile.image_url && tile.image_url.trim())
			.map(tile => ({
				position: tile.position,
				image_url: tile.image_url,
				title: tile.title || '',
				link_url: tile.link_url || '',
				active: tile.active ?? true
			}))
			.sort((a, b) => a.position - b.position) || [];

		return json({ tiles: formattedTiles });
	} catch (error) {
		console.error('Failed to fetch promo tiles:', error);
		return json({ error: 'Failed to fetch promo tiles' }, { status: 500 });
	}
}

export async function POST({ request }) {
	try {
		const { tiles } = await request.json();

		if (!tiles || !Array.isArray(tiles)) {
			return json({ error: 'Invalid tiles data' }, { status: 400 });
		}

		// First, clear all existing tiles
		const { error: clearError } = await supabaseAdmin
			.from('dgr_promo_tiles')
			.delete()
			.neq('id', 0); // Delete all rows

		if (clearError) {
			console.error('Error clearing tiles:', clearError);
			throw clearError;
		}

		// Then insert the new tiles
		if (tiles.length > 0) {
			const tilesToInsert = tiles.map(tile => ({
				position: tile.position,
				image_url: tile.image_url || '',
				title: tile.title || '',
				link_url: tile.link_url || '',
				active: true
			}));

			const { error: insertError } = await supabaseAdmin
				.from('dgr_promo_tiles')
				.insert(tilesToInsert);

			if (insertError) {
				console.error('Error inserting tiles:', insertError);
				throw insertError;
			}
		}

		return json({ success: true, message: 'Promo tiles updated successfully' });
	} catch (error) {
		console.error('Failed to update promo tiles:', error);
		return json({ error: error.message || 'Failed to update promo tiles' }, { status: 500 });
	}
}