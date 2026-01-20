import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getYearCycles } from '$lib/server/liturgical-rules.js';

/**
 * POST /api/dgr/liturgical-calendar/import
 * Import matched calendar entries into database
 *
 * Uses centralized liturgical-rules module to ensure correct year_cycle
 */
export async function POST({ request }) {
	try {
		const { year, entries } = await request.json();

		if (!entries || entries.length === 0) {
			return json({ success: false, error: 'No entries to import' }, { status: 400 });
		}

		// Prepare ordo_calendar entries with CORRECTED year_cycle from centralized module
		const ordoEntries = entries.map(e => {
			const date = new Date(e.calendar_date);
			const { sundayCycle, weekdayCycle } = getYearCycles(date);

			return {
				calendar_date: e.calendar_date,
				liturgical_year: e.liturgical_year,
				liturgical_season: e.liturgical_season,
				liturgical_week: e.liturgical_week ? parseInt(e.liturgical_week) : null,
				liturgical_name: e.liturgical_name,
				liturgical_rank: e.liturgical_rank,
				year_cycle: sundayCycle  // Always use centralized calculation
			};
		});

		// Prepare mapping entries
		const mappingEntries = entries
			.filter(e => e.lectionary_id)
			.map(e => ({
				calendar_date: e.calendar_date,
				lectionary_id: parseInt(e.lectionary_id),
				match_type: e.match_type,
				match_method: e.match_method
			}));

		// Import ordo_calendar
		const { error: ordoError } = await supabaseAdmin
			.from('ordo_calendar')
			.upsert(ordoEntries, { onConflict: 'calendar_date' });

		if (ordoError) throw ordoError;

		// Import mappings
		if (mappingEntries.length > 0) {
			const { error: mappingError } = await supabaseAdmin
				.from('ordo_lectionary_mapping')
				.upsert(mappingEntries, { onConflict: 'calendar_date' });

			if (mappingError) throw mappingError;
		}

		return json({
			success: true,
			imported: entries.length,
			year
		});
	} catch (error) {
		console.error('Import error:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
