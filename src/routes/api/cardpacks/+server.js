import { json, error } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function GET(event) {
	await requireModule(event, 'cardpacks');

	const { data: packs, error: fetchError } = await supabaseAdmin
		.from('cardpack_packs')
		.select('*, cardpack_cards(*)')
		.order('created_at', { ascending: false });

	if (fetchError) {
		throw error(500, 'Failed to fetch card packs');
	}

	return json({ packs });
}

export async function POST(event) {
	const { user } = await requireModule(event, 'cardpacks');
	const { title, description } = await event.request.json();

	if (!title?.trim()) {
		throw error(400, 'Title is required');
	}

	const { data: pack, error: insertError } = await supabaseAdmin
		.from('cardpack_packs')
		.insert({
			title: title.trim(),
			description: description?.trim() || null,
			created_by: user.id
		})
		.select()
		.single();

	if (insertError) {
		throw error(500, 'Failed to create card pack');
	}

	return json({ pack: { ...pack, cardpack_cards: [] } });
}

export async function DELETE(event) {
	await requireModule(event, 'cardpacks');
	const { packId } = await event.request.json();

	if (!packId) {
		throw error(400, 'Pack ID is required');
	}

	const { data: existing } = await supabaseAdmin
		.from('cardpack_packs')
		.select('id')
		.eq('id', packId)
		.single();

	if (!existing) {
		throw error(404, 'Card pack not found');
	}

	const { error: deleteError } = await supabaseAdmin
		.from('cardpack_packs')
		.delete()
		.eq('id', packId);

	if (deleteError) {
		throw error(500, 'Failed to delete card pack');
	}

	return json({ success: true });
}
