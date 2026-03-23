import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async (event) => {
	await requireModule(event, 'cardpacks', {
		mode: 'redirect',
		redirectTo: '/login?error=insufficient_permissions'
	});

	// Load all packs (master list) with their cards
	const { data: packs } = await supabaseAdmin
		.from('cardpack_packs')
		.select('*, cardpack_cards(*)')
		.order('created_at', { ascending: false });

	return {
		packs: packs ?? []
	};
};
