import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * POST /api/dgr/liturgical-calendar/update
 * Update a single calendar entry
 */
export async function POST({ request }) {
	try {
		const entry = await request.json();

		const { error } = await supabaseAdmin
			.from('ordo_calendar')
			.update({
				liturgical_name: entry.liturgical_name,
				liturgical_rank: entry.liturgical_rank,
				liturgical_season: entry.liturgical_season,
				liturgical_week: entry.liturgical_week ? parseInt(entry.liturgical_week) : null
			})
			.eq('calendar_date', entry.calendar_date);

		if (error) throw error;

		return json({ success: true });
	} catch (error) {
		console.error('Update error:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
