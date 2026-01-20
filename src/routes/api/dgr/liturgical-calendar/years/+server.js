import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * GET /api/dgr/liturgical-calendar/years
 * Get list of available years in the ordo_calendar
 */
export async function GET() {
	try {
		const { data, error} = await supabaseAdmin
			.from('ordo_calendar')
			.select('liturgical_year')
			.order('liturgical_year');

		if (error) throw error;

		// Get unique years
		const years = [...new Set(data.map(row => row.liturgical_year))].sort();

		return json({ success: true, years });
	} catch (error) {
		console.error('Failed to fetch years:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
