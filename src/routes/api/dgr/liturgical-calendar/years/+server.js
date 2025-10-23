import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * GET /api/dgr/liturgical-calendar/years
 * Get list of available years in the ordo_calendar
 */
export async function GET() {
	try {
		const { data, error} = await supabase
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
