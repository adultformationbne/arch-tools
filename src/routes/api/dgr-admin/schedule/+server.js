import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { cleanGospelText, expandGospelReference } from '$lib/utils/dgr-common.js';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

/**
 * Fetch readings from database lectionary (not Universalis API)
 * Uses the same get_readings_for_date RPC function as /api/dgr/readings
 */
async function fetchReadingsFromDatabase(dateStr) {
	try {
		// Fetch readings from lectionary using the database function
		const { data: readings, error: readingsError } = await supabase.rpc(
			'get_readings_for_date',
			{ target_date: dateStr }
		);

		if (readingsError) {
			console.error('Failed to fetch readings from database:', readingsError);
			return null;
		}

		if (!readings || readings.length === 0) {
			console.warn('No readings found in database for date:', dateStr);
			return null;
		}

		const reading = readings[0];

		// Build readings_data JSONB structure
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

		return {
			readings: readings_data,
			liturgicalDate: reading.liturgical_day || '',
			reference: reading.gospel_reading || '' // Backward compatibility
		};
	} catch (error) {
		console.error('Error fetching readings from database:', error);
		return null;
	}
}

export async function GET({ url, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const days = parseInt(url.searchParams.get('days') || '90');
	const status = url.searchParams.get('status');

	try {
		const startDate = new Date().toISOString().split('T')[0];
		const endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

		// 1. Fetch calendar with readings using ordo tables
		const { data: calendarData, error: calendarError } = await supabase
			.from('ordo_calendar')
			.select(`
				calendar_date,
				liturgical_name,
				liturgical_rank,
				liturgical_season,
				liturgical_week,
				ordo_lectionary_mapping!left (
					lectionary!left (
						first_reading,
						psalm,
						second_reading,
						gospel_reading
					)
				)
			`)
			.gte('calendar_date', startDate)
			.lte('calendar_date', endDate)
			.order('calendar_date', { ascending: true });

		if (calendarError) {
			console.error('Failed to fetch calendar data:', calendarError);
			throw calendarError;
		}

		// 2. Fetch actual schedule entries (rows only exist when activity has occurred)
		let scheduleQuery = supabase
			.from('dgr_schedule')
			.select(
				`
				*,
				contributor:dgr_contributors(name, email, access_token, schedule_pattern)
			`
			)
			.gte('date', startDate)
			.lte('date', endDate);

		if (status) {
			scheduleQuery = scheduleQuery.eq('status', status);
		}

		const { data: scheduleEntries, error: scheduleError } = await scheduleQuery;

		if (scheduleError) throw scheduleError;

		// Create schedule lookup map
		const scheduleMap = new Map();
		scheduleEntries.forEach((entry) => {
			scheduleMap.set(entry.date, entry);
		});

		// 3. Fetch assignment rules
		const { data: rules, error: rulesError } = await supabase
			.from('dgr_assignment_rules')
			.select('*')
			.eq('active', true)
			.order('priority', { ascending: true });

		if (rulesError) {
			console.error('Failed to fetch assignment rules:', rulesError);
		}

		// Build calendar season lookup for rule checking
		const calendarSeasonMap = new Map();
		calendarData.forEach((cal) => {
			calendarSeasonMap.set(cal.calendar_date, {
				season: cal.liturgical_season,
				rank: cal.liturgical_rank,
				name: cal.liturgical_name
			});
		});

		// Check if a date should skip patterns based on rules
		function shouldSkipPattern(date) {
			const calInfo = calendarSeasonMap.get(date);
			if (!calInfo || !rules) return false;

			for (const rule of rules) {
				if (rule.action_type !== 'skip_pattern') continue;

				// Check season condition
				if (rule.condition_season && calInfo.season) {
					if (calInfo.season.toLowerCase() === rule.condition_season.toLowerCase()) {
						return true;
					}
				}

				// Check day type condition
				if (rule.condition_day_type && calInfo.rank) {
					if (calInfo.rank.toLowerCase().includes(rule.condition_day_type.toLowerCase())) {
						return true;
					}
				}

				// Check liturgical day name contains
				if (rule.condition_liturgical_day_contains && calInfo.name) {
					if (calInfo.name.toLowerCase().includes(rule.condition_liturgical_day_contains.toLowerCase())) {
						return true;
					}
				}
			}

			return false;
		}

		// 4. Fetch contributors with patterns (for virtual assignments)
		const { data: contributors, error: contribError } = await supabase
			.from('dgr_contributors')
			.select('id, name, email, access_token, schedule_pattern')
			.eq('active', true);

		if (contribError) throw contribError;

		// Build pattern lookup: date -> contributor (respecting rules)
		const patternMap = new Map();
		contributors.forEach((contrib) => {
			if (!contrib.schedule_pattern || !contrib.schedule_pattern.type) return;

			const pattern = contrib.schedule_pattern;
			const dates = calculatePatternDates(pattern, startDate, endDate);

			dates.forEach((date) => {
				// Skip if rules say to skip patterns for this date
				if (shouldSkipPattern(date)) return;

				// Only set if no pattern already exists for this date
				if (!patternMap.has(date)) {
					patternMap.set(date, {
						id: contrib.id,
						name: contrib.name,
						email: contrib.email,
						access_token: contrib.access_token,
						pattern_type: pattern.type,
						pattern_value: pattern.value
					});
				}
			});
		});

		// 4. Build calendar-first response
		const calendar = calendarData.map((cal) => {
			const date = cal.calendar_date;
			const scheduleEntry = scheduleMap.get(date) || null;
			const patternContributor = patternMap.get(date) || null;

			// Extract readings from nested join
			const lectionary = cal.ordo_lectionary_mapping?.lectionary;
			const readings = lectionary ? {
				first_reading: lectionary.first_reading,
				psalm: lectionary.psalm,
				second_reading: lectionary.second_reading,
				gospel: lectionary.gospel_reading
			} : null;

			return {
				date,
				liturgical_day: cal.liturgical_name,
				liturgical_season: cal.liturgical_season,
				liturgical_week: cal.liturgical_week,
				liturgical_rank: cal.liturgical_rank,
				readings,
				// Actual schedule row (null if no activity yet)
				schedule: scheduleEntry
					? {
							id: scheduleEntry.id,
							contributor_id: scheduleEntry.contributor_id,
							contributor: scheduleEntry.contributor,
							status: scheduleEntry.status,
							submission_token: scheduleEntry.submission_token,
							reflection_title: scheduleEntry.reflection_title,
							reflection_content: scheduleEntry.reflection_content,
							gospel_quote: scheduleEntry.gospel_quote,
							gospel_reference: scheduleEntry.gospel_reference,
							readings_data: scheduleEntry.readings_data,
							liturgical_date: scheduleEntry.liturgical_date,
							reminder_history: scheduleEntry.reminder_history,
							approved_at: scheduleEntry.approved_at,
							published_at: scheduleEntry.published_at,
							created_at: scheduleEntry.created_at,
							updated_at: scheduleEntry.updated_at
						}
					: null,
				// Virtual pattern-based contributor (shown in UI but no row exists)
				pattern_contributor: patternContributor
			};
		});

		return json({ calendar });
	} catch (error) {
		console.error('Schedule fetch error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

// Helper function to calculate dates from pattern
// Supports both single value and array of values
function calculatePatternDates(pattern, startDate, endDate) {
	const dates = [];

	// Parse dates as UTC to avoid timezone issues
	const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
	const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
	const start = new Date(Date.UTC(startYear, startMonth - 1, startDay));
	const end = new Date(Date.UTC(endYear, endMonth - 1, endDay));

	// Support both 'value' (single) and 'values' (array) for backward compatibility
	const getValues = (pattern) => {
		if (pattern.values && Array.isArray(pattern.values)) {
			return pattern.values;
		}
		if (pattern.value !== undefined) {
			return [pattern.value];
		}
		return [];
	};

	// Helper to format date as YYYY-MM-DD
	const formatDate = (d) => {
		const year = d.getUTCFullYear();
		const month = String(d.getUTCMonth() + 1).padStart(2, '0');
		const day = String(d.getUTCDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	if (pattern.type === 'day_of_month') {
		const daysOfMonth = getValues(pattern);

		for (const dayOfMonth of daysOfMonth) {
			const current = new Date(start);

			while (current <= end) {
				// Check if this day exists in this month (e.g., 31st doesn't exist in Feb)
				const lastDayOfMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0)).getUTCDate();

				if (dayOfMonth <= lastDayOfMonth) {
					const testDate = new Date(Date.UTC(
						current.getUTCFullYear(),
						current.getUTCMonth(),
						dayOfMonth
					));

					if (testDate >= start && testDate <= end) {
						dates.push(formatDate(testDate));
					}
				}

				// Move to next month
				current.setUTCMonth(current.getUTCMonth() + 1);
			}
		}
	} else if (pattern.type === 'day_of_week') {
		const targetDays = getValues(pattern); // 0=Sunday, 6=Saturday
		const current = new Date(start);

		while (current <= end) {
			if (targetDays.includes(current.getUTCDay())) {
				dates.push(formatDate(current));
			}
			current.setUTCDate(current.getUTCDate() + 1);
		}
	}

	// Sort and deduplicate
	return [...new Set(dates)].sort();
}

export async function POST({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { action, ...data } = await request.json();

		switch (action) {
			case 'update_assignment':
				return await updateAssignment(data);
			case 'assign_contributor':
				return await assignContributor(data);
			case 'approve_reflection':
				return await approveReflection(data);
			case 'update_status':
				return await updateStatus(data);
			case 'create_with_status':
				return await createWithStatus(data);
			case 'update_readings':
				return await updateReadings(data);
			case 'clear_reflection':
				return await clearReflection(data);
			case 'send_to_wordpress':
				return await sendToWordPress(data);
			case 'save_reflection':
				return await saveReflection(data);
			default:
				return json({ error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		console.error('Schedule API error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

/**
 * Create a new schedule entry for a date with a contributor assignment.
 * Used when admin manually assigns a contributor to a calendar date.
 */
async function assignContributor({ date, contributorId }) {
	try {
		// Check if entry already exists for this date
		const { data: existing } = await supabase
			.from('dgr_schedule')
			.select('id')
			.eq('date', date)
			.maybeSingle();

		if (existing) {
			// Update existing entry instead
			return await updateAssignment({ scheduleId: existing.id, contributorId });
		}

		// Get contributor details
		const { data: contributor } = await supabase
			.from('dgr_contributors')
			.select('email')
			.eq('id', contributorId)
			.single();

		if (!contributor) {
			throw new Error('Contributor not found');
		}

		// Generate submission token
		const { data: token } = await supabase.rpc('generate_submission_token');

		// Fetch readings from database lectionary
		const readingsData = await fetchReadingsFromDatabase(date);

		// Create schedule entry
		const scheduleEntry = {
			date,
			contributor_id: contributorId,
			contributor_email: contributor.email,
			submission_token: token,
			status: 'pending'
		};

		// Add readings if found
		if (readingsData) {
			scheduleEntry.gospel_reference = readingsData.reference;
			scheduleEntry.liturgical_date = readingsData.liturgicalDate;
			scheduleEntry.readings_data = readingsData.readings;
		}

		const { data, error } = await supabase
			.from('dgr_schedule')
			.insert(scheduleEntry)
			.select(`
				*,
				contributor:dgr_contributors(name, email, access_token, schedule_pattern)
			`)
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function updateAssignment({ scheduleId, contributorId }) {
	try {
		const { data: contributor } = await supabase
			.from('dgr_contributors')
			.select('email')
			.eq('id', contributorId)
			.single();

		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				contributor_id: contributorId,
				contributor_email: contributor?.email
			})
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function approveReflection({ scheduleId }) {
	try {
		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				status: 'approved',
				approved_at: new Date().toISOString()
			})
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function updateStatus({ scheduleId, status }) {
	try {
		// Validate status
		const validStatuses = ['pending', 'submitted', 'approved', 'published'];
		if (!validStatuses.includes(status)) {
			throw new Error('Invalid status value');
		}

		const updateData = { status };

		// Set timestamp based on status
		if (status === 'approved') {
			updateData.approved_at = new Date().toISOString();
		} else if (status === 'published') {
			updateData.published_at = new Date().toISOString();
		}

		const { data, error } = await supabase
			.from('dgr_schedule')
			.update(updateData)
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

/**
 * Create a new schedule entry with a specific status.
 * Used for pattern-based entries when status is changed in UI.
 */
async function createWithStatus({ date, contributorId, status }) {
	try {
		// Validate status
		const validStatuses = ['pending', 'submitted', 'approved', 'published'];
		if (!validStatuses.includes(status)) {
			throw new Error('Invalid status value');
		}

		// For new entries (pattern-based), only 'pending' makes sense
		// Can't mark as submitted/approved/published without content
		if (status !== 'pending') {
			throw new Error('Cannot set status to ' + status + ' without content. Assign the date first, then the contributor can submit.');
		}

		// Check if entry already exists for this date
		const { data: existing } = await supabase
			.from('dgr_schedule')
			.select('id')
			.eq('date', date)
			.maybeSingle();

		if (existing) {
			// Update existing entry instead
			return await updateStatus({ scheduleId: existing.id, status });
		}

		// Get contributor details if provided
		let contributor = null;
		if (contributorId) {
			const { data: contrib } = await supabase
				.from('dgr_contributors')
				.select('email')
				.eq('id', contributorId)
				.single();
			contributor = contrib;
		}

		// Generate submission token
		const { data: token } = await supabase.rpc('generate_submission_token');

		// Fetch readings from database lectionary
		const readingsData = await fetchReadingsFromDatabase(date);

		// Create schedule entry
		const scheduleEntry = {
			date,
			contributor_id: contributorId || null,
			contributor_email: contributor?.email || null,
			submission_token: token,
			status
		};

		// Add readings if found
		if (readingsData) {
			scheduleEntry.gospel_reference = readingsData.reference;
			scheduleEntry.liturgical_date = readingsData.liturgicalDate;
			scheduleEntry.readings_data = readingsData.readings;
		}

		// Set timestamp based on status
		if (status === 'approved') {
			scheduleEntry.approved_at = new Date().toISOString();
		} else if (status === 'published') {
			scheduleEntry.published_at = new Date().toISOString();
		}

		const { data, error } = await supabase
			.from('dgr_schedule')
			.insert(scheduleEntry)
			.select(`
				*,
				contributor:dgr_contributors(name, email, access_token, schedule_pattern)
			`)
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function updateReadings({ scheduleId, readings }) {
	try {
		// Build the readings_data JSONB object
		const readingsData = {};

		if (readings.firstReading) {
			readingsData.first_reading = {
				source: readings.firstReading,
				text: '',
				heading: ''
			};
		}

		if (readings.psalm) {
			readingsData.psalm = {
				source: readings.psalm,
				text: ''
			};
		}

		if (readings.secondReading) {
			readingsData.second_reading = {
				source: readings.secondReading,
				text: '',
				heading: ''
			};
		}

		if (readings.gospel) {
			readingsData.gospel = {
				source: readings.gospel,
				text: '',
				heading: ''
			};
		}

		// Build combined_sources string
		const sources = [];
		if (readings.firstReading) sources.push(readings.firstReading);
		if (readings.psalm) sources.push(readings.psalm);
		if (readings.secondReading) sources.push(readings.secondReading);
		if (readings.gospel) sources.push(readings.gospel);
		readingsData.combined_sources = sources.join('; ');

		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				gospel_reference: readings.gospel || null, // Keep for backward compatibility
				readings_data: readingsData,
				updated_at: new Date().toISOString()
			})
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function saveReflection({
	scheduleId,
	contributorId,
	date,
	liturgicalDate,
	readings,
	title,
	gospelQuote,
	content,
	authorName,
	status,
	// Legacy parameters for backward compatibility
	id,
	reflection_title,
	gospel_quote,
	reflection_content
}) {
	try {
		// Handle legacy parameters
		if (id && !scheduleId) scheduleId = id;
		if (reflection_title && !title) title = reflection_title;
		if (gospel_quote && !gospelQuote) gospelQuote = gospel_quote;
		if (reflection_content && !content) content = reflection_content;

		// If scheduleId exists, update existing entry
		if (scheduleId) {
			const updateData = {
				reflection_title: title,
				gospel_quote: gospelQuote,
				reflection_content: content,
				updated_at: new Date().toISOString()
			};

			// Add optional fields if provided
			if (liturgicalDate) updateData.liturgical_date = liturgicalDate;
			if (status) updateData.status = status;
			if (status === 'approved') updateData.approved_at = new Date().toISOString();
			if (status === 'published') updateData.published_at = new Date().toISOString();

			// Parse readings string into JSONB structure
			if (readings) {
				const readingsParts = readings.split(';').map(r => r.trim());
				const readingsData = {};

				if (readingsParts[0]) {
					readingsData.first_reading = { source: readingsParts[0], text: '', heading: '' };
				}
				if (readingsParts[1]) {
					readingsData.psalm = { source: readingsParts[1], text: '' };
				}
				if (readingsParts[2]) {
					readingsData.second_reading = { source: readingsParts[2], text: '', heading: '' };
				}
				if (readingsParts[3]) {
					readingsData.gospel = { source: readingsParts[3], text: '', heading: '' };
				}

				readingsData.combined_sources = readings;
				updateData.readings_data = readingsData;
				updateData.gospel_reference = readingsParts[3] || null; // Backward compatibility
			}

			const { data, error } = await supabase
				.from('dgr_schedule')
				.update(updateData)
				.eq('id', scheduleId)
				.select()
				.single();

			if (error) throw error;

			return json({ success: true, schedule: data });
		}

		// If contributorId exists (pattern-based entry), create new schedule entry
		if (contributorId && date) {
			// Get contributor details
			const { data: contributor } = await supabase
				.from('dgr_contributors')
				.select('email')
				.eq('id', contributorId)
				.single();

			// Generate submission token
			const { data: token } = await supabase.rpc('generate_submission_token');

			// Parse readings string into JSONB structure
			const readingsParts = readings.split(';').map(r => r.trim());
			const readingsData = {};

			if (readingsParts[0]) {
				readingsData.first_reading = { source: readingsParts[0], text: '', heading: '' };
			}
			if (readingsParts[1]) {
				readingsData.psalm = { source: readingsParts[1], text: '' };
			}
			if (readingsParts[2]) {
				readingsData.second_reading = { source: readingsParts[2], text: '', heading: '' };
			}
			if (readingsParts[3]) {
				readingsData.gospel = { source: readingsParts[3], text: '', heading: '' };
			}

			readingsData.combined_sources = readings;

			// Create new schedule entry with reflection content
			const scheduleEntry = {
				date,
				contributor_id: contributorId,
				contributor_email: contributor?.email,
				submission_token: token,
				liturgical_date: liturgicalDate,
				gospel_reference: readingsParts[3] || null,
				readings_data: readingsData,
				reflection_title: title,
				gospel_quote: gospelQuote,
				reflection_content: content,
				status: status || 'approved'
			};

			if (status === 'approved') {
				scheduleEntry.approved_at = new Date().toISOString();
			} else if (status === 'published') {
				scheduleEntry.published_at = new Date().toISOString();
			}

			const { data, error } = await supabase
				.from('dgr_schedule')
				.insert(scheduleEntry)
				.select()
				.single();

			if (error) throw error;

			return json({ success: true, schedule: data });
		}

		throw new Error('Either scheduleId or contributorId with date is required');
	} catch (error) {
		throw error;
	}
}

async function clearReflection({ scheduleId }) {
	try {
		// Clear only the reflection content, keep contributor/readings/date
		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				reflection_title: null,
				reflection_content: null,
				gospel_quote: null,
				status: 'pending',
				submitted_at: null,
				approved_at: null,
				published_at: null,
				updated_at: new Date().toISOString()
			})
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function sendToWordPress({ scheduleId }) {
	try {
		// Get the schedule entry with all data
		const { data: schedule, error: scheduleError } = await supabase
			.from('dgr_schedule')
			.select(`
				*,
				contributor:dgr_contributors(name, email)
			`)
			.eq('id', scheduleId)
			.single();

		if (scheduleError) throw scheduleError;

		// Validate required fields
		if (!schedule.reflection_title || !schedule.gospel_quote || !schedule.reflection_content) {
			throw new Error('Missing required fields: title, gospel quote, and content are required');
		}

		// Get gospel reference and expand abbreviations (Mt -> Matthew)
		const gospelReferenceRaw = schedule.readings_data?.gospel?.source || schedule.gospel_reference || '';
		const gospelReference = expandGospelReference(gospelReferenceRaw);

		// Fetch gospel text by reference if we have one
		let gospelFullText = '';
		if (gospelReference) {
			try {
				const origin = process.env.ORIGIN || 'http://localhost:5173';
				const scriptureResponse = await fetch(
					`${origin}/api/scripture?passage=${encodeURIComponent(gospelReference)}&version=NRSVAE`
				);
				if (scriptureResponse.ok) {
					const scriptureData = await scriptureResponse.json();
					if (scriptureData.success && scriptureData.content) {
						// Use cleanGospelText to properly parse - same as dgr/publish
						gospelFullText = cleanGospelText(scriptureData.content);
						console.log(`📖 Fetched gospel text for ${gospelReference}: ${gospelFullText.substring(0, 100)}...`);
					}
				}
			} catch (err) {
				console.warn('Could not fetch gospel text:', err.message);
			}
		}

		// Prepare data for WordPress publish API
		const publishData = {
			date: schedule.date,
			liturgicalDate: schedule.liturgical_date || '',
			readings: schedule.readings_data?.combined_sources || '',
			title: schedule.reflection_title,
			gospelQuote: schedule.gospel_quote,
			reflectionText: schedule.reflection_content,
			authorName: schedule.contributor?.name || 'Unknown',
			gospelFullText,
			gospelReference,
			templateKey: 'default'
		};

		// Call the WordPress publish API
		const publishResponse = await fetch(`${process.env.ORIGIN || 'http://localhost:5173'}/api/dgr/publish`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(publishData)
		});

		const publishResult = await publishResponse.json();

		if (!publishResult.success) {
			throw new Error(publishResult.error || 'WordPress publish failed');
		}

		// Update schedule status to published
		const { data: updated, error: updateError } = await supabase
			.from('dgr_schedule')
			.update({
				status: 'published',
				published_at: new Date().toISOString()
			})
			.eq('id', scheduleId)
			.select()
			.single();

		if (updateError) throw updateError;

		return json({
			success: true,
			schedule: updated,
			wordpress: publishResult
		});
	} catch (error) {
		throw error;
	}
}
