import { json, error } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function POST(event) {
	await requireModule(event, 'cardpacks');
	const { packId, content, color } = await event.request.json();

	if (!packId) {
		throw error(400, 'Pack ID is required');
	}
	if (!content?.trim()) {
		throw error(400, 'Card content is required');
	}

	// Verify pack exists
	const { data: pack } = await supabaseAdmin
		.from('cardpack_packs')
		.select('id')
		.eq('id', packId)
		.single();

	if (!pack) {
		throw error(404, 'Card pack not found');
	}

	// Get next sort order
	const { data: lastCard } = await supabaseAdmin
		.from('cardpack_cards')
		.select('sort_order')
		.eq('pack_id', packId)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();

	const sortOrder = (lastCard?.sort_order ?? -1) + 1;

	const { data: card, error: insertError } = await supabaseAdmin
		.from('cardpack_cards')
		.insert({
			pack_id: packId,
			content: content.trim(),
			color: color || 'gray',
			sort_order: sortOrder
		})
		.select()
		.single();

	if (insertError) {
		throw error(500, 'Failed to create card');
	}

	return json({ card });
}

export async function DELETE(event) {
	await requireModule(event, 'cardpacks');
	const { cardId } = await event.request.json();

	if (!cardId) {
		throw error(400, 'Card ID is required');
	}

	const { error: deleteError } = await supabaseAdmin
		.from('cardpack_cards')
		.delete()
		.eq('id', cardId);

	if (deleteError) {
		throw error(500, 'Failed to delete card');
	}

	return json({ success: true });
}
