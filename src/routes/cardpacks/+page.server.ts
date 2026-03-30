import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async (event) => {
	await requireModule(event, 'cardpacks', {
		mode: 'redirect',
		redirectTo: '/login?error=insufficient_permissions'
	});

	const { data: packs } = await supabaseAdmin
		.from('cardpack_packs')
		.select('*, cardpack_cards(*, cardpack_card_labels(label_id)), cardpack_labels(*)')
		.order('created_at', { ascending: false });

	return {
		packs: packs ?? []
	};
};
