import { json, error } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function POST(event) {
	await requireModule(event, 'cardpacks');
	const { packId, name, color } = await event.request.json();

	if (!packId) throw error(400, 'Pack ID is required');
	if (!name?.trim()) throw error(400, 'Label name is required');

	const { data: lastLabel } = await supabaseAdmin
		.from('cardpack_labels')
		.select('sort_order')
		.eq('pack_id', packId)
		.order('sort_order', { ascending: false })
		.limit(1)
		.maybeSingle();

	const sortOrder = (lastLabel?.sort_order ?? -1) + 1;

	const { data: label, error: insertError } = await supabaseAdmin
		.from('cardpack_labels')
		.insert({
			pack_id: packId,
			name: name.trim(),
			color: color || 'blue',
			sort_order: sortOrder
		})
		.select()
		.single();

	if (insertError) throw error(500, 'Failed to create label');

	return json({ label });
}

export async function DELETE(event) {
	await requireModule(event, 'cardpacks');
	const { labelId } = await event.request.json();

	if (!labelId) throw error(400, 'Label ID is required');

	const { error: deleteError } = await supabaseAdmin
		.from('cardpack_labels')
		.delete()
		.eq('id', labelId);

	if (deleteError) throw error(500, 'Failed to delete label');

	return json({ success: true });
}
