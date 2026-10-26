import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { parseOrdoCsv, processOrdo } from '$lib/server/ordo-processor';

/**
 * POST /api/dgr/liturgical-calendar/upload
 * Match an uploaded Ordo CSV to the lectionary and return a preview (nothing is saved).
 *
 * All matching lives in $lib/server/ordo-processor — the same code scripts/process-ordo.ts runs.
 */
export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const year = parseInt(String(formData.get('year')), 10);

		if (!(file instanceof File)) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}
		if (!year) {
			return json({ success: false, error: 'No year provided' }, { status: 400 });
		}

		const rows = parseOrdoCsv(await file.text(), year);
		if (rows.length === 0) {
			return json(
				{
					success: false,
					error: 'No valid rows found. Dates must be DD/MM/YYYY, YYYY-MM-DD or "1 January".'
				},
				{ status: 400 }
			);
		}

		const { data: lectionary, error } = await supabaseAdmin.from('lectionary').select('*');
		if (error) throw error;

		return json({ success: true, results: processOrdo(rows, lectionary, year) });
	} catch (error) {
		console.error('Upload processing error:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}
