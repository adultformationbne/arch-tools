import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * GET /api/dgr/liturgical-calendar
 * Fetch calendar entries for a specific year
 */
export async function GET({ url }) {
	try {
		const year = parseInt(url.searchParams.get('year') || new Date().getFullYear());

		const { data: calendar, error } = await supabaseAdmin
			.from('ordo_calendar')
			.select(`
				calendar_date,
				liturgical_year,
				liturgical_season,
				liturgical_week,
				liturgical_name,
				liturgical_rank,
				year_cycle
			`)
			.eq('liturgical_year', year)
			.order('calendar_date');

		if (error) throw error;

		// Enrich with readings data
		const enriched = await Promise.all(
			calendar.map(async (entry) => {
				const { data: readings } = await supabaseAdmin.rpc('get_readings_for_date', {
					target_date: entry.calendar_date
				});

				return {
					...entry,
					gospel_reading: readings?.[0]?.gospel_reading || null,
					first_reading: readings?.[0]?.first_reading || null,
					psalm: readings?.[0]?.psalm || null,
					second_reading: readings?.[0]?.second_reading || null
				};
			})
		);

		return json({ success: true, calendar: enriched });
	} catch (error) {
		console.error('Failed to fetch calendar:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
