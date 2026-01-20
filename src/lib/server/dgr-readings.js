import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * DGR Readings Helper
 *
 * Implements the "liturgical calendar as SSOT" pattern:
 * - Pending rows: always fetch fresh from lectionary (so mapping fixes are reflected)
 * - Submitted/approved/published rows: use snapshotted readings_data (preserves what contributor saw)
 */

/**
 * Build readings_data JSONB structure from lectionary reading
 * @param {Object} reading - Raw lectionary reading from RPC
 * @returns {Object} readings_data structure
 */
export function buildReadingsData(reading) {
	if (!reading) return null;

	return {
		combined_sources: [
			reading.first_reading,
			reading.psalm,
			reading.second_reading,
			reading.gospel_reading
		]
			.filter(Boolean)
			.join('; '),
		first_reading: reading.first_reading
			? { source: reading.first_reading, text: '', heading: '' }
			: null,
		psalm: reading.psalm ? { source: reading.psalm, text: '' } : null,
		second_reading: reading.second_reading
			? { source: reading.second_reading, text: '', heading: '' }
			: null,
		gospel: reading.gospel_reading
			? { source: reading.gospel_reading, text: '', heading: '' }
			: null
	};
}

/**
 * Convert readings_data to flat reading format (for API responses)
 * @param {Object} readingsData - readings_data JSONB
 * @param {string} liturgicalDate - liturgical_date field
 * @returns {Object} Flat reading object
 */
export function flattenReadingsData(readingsData, liturgicalDate = null) {
	if (!readingsData) return null;

	return {
		first_reading: readingsData.first_reading?.source || null,
		psalm: readingsData.psalm?.source || null,
		second_reading: readingsData.second_reading?.source || null,
		gospel_reading: readingsData.gospel?.source || null,
		liturgical_day: liturgicalDate
	};
}

/**
 * Fetch fresh readings from lectionary for a date
 * @param {string} date - Date string (YYYY-MM-DD)
 * @returns {Promise<{reading: Object|null, readingsData: Object|null}>}
 */
export async function fetchFromLectionary(date) {
	const { data: readings, error } = await supabaseAdmin.rpc('get_readings_for_date', {
		target_date: date
	});

	if (error) {
		console.error('Failed to fetch readings from lectionary:', error);
		return { reading: null, readingsData: null };
	}

	if (!readings || readings.length === 0) {
		return { reading: null, readingsData: null };
	}

	const reading = readings[0];
	const readingsData = buildReadingsData(reading);

	return { reading, readingsData };
}

/**
 * Get readings for a schedule entry, respecting the SSOT pattern:
 * - Pending: fetch fresh from lectionary (mapping fixes reflected)
 * - Non-pending with readings_data: use snapshot (preserves what contributor saw)
 * - Non-pending without readings_data: fetch from lectionary as fallback
 *
 * @param {Object} entry - Schedule entry with at least: date, status, readings_data, liturgical_date
 * @param {Object} options
 * @param {boolean} options.forceFresh - Always fetch from lectionary (for preview/debug)
 * @returns {Promise<{readingsData: Object|null, reading: Object|null, source: 'snapshot'|'lectionary'}>}
 */
export async function getReadingsForEntry(entry, options = {}) {
	const { forceFresh = false } = options;

	// Non-pending with existing snapshot: use it (unless forceFresh)
	if (!forceFresh && entry.status !== 'pending' && entry.readings_data && Object.keys(entry.readings_data).length > 0) {
		return {
			readingsData: entry.readings_data,
			reading: flattenReadingsData(entry.readings_data, entry.liturgical_date),
			source: 'snapshot'
		};
	}

	// Pending OR no snapshot: fetch fresh from lectionary
	const { reading, readingsData } = await fetchFromLectionary(entry.date);

	return {
		readingsData,
		reading: reading
			? {
					first_reading: reading.first_reading,
					psalm: reading.psalm,
					second_reading: reading.second_reading,
					gospel_reading: reading.gospel_reading,
					liturgical_day: reading.liturgical_day
				}
			: null,
		source: 'lectionary'
	};
}

/**
 * Snapshot readings for an entry (call this when status changes to 'submitted')
 * Only snapshots if readings_data is currently empty
 *
 * @param {string} scheduleId - Schedule entry ID
 * @param {string} date - Date for fetching readings
 * @returns {Promise<{success: boolean, readingsData: Object|null, error: string|null}>}
 */
export async function snapshotReadingsOnSubmit(scheduleId, date) {
	// First check current state
	const { data: entry, error: fetchError } = await supabaseAdmin
		.from('dgr_schedule')
		.select('readings_data, liturgical_date')
		.eq('id', scheduleId)
		.single();

	if (fetchError) {
		return { success: false, readingsData: null, error: fetchError.message };
	}

	// If already has readings_data, don't overwrite (preserves manual edits)
	if (entry.readings_data && Object.keys(entry.readings_data).length > 0) {
		return { success: true, readingsData: entry.readings_data, error: null };
	}

	// Fetch from lectionary and snapshot
	const { reading, readingsData } = await fetchFromLectionary(date);

	if (!readingsData) {
		// No readings found - this is okay, just means no lectionary entry
		return { success: true, readingsData: null, error: null };
	}

	// Update the entry with snapshotted readings
	const { error: updateError } = await supabaseAdmin
		.from('dgr_schedule')
		.update({
			readings_data: readingsData,
			gospel_reference: reading?.gospel_reading || null,
			liturgical_date: reading?.liturgical_day || entry.liturgical_date,
			updated_at: new Date().toISOString()
		})
		.eq('id', scheduleId);

	if (updateError) {
		return { success: false, readingsData: null, error: updateError.message };
	}

	return { success: true, readingsData, error: null };
}

/**
 * Batch fetch readings from lectionary for multiple dates (single query)
 * @param {string[]} dates - Array of date strings (YYYY-MM-DD)
 * @returns {Promise<Map<string, {reading: Object, readingsData: Object}>>}
 */
async function batchFetchFromLectionary(dates) {
	const results = new Map();

	if (dates.length === 0) return results;

	// Single query: join ordo_lectionary_mapping -> lectionary for all dates
	const { data, error } = await supabaseAdmin
		.from('ordo_lectionary_mapping')
		.select(`
			calendar_date,
			lectionary:lectionary!inner (
				liturgical_day,
				first_reading,
				psalm,
				second_reading,
				gospel_reading
			)
		`)
		.in('calendar_date', dates);

	if (error) {
		console.error('Batch lectionary fetch error:', error);
		return results;
	}

	for (const row of data || []) {
		const reading = row.lectionary;
		const readingsData = buildReadingsData(reading);
		results.set(row.calendar_date, { reading, readingsData });
	}

	return results;
}

/**
 * Batch get readings for multiple entries (efficient for schedule views)
 * Uses single query for all pending dates instead of N individual queries
 *
 * @param {Array} entries - Array of schedule entries
 * @returns {Promise<Map<string, {readingsData: Object, reading: Object, source: string}>>}
 */
export async function getReadingsForEntries(entries) {
	const results = new Map();
	const pendingDates = [];
	const pendingEntries = [];

	// First pass: identify which dates need lectionary lookup
	for (const entry of entries) {
		const key = entry.id || entry.date;

		if (entry.status !== 'pending' && entry.readings_data && Object.keys(entry.readings_data).length > 0) {
			// Use snapshot
			results.set(key, {
				readingsData: entry.readings_data,
				reading: flattenReadingsData(entry.readings_data, entry.liturgical_date),
				source: 'snapshot'
			});
		} else {
			// Need lectionary lookup
			pendingDates.push(entry.date);
			pendingEntries.push(entry);
		}
	}

	// Single batch query for all pending dates
	const lectionaryCache = await batchFetchFromLectionary([...new Set(pendingDates)]);

	// Second pass: fill in pending entries from cache
	for (const entry of pendingEntries) {
		const key = entry.id || entry.date;
		const cached = lectionaryCache.get(entry.date);

		if (cached) {
			results.set(key, {
				readingsData: cached.readingsData,
				reading: cached.reading
					? {
							first_reading: cached.reading.first_reading,
							psalm: cached.reading.psalm,
							second_reading: cached.reading.second_reading,
							gospel_reading: cached.reading.gospel_reading,
							liturgical_day: cached.reading.liturgical_day
						}
					: null,
				source: 'lectionary'
			});
		} else {
			results.set(key, { readingsData: null, reading: null, source: 'lectionary' });
		}
	}

	return results;
}
