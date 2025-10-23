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

		// Get all actual schedule entries
		let query = supabase
			.from('dgr_schedule')
			.select(
				`
        *,
        contributor:dgr_contributors(name, email, access_token, schedule_pattern)
      `
			)
			.gte('date', startDate)
			.lte('date', endDate)
			.order('date', { ascending: true });

		if (status) {
			query = query.eq('status', status);
		}

		const { data: scheduleEntries, error } = await query;

		if (error) throw error;

		// Fetch liturgical calendar data for all dates in range
		const { data: calendarData, error: calendarError } = await supabase
			.from('liturgical_calendar')
			.select('calendar_date, liturgical_season, liturgical_week, liturgical_name, liturgical_rank')
			.gte('calendar_date', startDate)
			.lte('calendar_date', endDate);

		if (calendarError) {
			console.error('Failed to fetch calendar data:', calendarError);
		}

		// Create a map for quick lookup
		const calendarMap = new Map();
		if (calendarData) {
			calendarData.forEach((entry) => {
				calendarMap.set(entry.calendar_date, entry);
			});
		}

		// Get all contributors with patterns
		const { data: contributors, error: contribError } = await supabase
			.from('dgr_contributors')
			.select('id, name, email, access_token, schedule_pattern')
			.eq('active', true);

		if (contribError) throw contribError;

		// Build calendar: merge actual entries with pattern-based dates
		const scheduleMap = new Map();

		// Add existing schedule entries with calendar data
		scheduleEntries.forEach((entry) => {
			const calendar = calendarMap.get(entry.date);
			scheduleMap.set(entry.date, {
				...entry,
				has_assignment: true,
				has_content: !!(entry.reflection_content || entry.reflection_title),
				from_pattern: false, // Actual schedule entries are not from pattern
				// Add liturgical calendar data
				liturgical_season: calendar?.liturgical_season || null,
				liturgical_week: calendar?.liturgical_week || null,
				liturgical_name: calendar?.liturgical_name || entry.liturgical_date || null,
				liturgical_rank: calendar?.liturgical_rank || null
			});
		});

		// Add pattern-based dates for each contributor
		contributors.forEach((contrib) => {
			if (!contrib.schedule_pattern || !contrib.schedule_pattern.type) return;

			const pattern = contrib.schedule_pattern;
			const dates = calculatePatternDates(pattern, startDate, endDate);

			dates.forEach((date) => {
				if (!scheduleMap.has(date)) {
					// Only add if no actual entry exists
					const calendar = calendarMap.get(date);
					scheduleMap.set(date, {
						date,
						contributor_id: contrib.id,
						contributor: {
							name: contrib.name,
							email: contrib.email,
							access_token: contrib.access_token,
							schedule_pattern: contrib.schedule_pattern
						},
						status: 'pending',
						has_assignment: false,
						has_content: false,
						from_pattern: true,
						// Add liturgical calendar data
						liturgical_season: calendar?.liturgical_season || null,
						liturgical_week: calendar?.liturgical_week || null,
						liturgical_name: calendar?.liturgical_name || null,
						liturgical_rank: calendar?.liturgical_rank || null
					});
				}
			});
		});

		// Convert map to sorted array
		const schedule = Array.from(scheduleMap.values()).sort(
			(a, b) => new Date(a.date) - new Date(b.date)
		);

		return json({ schedule });
	} catch (error) {
		console.error('Schedule fetch error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

// Helper function to calculate dates from pattern
function calculatePatternDates(pattern, startDate, endDate) {
	const dates = [];
	const start = new Date(startDate);
	const end = new Date(endDate);

	if (pattern.type === 'day_of_month') {
		const dayOfMonth = pattern.value;
		const current = new Date(start);

		while (current <= end) {
			const testDate = new Date(
				current.getFullYear(),
				current.getMonth(),
				dayOfMonth
			);

			if (testDate >= start && testDate <= end) {
				dates.push(testDate.toISOString().split('T')[0]);
			}

			// Move to next month
			current.setMonth(current.getMonth() + 1);
		}
	} else if (pattern.type === 'day_of_week') {
		const targetDay = pattern.value; // 0=Sunday, 6=Saturday
		const current = new Date(start);

		while (current <= end) {
			if (current.getDay() === targetDay) {
				dates.push(current.toISOString().split('T')[0]);
			}
			current.setDate(current.getDate() + 1);
		}
	}

	return dates;
}

export async function POST({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { action, ...data } = await request.json();

		switch (action) {
			case 'generate_schedule':
				return await generateSchedule(data);
			case 'update_assignment':
				return await updateAssignment(data);
			case 'approve_reflection':
				return await approveReflection(data);
			case 'update_status':
				return await updateStatus(data);
			case 'update_readings':
				return await updateReadings(data);
			case 'delete_schedule':
				return await deleteSchedule(data);
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

async function generateSchedule({ startDate, days = 14 }) {
	try {
		const scheduleEntries = [];
		const blockedDates = [];
		const start = new Date(startDate);

		for (let i = 0; i < days; i++) {
			const date = new Date(start);
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split('T')[0];

			// Check if entry already exists
			const { data: existing } = await supabase
				.from('dgr_schedule')
				.select('id')
				.eq('date', dateStr)
				.maybeSingle();

			if (existing) continue; // Skip if already exists

			// Get contributor assignment (respects assignment rules)
			const { data: contributorId } = await supabase.rpc('assign_contributor_to_date', {
				target_date: dateStr
			});

			// If NULL, check if blocked by rules
			if (!contributorId) {
				const { data: ruleCheck } = await supabase.rpc('check_assignment_rules', {
					target_date: dateStr
				});

				if (ruleCheck && ruleCheck.length > 0 && ruleCheck[0].is_blocked) {
					blockedDates.push({
						date: dateStr,
						rule: ruleCheck[0].rule_name,
						message: ruleCheck[0].rule_message
					});
				}
				continue; // Skip blocked or unassignable dates
			}

			if (contributorId) {
				const { data: contributor } = await supabase
					.from('dgr_contributors')
					.select('email')
					.eq('id', contributorId)
					.single();

				// Generate submission token
				const { data: token } = await supabase.rpc('generate_submission_token');

				// Fetch readings from database lectionary
				const readingsData = await fetchReadingsFromDatabase(dateStr);

				// Build schedule entry
				const scheduleEntry = {
					date: dateStr,
					contributor_id: contributorId,
					contributor_email: contributor?.email,
					submission_token: token,
					status: 'pending'
				};

				// Add readings if found in database
				if (readingsData) {
					scheduleEntry.gospel_reference = readingsData.reference; // Backward compatibility
					scheduleEntry.liturgical_date = readingsData.liturgicalDate;
					scheduleEntry.readings_data = readingsData.readings; // JSONB with all readings
				}

				scheduleEntries.push(scheduleEntry);
			}
		}

		if (scheduleEntries.length > 0) {
			const { data, error } = await supabase.from('dgr_schedule').insert(scheduleEntries).select();

			if (error) throw error;

			const message = blockedDates.length > 0
				? `Generated ${scheduleEntries.length} schedule entries. ${blockedDates.length} dates blocked by assignment rules.`
				: `Generated ${scheduleEntries.length} schedule entries`;

			return json({
				success: true,
				message,
				entries: data,
				blockedDates: blockedDates.length > 0 ? blockedDates : undefined
			});
		}

		if (blockedDates.length > 0) {
			return json({
				success: true,
				message: `No new entries created. ${blockedDates.length} dates were blocked by assignment rules.`,
				blockedDates
			});
		}

		return json({
			success: true,
			message: 'No new entries needed - schedule already exists for this period'
		});
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

async function deleteSchedule({ scheduleId }) {
	try {
		const { data, error } = await supabase
			.from('dgr_schedule')
			.delete()
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, deleted: data });
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

		// Prepare data for WordPress publish API
		const publishData = {
			date: schedule.date,
			liturgicalDate: schedule.liturgical_date || '',
			readings: schedule.readings_data?.combined_sources || '',
			title: schedule.reflection_title,
			gospelQuote: schedule.gospel_quote,
			reflectionText: schedule.reflection_content,
			authorName: schedule.contributor?.name || 'Unknown',
			gospelFullText: schedule.readings_data?.gospel?.text || '',
			gospelReference: schedule.readings_data?.gospel?.source || '',
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
