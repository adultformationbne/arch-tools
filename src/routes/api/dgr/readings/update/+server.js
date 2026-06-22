import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * POST /api/dgr/readings/update
 * Updates the readings for a schedule entry
 * Body: { schedule_id, first_reading, psalm, second_reading, gospel_reading }
 *
 * Guard against blank overwrites: a blank/missing incoming field does NOT wipe an
 * existing reference. We only overwrite a reading when a non-empty value is posted,
 * otherwise the currently stored reading is preserved. This prevents an empty edit
 * form (or a save before readings finished loading) from nulling out the first
 * reading / psalm while the gospel survives.
 */
export async function POST({ request }) {
	try {
		const { schedule_id, first_reading, psalm, second_reading, gospel_reading } = await request.json();

		if (!schedule_id) {
			return json({ error: 'Schedule ID is required' }, { status: 400 });
		}

		// Load the current snapshot so blank incoming fields fall back to stored values
		const { data: existing, error: fetchError } = await supabaseAdmin
			.from('dgr_schedule')
			.select('readings_data')
			.eq('id', schedule_id)
			.single();

		if (fetchError) throw fetchError;

		const current = existing?.readings_data || {};

		// Build a reading object from a posted value, falling back to the existing
		// object (preserving any stored text/heading) when the posted value is blank.
		const resolve = (incoming, existingObj, withHeading) => {
			const trimmed = typeof incoming === 'string' ? incoming.trim() : incoming;
			if (trimmed) {
				return withHeading
					? { source: trimmed, text: '', heading: '' }
					: { source: trimmed, text: '' };
			}
			return existingObj || null;
		};

		const firstObj = resolve(first_reading, current.first_reading, true);
		const psalmObj = resolve(psalm, current.psalm, false);
		const secondObj = resolve(second_reading, current.second_reading, true);
		const gospelObj = resolve(gospel_reading, current.gospel, true);

		const readings_data = {
			combined_sources: [firstObj?.source, psalmObj?.source, secondObj?.source, gospelObj?.source]
				.filter(Boolean)
				.join('; '),
			first_reading: firstObj,
			psalm: psalmObj,
			second_reading: secondObj,
			gospel: gospelObj
		};

		const { data: updated, error: updateError } = await supabaseAdmin
			.from('dgr_schedule')
			.update({
				readings_data,
				gospel_reference: gospelObj?.source || null,
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
