import { json } from '@sveltejs/kit';
import { parse } from 'csv-parse/sync';
import {
	getYearCycles,
	inferRank,
	inferSeason,
	inferWeek,
	normalize,
	isMemorial,
	getDayOfWeek,
	calculateLiturgicalWeek,
	adjustBrisbaneWeekForLectionary,
	findTriduumReading,
	findFixedFeastByDate
} from '$lib/server/liturgical-rules.js';

/**
 * POST /api/dgr/liturgical-calendar/upload
 * Process uploaded CSV and match to Lectionary
 *
 * Uses centralized liturgical-rules module for year cycle calculation
 */
export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const year = parseInt(formData.get('year'));

		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		// Read CSV
		const text = await file.text();
		const records = parse(text, {
			columns: true,
			skip_empty_lines: true,
			bom: true
		});

		// Process and match entries
		const results = await processAndMatch(records, year);

		return json({
			success: true,
			results
		});
	} catch (error) {
		console.error('Upload processing error:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}

/**
 * Parse Brisbane Ordo date format: "1 January" -> "2025-01-01"
 */
function parseBrisbaneDate(rawDate, year) {
	if (!rawDate) return null;

	const cleaned = rawDate.trim();

	// Already in ISO format?
	if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
		return cleaned;
	}

	// Parse "1 January" or "25 December" format
	const months = {
		'january': '01', 'february': '02', 'march': '03', 'april': '04',
		'may': '05', 'june': '06', 'july': '07', 'august': '08',
		'september': '09', 'october': '10', 'november': '11', 'december': '12'
	};

	const match = cleaned.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
	if (match) {
		const day = match[1].padStart(2, '0');
		const monthName = match[2].toLowerCase();
		const month = months[monthName];
		if (month) {
			return `${year}-${month}-${day}`;
		}
	}

	return null;
}

async function processAndMatch(records, year) {
	const { createClient } = await import('@supabase/supabase-js');
	const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');
	const { SUPABASE_SERVICE_ROLE_KEY } = await import('$env/static/private');

	const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	// Load lectionary for matching
	const { data: lectionary } = await supabase.from('lectionary').select('*');

	const entries = [];
	let exact = 0;
	let partial = 0;
	let unmatched = 0;

	for (const row of records) {
		// Get date from various possible column names or positions
		let rawDate = row.calendar_date || row.Date || row.date || Object.values(row)[0];
		const liturgicalName = row.liturgical_name || row['Liturgical Day'] || row.name || row['Liturgical Name'] || Object.values(row)[1];

		// Skip rows with empty dates (optional memorials, blank rows)
		if (!rawDate || !rawDate.trim()) continue;
		if (!liturgicalName || !liturgicalName.trim()) continue;

		// Parse Brisbane Ordo date format: "1 January" -> "2025-01-01"
		const calendarDate = parseBrisbaneDate(rawDate, year);
		if (!calendarDate) continue;

		// Use centralized module to get correct year cycles for THIS date
		const date = new Date(calendarDate);
		const { sundayCycle, weekdayCycle } = getYearCycles(date);

		// Infer metadata from the liturgical name
		const rank = inferRank(liturgicalName);
		const season = inferSeason(liturgicalName);
		const week = inferWeek(liturgicalName);

		const entry = {
			calendar_date: calendarDate,
			liturgical_name: liturgicalName,
			liturgical_year: year,
			year_cycle: sundayCycle,
			weekday_cycle: weekdayCycle,
			liturgical_rank: rank,
			liturgical_season: season,
			liturgical_week: week
		};

		// Match to lectionary using the correct year cycle
		const match = findLectionaryMatch(entry, lectionary, sundayCycle, weekdayCycle, date);

		if (match) {
			entry.lectionary_id = match.admin_order;
			entry.match_type = match.match_type;
			entry.match_method = match.match_method;
			entry.first_reading = match.first_reading;
			entry.psalm = match.psalm;
			entry.second_reading = match.second_reading;
			entry.gospel_reading = match.gospel_reading;

			if (match.match_type === 'exact') {
				exact++;
			} else {
				partial++;
			}
		} else {
			entry.lectionary_id = null;
			entry.match_type = 'none';
			entry.match_method = null;
			entry.first_reading = null;
			entry.psalm = null;
			entry.second_reading = null;
			entry.gospel_reading = null;
			unmatched++;
		}

		entries.push(entry);
	}

	return {
		total: entries.length,
		exact,
		partial,
		unmatched,
		entries
	};
}

function weekToOrdinal(week) {
	const ordinals = {
		1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
		6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
		11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth',
		15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth',
		19: 'nineteenth', 20: 'twentieth', 21: 'twenty-first', 22: 'twenty-second',
		23: 'twenty-third', 24: 'twenty-fourth', 25: 'twenty-fifth',
		26: 'twenty-sixth', 27: 'twenty-seventh', 28: 'twenty-eighth',
		29: 'twenty-ninth', 30: 'thirtieth', 31: 'thirty-first',
		32: 'thirty-second', 33: 'thirty-third', 34: 'thirty-fourth'
	};
	return ordinals[week] || String(week);
}

function findLectionaryMatch(ordoEntry, lectionary, sundayCycle, weekdayCycle, date) {
	const { liturgical_name, liturgical_rank, liturgical_season, liturgical_week } = ordoEntry;
	const ordo_norm = normalize(liturgical_name);
	const dayOfWeek = getDayOfWeek(date);
	const isSunday = dayOfWeek === 'Sunday';

	// PRIORITY 0: Easter Triduum - Holy Thursday, Good Friday, Easter Vigil
	// These have unique lectionary entries and must be matched by name
	const triduumMatch = findTriduumReading(lectionary, liturgical_name, sundayCycle);
	if (triduumMatch) {
		return {
			...triduumMatch,
			match_type: 'exact',
			match_method: 'triduum'
		};
	}

	// PRIORITY 0.5: Fixed Feasts by date (e.g., "6 August – Transfiguration")
	// Match by calendar date + feast keyword for entries that have date prefixes
	const fixedFeastMatch = findFixedFeastByDate(lectionary, liturgical_name, date, sundayCycle);
	if (fixedFeastMatch) {
		return {
			...fixedFeastMatch,
			match_type: 'exact',
			match_method: 'date'
		};
	}

	// PRIORITY 1: Dec 17-24 with date-only names use Advent proper readings
	// (e.g., "23 December" should match "23rd December" Advent, not saint feast)
	const month = date.getMonth(); // 0-indexed, so December = 11
	const day = date.getDate();
	const isDateOnlyName = /^\d{1,2}\s+(December|Dec)$/i.test(liturgical_name.trim());

	if (month === 11 && day >= 17 && day <= 24 && !isSunday && isDateOnlyName) {
		const adventProper = findAdventProperReading(lectionary, day);
		if (adventProper) {
			return {
				...adventProper,
				match_type: 'exact',
				match_method: 'advent_proper'
			};
		}
	}

	// PRIORITY 2: Christmas week (Dec 25-31) - match by date/feast to avoid wrong partial matches
	// e.g., "Saint John" on Dec 27 should not match "St John Bosco" (Jan 31)
	if (month === 11 && day >= 25 && day <= 31) {
		const christmasMatch = findChristmasWeekReading(lectionary, liturgical_name, day, isSunday, sundayCycle);
		if (christmasMatch) {
			return {
				...christmasMatch,
				match_type: 'exact',
				match_method: 'christmas_week'
			};
		}
	}

	// PRIORITY 3: Early January (Jan 2-5) before Epiphany - use date-specific Christmas season entries
	// e.g., "Saturday before Epiphany" on Jan 3 should match "3rd January", not "EPIPHANY"
	if (month === 0 && day >= 2 && day <= 5 && !isSunday) {
		const earlyJanMatch = findEarlyJanuaryReading(lectionary, day);
		if (earlyJanMatch) {
			return {
				...earlyJanMatch,
				match_type: 'exact',
				match_method: 'early_january'
			};
		}
	}

	// For memorials, find the weekday reading instead of saint reading
	// Calculate week from date if not available in the name (e.g., "Saint Anthony" has no week)
	const effectiveWeek = liturgical_week || (isMemorial(liturgical_rank || '') && liturgical_season
		? calculateLiturgicalWeek(date, liturgical_season)
		: null);

	if (isMemorial(liturgical_rank || '') && effectiveWeek && liturgical_season) {
		const weekdayMatch = findWeekdayReading(lectionary, dayOfWeek, liturgical_season, effectiveWeek, weekdayCycle);
		if (weekdayMatch) {
			return {
				...weekdayMatch,
				match_type: 'exact',
				match_method: 'weekday_for_memorial'
			};
		}
	}

	// Try exact match with correct year cycle
	const weekdayYear = weekdayCycle === 'I' ? '1' : '2';

	for (const lect of lectionary) {
		const lect_norm = normalize(lect.liturgical_day);
		const lectYear = lect.year;

		// For Sundays, filter by year cycle (A/B/C)
		if (isSunday && lectYear && !['Season', '1', '2', 'Feast'].includes(lectYear)) {
			if (lectYear !== sundayCycle) continue;
		}

		// For Ordinary Time weekdays, filter by year cycle (1/2)
		if (!isSunday && liturgical_season === 'Ordinary Time' && ['1', '2'].includes(lectYear)) {
			if (lectYear !== weekdayYear) continue;
		}

		// Exact match
		if (ordo_norm === lect_norm) {
			return {
				admin_order: lect.admin_order,
				match_type: 'exact',
				match_method: 'name',
				first_reading: lect.first_reading,
				psalm: lect.psalm,
				second_reading: lect.second_reading,
				gospel_reading: lect.gospel_reading
			};
		}
	}

	// Try pattern-based matching for Sundays
	// Adjust Brisbane week number for OT Sundays after Pentecost (+1 to match lectionary)
	if (isSunday && liturgical_week && liturgical_season) {
		const adjustedWeek = adjustBrisbaneWeekForLectionary(liturgical_week, liturgical_season, date, true);
		const sundayMatch = findSundayReading(lectionary, liturgical_season, adjustedWeek, sundayCycle);
		if (sundayMatch) {
			return {
				...sundayMatch,
				match_type: 'exact',
				match_method: 'pattern'
			};
		}
	}

	// Map our season names to lectionary 'time' field values for filtering
	// NOTE: Lectionary uses 'Ordinary' not 'Ordinary Time'
	const seasonToTime = {
		'Advent': 'Advent',
		'Lent': 'Lent',
		'Easter': 'Easter',
		'Ordinary Time': 'Ordinary',  // Lectionary uses 'Ordinary'
		'Christmas': 'Christmas',
		'Holy Week': 'Lent'  // Holy Week uses Lent time in lectionary
	};
	const expectedTime = liturgical_season ? seasonToTime[liturgical_season] : null;

	// For solemnities and feasts, don't apply season filtering - they use Fixed/Moving Feast entries
	const isFeastOrSolemnity = liturgical_rank === 'Solemnity' || liturgical_rank === 'Feast';

	// Try partial match
	const ordoWords = new Set(ordo_norm.split(/\s+/));
	let bestMatch = null;
	let bestScore = 0;

	for (const lect of lectionary) {
		const lect_norm = normalize(lect.liturgical_day);
		const lectYear = lect.year;
		const lectTime = lect.time;

		// CRITICAL: Filter by liturgical season (time) to avoid cross-season matches
		// e.g., Advent weekday matching Ordinary Time "Monday of the first week"
		// BUT: Skip this filter for feasts/solemnities - they have Fixed/Moving Feast entries
		if (!isFeastOrSolemnity && expectedTime && lectTime && lectTime !== expectedTime) {
			continue;
		}

		// For Sundays, filter by year cycle (A/B/C)
		if (isSunday && lectYear && !['Season', '1', '2', 'Feast'].includes(lectYear)) {
			if (lectYear !== sundayCycle) continue;
		}

		// For Ordinary Time weekdays, filter by year cycle (1/2)
		if (!isSunday && liturgical_season === 'Ordinary Time' && ['1', '2'].includes(lectYear)) {
			if (lectYear !== weekdayYear) continue;
		}

		// Handle Advent weekday Year A vs B/C matching
		// Lectionary has "Year A" and "Year B/C" variants for some Advent weekdays
		if (!isSunday && liturgical_season === 'Advent') {
			const lectName = lect.liturgical_day.toLowerCase();
			if (lectName.includes('year a') && sundayCycle !== 'A') continue;
			if (lectName.includes('year b/c') && sundayCycle === 'A') continue;
		}

		const lectWords = new Set(lect_norm.split(/\s+/));
		const overlap = [...ordoWords].filter(w => lectWords.has(w)).length;

		if (overlap > bestScore && overlap >= 3) {
			bestScore = overlap;
			bestMatch = {
				admin_order: lect.admin_order,
				match_type: 'partial',
				match_method: 'substring',
				first_reading: lect.first_reading,
				psalm: lect.psalm,
				second_reading: lect.second_reading,
				gospel_reading: lect.gospel_reading
			};
		}
	}

	return bestMatch;
}

function findSundayReading(lectionary, season, week, yearCycle) {
	const ordinal = weekToOrdinal(week);
	const patterns = [];

	// Map our season names to lectionary 'time' field values
	// NOTE: Lectionary uses 'Ordinary' not 'Ordinary Time'
	const seasonToTime = {
		'Advent': 'Advent',
		'Lent': 'Lent',
		'Easter': 'Easter',
		'Ordinary Time': 'Ordinary',  // Lectionary uses 'Ordinary'
		'Christmas': 'Christmas'
	};
	const expectedTime = seasonToTime[season];

	if (season === 'Advent') {
		patterns.push(`${ordinal} sunday of advent, year ${yearCycle}`.toUpperCase());
		patterns.push(`${ordinal} sunday of advent`.toUpperCase());
	} else if (season === 'Lent') {
		patterns.push(`${ordinal} sunday in lent, year ${yearCycle}`.toUpperCase());
		patterns.push(`${ordinal} sunday of lent, year ${yearCycle}`.toUpperCase());
	} else if (season === 'Easter') {
		patterns.push(`${ordinal} sunday of easter, year ${yearCycle}`.toUpperCase());
	} else if (season === 'Ordinary Time') {
		patterns.push(`${week} sunday in ordinary time, year ${yearCycle}`.toUpperCase());
		patterns.push(`${ordinal} sunday in ordinary time, year ${yearCycle}`.toUpperCase());
	}

	for (const lect of lectionary) {
		const lectNorm = normalize(lect.liturgical_day);
		const lectYear = lect.year;
		const lectTime = lect.time;

		// CRITICAL: Filter by liturgical season (time) to avoid matching Ordinary Time for Lent/Easter
		if (expectedTime && lectTime && lectTime !== expectedTime) {
			continue;
		}

		// For Sundays, must match year cycle
		if (lectYear && !['Season', '1', '2', 'Feast'].includes(lectYear)) {
			if (lectYear !== yearCycle) continue;
		}

		for (const pattern of patterns) {
			const patternNorm = normalize(pattern);
			// Use word-boundary matching to avoid "9" matching inside "29"
			const lectWords = lectNorm.split(/\s+/);
			const patternWords = patternNorm.split(/\s+/);

			// Check if all lectionary words appear in pattern (word-based, not substring)
			const allWordsMatch = lectWords.every(w => patternWords.includes(w));

			// ALSO check: the week number must appear in the lectionary entry
			// This prevents "EASTER SUNDAY" matching "THIRD SUNDAY OF EASTER"
			const weekNum = String(week);
			const lectHasWeek = lectWords.includes(weekNum) || lectNorm.includes(ordinal.toUpperCase());

			if (allWordsMatch && lectHasWeek) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
		}
	}
	return null;
}

function findWeekdayReading(lectionary, dayOfWeek, season, week, weekdayCycle) {
	const ordinal = weekToOrdinal(week);
	const patterns = [];

	if (season === 'Lent') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week of lent`.toLowerCase());
	} else if (season === 'Easter') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week of easter`.toLowerCase());
	} else if (season === 'Advent') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week of advent`.toLowerCase());
	} else if (season === 'Ordinary Time') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week`.toLowerCase());
	}

	const lectYear = weekdayCycle === 'I' ? '1' : '2';

	for (const lect of lectionary) {
		const lectName = lect.liturgical_day.toLowerCase();
		const entryYear = lect.year;

		// For Ordinary Time weekdays, filter by year cycle (1 or 2)
		if (season === 'Ordinary Time' && entryYear && ['1', '2'].includes(entryYear)) {
			if (entryYear !== lectYear) continue;
		}

		for (const pattern of patterns) {
			if (lectName.includes(pattern)) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
		}
	}
	return null;
}

/**
 * Find Advent proper reading for Dec 17-24
 * These have their own readings in the lectionary (e.g., "17th December", "23rd December")
 */
function findAdventProperReading(lectionary, day) {
	// Build ordinal suffix
	const suffix = day === 21 ? 'st' : day === 22 ? 'nd' : day === 23 ? 'rd' : 'th';
	const pattern = `${day}${suffix} december`.toLowerCase();

	for (const lect of lectionary) {
		// Only match Advent season entries, not Fixed Feasts
		if (lect.time !== 'Advent') continue;

		const lectName = lect.liturgical_day.toLowerCase();
		if (lectName.includes(pattern) || lectName.includes(`${day} december`)) {
			return {
				admin_order: lect.admin_order,
				first_reading: lect.first_reading,
				psalm: lect.psalm,
				second_reading: lect.second_reading,
				gospel_reading: lect.gospel_reading
			};
		}
	}
	return null;
}

/**
 * Find early January reading (Jan 2-5 before Epiphany)
 * These have date-specific entries in the Christmas season
 */
function findEarlyJanuaryReading(lectionary, day) {
	// Build ordinal suffix for matching
	const suffix = day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
	const patterns = [
		`${day}${suffix} january`.toLowerCase(),
		`${day} january`.toLowerCase()
	];

	for (const lect of lectionary) {
		// Only match Christmas season entries, not Fixed Feasts
		if (lect.time !== 'Christmas') continue;

		const lectName = lect.liturgical_day.toLowerCase();
		for (const pattern of patterns) {
			if (lectName.includes(pattern)) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
		}
	}
	return null;
}

/**
 * Find Christmas week reading (Dec 25-31)
 * Handles: Christmas Day, Holy Family, Dec 26-28 feasts, octave days
 *
 * Problems this solves:
 * - "THE NATIVITY OF THE LORD" was matching Jan 1 (also has "Nativity of the Lord")
 * - "Saint John" on Dec 27 was matching "St John Bosco" (Jan 31)
 * - Holy Family wasn't getting correct year cycle
 */
function findChristmasWeekReading(lectionary, liturgicalName, day, isSunday, yearCycle) {
	const nameUpper = liturgicalName.toUpperCase();

	// HOLY FAMILY (Sunday in Christmas octave) - must use correct year cycle
	if (isSunday && (nameUpper.includes('HOLY FAMILY') || nameUpper.includes('FAMILIA'))) {
		for (const lect of lectionary) {
			if (lect.time === 'Christmas' &&
				lect.liturgical_day.toUpperCase().includes('HOLY FAMILY') &&
				lect.year === yearCycle) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
		}
	}

	// CHRISTMAS DAY (Dec 25) - match entries with "Christmas" in Christmas season
	if (day === 25 && (nameUpper.includes('NATIVITY') || nameUpper.includes('CHRISTMAS'))) {
		for (const lect of lectionary) {
			if (lect.time === 'Christmas' &&
				lect.liturgical_day.toLowerCase().includes('christmas day')) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
		}
	}

	// DEC 26-28 FEASTS - match by date pattern in Christmas season
	// These have specific feast days: St Stephen (26), St John Apostle (27), Holy Innocents (28)
	if (day >= 26 && day <= 28) {
		const datePattern = `${day} december`.toLowerCase();
		for (const lect of lectionary) {
			// Prefer Christmas season entries over Fixed Feast duplicates
			if (lect.time !== 'Christmas') continue;

			const lectName = lect.liturgical_day.toLowerCase();
			if (lectName.includes(datePattern)) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
		}
	}

	// DEC 29-31 OCTAVE DAYS - match by "X day in the octave" or date pattern
	if (day >= 29 && day <= 31) {
		const ordinals = { 29: 'fifth', 30: 'sixth', 31: 'seventh' };
		const ordinal = ordinals[day];
		const datePattern = `${day} december`.toLowerCase();

		for (const lect of lectionary) {
			if (lect.time !== 'Christmas') continue;

			const lectName = lect.liturgical_day.toLowerCase();
			if (lectName.includes(`${ordinal} day`) && lectName.includes('octave')) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
			if (lectName.includes(datePattern)) {
				return {
					admin_order: lect.admin_order,
					first_reading: lect.first_reading,
					psalm: lect.psalm,
					second_reading: lect.second_reading,
					gospel_reading: lect.gospel_reading
				};
			}
		}
	}

	return null;
}

