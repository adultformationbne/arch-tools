import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getReadingsForEntry, flattenReadingsData } from '$lib/server/dgr-readings.js';

/**
 * POST /api/dgr/readings
 * Fetches lectionary readings for a date.
 *
 * NEW BEHAVIOR (liturgical calendar as SSOT):
 * - Pending entries: always fetch fresh from lectionary (mapping fixes reflected)
 * - Non-pending entries with readings_data: return snapshot (preserves what contributor saw)
 *
 * Body: { date: '2025-10-14', schedule_id?: 'uuid', contributor_id?: 'uuid' }
 */
export async function POST({ request }) {
	try {
		const { date, schedule_id, contributor_id } = await request.json();

		if (!date) {
			return json({ error: 'Date is required' }, { status: 400 });
		}

		// If we have a schedule_id, use the helper to get readings based on status
		if (schedule_id) {
			const { data: existingSchedule, error: fetchError } = await supabaseAdmin
				.from('dgr_schedule')
				.select('id, status, readings_data, gospel_reference, liturgical_date, date')
				.eq('id', schedule_id)
				.single();

			if (fetchError && fetchError.code !== 'PGRST116') {
				throw fetchError;
			}

			if (existingSchedule) {
				// Use helper: pending = fresh from lectionary, non-pending = snapshot
				const { readingsData, reading, source } = await getReadingsForEntry(existingSchedule);

				if (reading) {
					return json({
						success: true,
						schedule: existingSchedule,
						readings: reading,
						source // 'snapshot' or 'lectionary' - useful for debugging
					});
				}
			}
		}

		// Fetch readings from lectionary using the database function
		const { data: readings, error: readingsError } = await supabaseAdmin.rpc(
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

		// If we have schedule_id, update existing (only if readings_data was empty - checked above)
		if (schedule_id) {
			const { data: updated, error: updateError } = await supabaseAdmin
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
		const { data: existing } = await supabaseAdmin
			.from('dgr_schedule')
			.select('id, status, contributor_id, readings_data, liturgical_date, date')
			.eq('date', date)
			.maybeSingle();

		if (existing) {
			// Use helper: pending = fresh from lectionary, non-pending = snapshot
			const { readingsData: existingReadings, reading: existingReading, source } = await getReadingsForEntry(existing);

			// For non-pending with existing snapshot, return as-is
			if (source === 'snapshot') {
				return json({
					success: true,
					schedule: existing,
					readings: existingReading,
					source
				});
			}

			// For pending (or empty snapshot), update with fresh lectionary data
			const updateData = {
				liturgical_date: scheduleData.liturgical_date,
				// Don't populate readings_data for pending - let it stay null until submit
				// readings_data: scheduleData.readings_data,
				gospel_reference: scheduleData.gospel_reference,
				updated_at: new Date().toISOString()
			};

			// Only update contributor if provided and different
			if (contributor_id && contributor_id !== existing.contributor_id) {
				updateData.contributor_id = contributor_id;

				// Get contributor email
				const { data: contributor } = await supabaseAdmin
					.from('dgr_contributors')
					.select('email')
					.eq('id', contributor_id)
					.single();

				if (contributor) {
					updateData.contributor_email = contributor.email;
				}
			}

			const { data: updated, error: updateError } = await supabaseAdmin
				.from('dgr_schedule')
				.update(updateData)
				.eq('id', existing.id)
				.select()
				.single();

			if (updateError) throw updateError;

			return json({
				success: true,
				schedule: updated,
				readings: reading, // Fresh from lectionary
				source: 'lectionary'
			});
		}

		// Create new entry (only if doesn't exist)
		// Don't populate readings_data - keep null until submit (SSOT pattern)
		const newEntryData = {
			date,
			liturgical_date: reading.liturgical_day,
			gospel_reference: reading.gospel_reading, // Backward compatibility only
			status: 'pending'
		};

		if (contributor_id) {
			newEntryData.contributor_id = contributor_id;

			// Get contributor email
			const { data: contributor } = await supabaseAdmin
				.from('dgr_contributors')
				.select('email')
				.eq('id', contributor_id)
				.single();

			if (contributor) {
				newEntryData.contributor_email = contributor.email;
			}
		}

		const { data: created, error: createError } = await supabaseAdmin
			.from('dgr_schedule')
			.insert(newEntryData)
			.select()
			.single();

		if (createError) throw createError;

		return json({
			success: true,
			schedule: created,
			readings: reading, // Fresh from lectionary
			source: 'lectionary'
		});
	} catch (error) {
		console.error('Readings API error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
