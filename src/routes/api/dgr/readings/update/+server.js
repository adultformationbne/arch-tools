import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * POST /api/dgr/readings/update
 * Updates the readings for a schedule entry
 * Body: { schedule_id, first_reading, psalm, second_reading, gospel_reading }
 */
export async function POST({ request }) {
	try {
		const { schedule_id, first_reading, psalm, second_reading, gospel_reading } = await request.json();

		if (!schedule_id) {
			return json({ error: 'Schedule ID is required' }, { status: 400 });
		}

		// Build readings_data JSONB structure
		const readings_data = {
			combined_sources: [first_reading, psalm, second_reading, gospel_reading]
				.filter(Boolean)
				.join('; '),
			first_reading: first_reading ? { source: first_reading, text: '', heading: '' } : null,
			psalm: psalm ? { source: psalm, text: '' } : null,
			second_reading: second_reading ? { source: second_reading, text: '', heading: '' } : null,
			gospel: gospel_reading ? { source: gospel_reading, text: '', heading: '' } : null
		};

		const { data: updated, error: updateError } = await supabaseAdmin
			.from('dgr_schedule')
			.update({
				readings_data,
				gospel_reference: gospel_reading,
				updated_at: new Date().toISOString()
			})
			.eq('id', schedule_id)
			.select()
			.single();

		if (updateError) throw updateError;

		return json({
			success: true,
			schedule: updated
		});
	} catch (error) {
		console.error('Update readings error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
