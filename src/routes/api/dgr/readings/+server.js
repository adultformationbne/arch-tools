import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

/**
 * POST /api/dgr/readings
 * Fetches lectionary readings for a date and updates/creates the schedule entry
 * Body: { date: '2025-10-14', schedule_id?: 'uuid', contributor_id?: 'uuid' }
 */
export async function POST({ request }) {
	try {
		const { date, schedule_id, contributor_id } = await request.json();

		if (!date) {
			return json({ error: 'Date is required' }, { status: 400 });
		}

		// Fetch readings from lectionary using the database function
		const { data: readings, error: readingsError } = await supabase.rpc(
			'get_readings_for_date',
			{ target_date: date }
		);

		if (readingsError) {
			console.error('Failed to fetch readings:', readingsError);
			return json({ error: 'Failed to fetch readings from lectionary' }, { status: 500 });
		}

		if (!readings || readings.length === 0) {
			return json({ error: 'No readings found for this date' }, { status: 404 });
		}

		const reading = readings[0];

		// Build readings_data JSONB structure matching Universalis format
		const readings_data = {
			combined_sources: [
				reading.first_reading,
				reading.psalm,
				reading.second_reading,
				reading.gospel_reading
			]
				.filter(Boolean)
				.join('; '),
			first_reading: reading.first_reading
				? {
						source: reading.first_reading,
						text: '',
						heading: ''
					}
				: null,
			psalm: reading.psalm
				? {
						source: reading.psalm,
						text: ''
					}
				: null,
			second_reading: reading.second_reading
				? {
						source: reading.second_reading,
						text: '',
						heading: ''
					}
				: null,
			gospel: reading.gospel_reading
				? {
						source: reading.gospel_reading,
						text: '',
						heading: ''
					}
				: null
		};

		// Upsert schedule entry with readings
		const scheduleData = {
			date,
			liturgical_date: reading.liturgical_day,
			readings_data,
			gospel_reference: reading.gospel_reading // Backward compatibility
		};

		// If we have schedule_id, update existing
		if (schedule_id) {
			const { data: updated, error: updateError } = await supabase
				.from('dgr_schedule')
				.update({
					liturgical_date: scheduleData.liturgical_date,
					readings_data: scheduleData.readings_data,
					gospel_reference: scheduleData.gospel_reference,
					updated_at: new Date().toISOString()
				})
				.eq('id', schedule_id)
				.select()
				.single();

			if (updateError) throw updateError;

			return json({
				success: true,
				schedule: updated,
				readings: reading
			});
		}

		// Check if schedule entry already exists for this date
		const { data: existing } = await supabase
			.from('dgr_schedule')
			.select('id, contributor_id')
			.eq('date', date)
			.maybeSingle();

		if (existing) {
			// Update existing entry
			const updateData = {
				liturgical_date: scheduleData.liturgical_date,
				readings_data: scheduleData.readings_data,
				gospel_reference: scheduleData.gospel_reference,
				updated_at: new Date().toISOString()
			};

			// Only update contributor if provided and different
			if (contributor_id && contributor_id !== existing.contributor_id) {
				updateData.contributor_id = contributor_id;

				// Get contributor email
				const { data: contributor } = await supabase
					.from('dgr_contributors')
					.select('email')
					.eq('id', contributor_id)
					.single();

				if (contributor) {
					updateData.contributor_email = contributor.email;
				}
			}

			const { data: updated, error: updateError } = await supabase
				.from('dgr_schedule')
				.update(updateData)
				.eq('id', existing.id)
				.select()
				.single();

			if (updateError) throw updateError;

			return json({
				success: true,
				schedule: updated,
				readings: reading
			});
		}

		// Create new entry (only if doesn't exist)
		if (contributor_id) {
			scheduleData.contributor_id = contributor_id;

			// Get contributor email
			const { data: contributor } = await supabase
				.from('dgr_contributors')
				.select('email')
				.eq('id', contributor_id)
				.single();

			if (contributor) {
				scheduleData.contributor_email = contributor.email;
			}

			scheduleData.status = 'pending';
		}

		const { data: created, error: createError } = await supabase
			.from('dgr_schedule')
			.insert(scheduleData)
			.select()
			.single();

		if (createError) throw createError;

		return json({
			success: true,
			schedule: created,
			readings: reading
		});
	} catch (error) {
		console.error('Readings API error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
