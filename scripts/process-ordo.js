#!/usr/bin/env node
/**
 * Process Ordo Calendar → Lectionary Mapping
 *
 * Usage:
 *   node scripts/process-ordo.js                    # Generate CSV for review
 *   node scripts/process-ordo.js --push             # Push to database
 *   node scripts/process-ordo.js --check 2025-12-07 # Check specific date
 *
 * This script uses the central liturgical-rules module for all logic.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// YEAR CYCLE LOGIC (from liturgical-rules.ts, duplicated for Node compatibility)
// ============================================================================

let yearDataCache = null;

function parseMonthDay(dateStr, year) {
	const months = {
		'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
		'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
	};
	const [monthStr, dayStr] = dateStr.replace(' ', '-').split('-');
	return new Date(year, months[monthStr], parseInt(dayStr, 10));
}

function loadYearCycleData() {
	if (yearDataCache) return yearDataCache;

	const csvPath = join(process.cwd(), 'src/lib/data/litugical-year.csv');
	const csvContent = readFileSync(csvPath, 'utf-8');
	const records = parse(csvContent, { columns: true, skip_empty_lines: true });

	yearDataCache = new Map();
	for (const r of records) {
		const year = parseInt(r.year, 10);
		yearDataCache.set(year, {
			year,
			sundayCycle: r.sunday_cycle,
			weekdayCycle: r.weekday_cycle,
			firstSundayOfAdvent: parseMonthDay(r.first_sunday_of_advent, year),
			// Additional fields for week calculation
			easterSunday: r.easter_sunday,
			pentecostSunday: r.pentecost_sunday,
			ashWednesday: r.ash_wednesday,
			weekOfOtAfterPentecost: parseInt(r.week_of_ot_after_pentecost, 10),
			weeksBeforeLent: parseInt(r.weeks_of_ot_before_lent, 10)
		});
	}
	return yearDataCache;
}

function getYearCycles(date) {
	const data = loadYearCycleData();
	const calendarYear = date.getFullYear();

	const currentYear = data.get(calendarYear);
	if (!currentYear) throw new Error(`No data for year ${calendarYear}`);

	if (date >= currentYear.firstSundayOfAdvent) {
		const nextYear = data.get(calendarYear + 1);
		if (!nextYear) throw new Error(`No data for year ${calendarYear + 1}`);
		return { sundayCycle: nextYear.sundayCycle, weekdayCycle: nextYear.weekdayCycle };
	}

	return { sundayCycle: currentYear.sundayCycle, weekdayCycle: currentYear.weekdayCycle };
}

/**
 * Calculate liturgical week number from date
 * Used for memorials where the week isn't in the name
 */
function calculateLiturgicalWeek(date, season) {
	const data = loadYearCycleData();
	const calendarYear = date.getFullYear();
	const yearData = data.get(calendarYear);
	if (!yearData) return null;

	// Parse key dates from year data
	const easterSunday = parseMonthDay(yearData.easterSunday || 'Apr-05', calendarYear);
	const pentecostSunday = parseMonthDay(yearData.pentecostSunday || 'May-24', calendarYear);
	const ashWednesday = parseMonthDay(yearData.ashWednesday || 'Feb-18', calendarYear);
	const weekOfOtAfterPentecost = yearData.weekOfOtAfterPentecost || 8;
	const firstSundayOfAdvent = yearData.firstSundayOfAdvent;

	// Calculate days since reference point
	const msPerDay = 24 * 60 * 60 * 1000;
	const daysSinceEaster = Math.floor((date - easterSunday) / msPerDay);
	const daysSincePentecost = Math.floor((date - pentecostSunday) / msPerDay);
	const daysSinceAshWednesday = Math.floor((date - ashWednesday) / msPerDay);

	if (season === 'Easter') {
		// Easter Week 1 = Easter Sunday week
		// Week 2 starts 7 days after Easter, etc.
		if (daysSinceEaster < 0) return null;
		return Math.floor(daysSinceEaster / 7) + 1;
	}

	if (season === 'Lent') {
		// Lent Week 1 starts with Ash Wednesday
		if (daysSinceAshWednesday < 0) return null;
		return Math.floor(daysSinceAshWednesday / 7) + 1;
	}

	if (season === 'Ordinary Time') {
		// OT after Pentecost resumes at weekOfOtAfterPentecost
		if (daysSincePentecost >= 0) {
			// After Pentecost: week = weekOfOtAfterPentecost + weeks since Pentecost
			return weekOfOtAfterPentecost + Math.floor(daysSincePentecost / 7);
		}

		// Before Lent: calculate from weeks_of_ot_before_lent working back from Ash Wednesday
		// The day before Ash Wednesday is in the last week of OT before Lent
		const daysUntilLent = Math.floor((ashWednesday - date) / msPerDay);
		if (daysUntilLent > 0 && daysUntilLent < 70) {
			// weeksOfOtBeforeLent from CSV tells us how many weeks of OT before Lent
			// This value is stored in the CSV but not parsed yet, so calculate it
			// Week 1 of OT starts after Baptism of the Lord (around Jan 13)
			// For now, use a reasonable default based on typical range (5-9 weeks)
			const weeksOfOtBeforeLent = yearData.weeksBeforeLent || 6;
			const fullWeeksBeforeAsh = Math.floor((daysUntilLent - 1) / 7);
			const week = weeksOfOtBeforeLent - fullWeeksBeforeAsh;
			if (week >= 1) return week;
		}
		return null;
	}

	if (season === 'Advent') {
		// Advent has 4 weeks, starting from First Sunday of Advent
		if (firstSundayOfAdvent) {
			const daysSinceAdventStart = Math.floor((date - firstSundayOfAdvent) / msPerDay);
			if (daysSinceAdventStart >= 0 && daysSinceAdventStart < 28) {
				return Math.floor(daysSinceAdventStart / 7) + 1;
			}
		}
		return null;
	}

	return null;
}

/**
 * Adjust Brisbane Ordo week number to match Roman Lectionary numbering
 *
 * Brisbane's OT Sunday numbering after Pentecost is 1 less than the lectionary
 * for early/mid weeks, but catches up by week 33.
 * e.g., Brisbane "11 ORDINARY" (June 14, 2026) = Lectionary "TWELFTH SUNDAY"
 */
function adjustBrisbaneWeekForLectionary(week, season, date, isSunday) {
	if (!isSunday || season !== 'Ordinary Time' || !week) return week;

	// Don't adjust weeks 33+ (Brisbane catches up by end of year)
	if (week >= 33) return week;

	const data = loadYearCycleData();
	const calendarYear = date.getFullYear();
	const yearData = data.get(calendarYear);
	if (!yearData?.pentecostSunday) return week;

	const pentecost = parseMonthDay(yearData.pentecostSunday, calendarYear);

	// Only adjust for OT Sundays AFTER Pentecost
	if (date > pentecost) {
		return week + 1;
	}

	return week;
}

// ============================================================================
// INFERENCE HELPERS
// ============================================================================

function inferRank(name) {
	const upper = name.toUpperCase();

	if (name === upper && (
		upper.includes('CHRISTMAS') || upper.includes('EASTER') || upper.includes('PENTECOST') ||
		upper.includes('ASCENSION') || upper.includes('TRINITY') || upper.includes('ASSUMPTION') ||
		upper.includes('EPIPHANY') || upper.includes('NATIVITY') || upper.includes('IMMACULATE') ||
		upper.includes('ALL SAINTS') || upper.includes('MARY') || upper.includes('HOLY FAMILY') ||
		upper.includes('BODY AND BLOOD') || upper.includes('SACRED HEART') || upper.includes('CHRIST')
	)) {
		return upper.includes('SUNDAY') ? 'Sunday' : 'Solemnity';
	}

	if (upper.includes('SUNDAY')) return 'Sunday';
	if (upper.includes('SAINT') || upper.includes('ST ') || upper.includes('ST.')) {
		return upper.includes('OPTIONAL') ? 'Optional Memorial' : 'Memorial';
	}
	if (/\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)\b/.test(upper)) return 'Feria';

	return 'Feria';
}

function inferSeason(name) {
	const upper = name.toUpperCase();

	if (upper.includes('ADVENT')) return 'Advent';
	if (upper.includes('CHRISTMAS') || upper.includes('EPIPHANY') || upper.includes('BAPTISM')) return 'Christmas';
	if (upper.includes('LENT') || upper.includes('ASH WEDNESDAY')) return 'Lent';
	if (upper.includes('PALM') || upper.includes('HOLY WEEK') || upper.includes('PASSION')) return 'Holy Week';
	if (upper.includes('EASTER') || upper.includes('PENTECOST') || upper.includes('ASCENSION')) return 'Easter';
	if (upper.includes('ORDINARY') || /^\d+\s+(LENT|EASTER|ADVENT|ORDINARY)/.test(upper)) return 'Ordinary Time';
	if (/^\d{1,2}\s+(DECEMBER|DEC)/.test(upper)) return 'Advent';

	return null;
}

function inferWeek(name) {
	const upper = name.toUpperCase();

	const ordinals = {
		'FIRST': 1, 'SECOND': 2, 'THIRD': 3, 'FOURTH': 4, 'FIFTH': 5,
		'SIXTH': 6, 'SEVENTH': 7, 'EIGHTH': 8, 'NINTH': 9, 'TENTH': 10,
		'THIRTY-FOURTH': 34, 'THIRTY-THIRD': 33, 'THIRTY-SECOND': 32,
		'THIRTY-FIRST': 31, 'THIRTIETH': 30, 'TWENTY-NINTH': 29,
		'TWENTY-EIGHTH': 28, 'TWENTY-SEVENTH': 27, 'TWENTY-SIXTH': 26,
		'TWENTY-FIFTH': 25, 'TWENTY-FOURTH': 24, 'TWENTY-THIRD': 23,
		'TWENTY-SECOND': 22, 'TWENTY-FIRST': 21, 'TWENTIETH': 20,
		'NINETEENTH': 19, 'EIGHTEENTH': 18, 'SEVENTEENTH': 17,
		'SIXTEENTH': 16, 'FIFTEENTH': 15, 'FOURTEENTH': 14,
		'THIRTEENTH': 13, 'TWELFTH': 12, 'ELEVENTH': 11
	};

	for (const [word, num] of Object.entries(ordinals)) {
		if (upper.includes(word)) return num;
	}

	const numMatch = upper.match(/^(\d+)\s+(LENT|EASTER|ADVENT|ORDINARY)/);
	if (numMatch) return parseInt(numMatch[1], 10);

	const weekMatch = upper.match(/WEEK\s+(\d+)/i);
	if (weekMatch) return parseInt(weekMatch[1], 10);

	return null;
}

// Map Brisbane feast names to lectionary names
const FEAST_NAME_MAPPINGS = {
	'THE MOST HOLY TRINITY': 'TRINITY SUNDAY',
	'THE MOST HOLY BODY AND BLOOD OF CHRIST': 'THE BODY AND BLOOD OF CHRIST',
	'THE NATIVITY OF SAINT JOHN THE BAPTIST': 'BIRTH OF JOHN THE BAPTIST',
	'THE TRANSFIGURATION OF THE LORD': 'TRANSFIGURATION',
	'TRANSFIGURATION OF THE LORD': 'TRANSFIGURATION',
	'THE EXALTATION OF THE HOLY CROSS': 'EXALTATION OF THE CROSS',
	'EXALTATION OF THE HOLY CROSS': 'EXALTATION OF THE CROSS',
	'THE CHAIR OF ST PETER': 'CHAIR OF PETER',
	'THE CHAIR OF SAINT PETER': 'CHAIR OF PETER',
	'THE VISITATION OF THE BLESSED VIRGIN MARY': 'VISITATION',
	'THE PRESENTATION OF THE LORD': 'PRESENTATION OF THE LORD',
	'THE NATIVITY OF THE BLESSED VIRGIN MARY': 'BIRTH OF MARY',
	'THE QUEENSHIP OF THE BLESSED VIRGIN MARY': 'QUEENSHIP OF MARY',
	'THE PRESENTATION OF THE BLESSED VIRGIN MARY': 'PRESENTATION OF MARY',
	'THE COMMEMORATION OF ALL THE FAITHFUL DEPARTED': 'ALL SOULS',
	'THE DEDICATION OF THE LATERAN BASILICA': 'ST JOHN LATERAN',
	'DEDICATION OF THE LATERAN BASILICA': 'ST JOHN LATERAN',
	'SAINT THÉRÈSE OF THE CHILD JESUS': 'ST THERESE OF THE CHILD JESUS',
	'SAINT THERESE OF THE CHILD JESUS': 'ST THERESE OF THE CHILD JESUS',
};

function normalize(text) {
	if (!text) return '';
	let n = text.toUpperCase().trim();

	// Apply feast name mappings first
	for (const [from, to] of Object.entries(FEAST_NAME_MAPPINGS)) {
		if (n.includes(from)) {
			n = n.replace(from, to);
		}
	}

	n = n.replace(/^\d{1,2}\s+[A-Z]+\s*[–—-]\s*/, '');
	n = n.replace(/,?\s*YEAR\s+[ABC]\s*$/i, '');

	const ordinals = [
		['THIRTY-FOURTH', '34'], ['THIRTY-THIRD', '33'], ['THIRTY-SECOND', '32'],
		['THIRTY-FIRST', '31'], ['THIRTIETH', '30'], ['TWENTY-NINTH', '29'],
		['TWENTY-EIGHTH', '28'], ['TWENTY-SEVENTH', '27'], ['TWENTY-SIXTH', '26'],
		['TWENTY-FIFTH', '25'], ['TWENTY-FOURTH', '24'], ['TWENTY-THIRD', '23'],
		['TWENTY-SECOND', '22'], ['TWENTY-FIRST', '21'], ['TWENTIETH', '20'],
		['NINETEENTH', '19'], ['EIGHTEENTH', '18'], ['SEVENTEENTH', '17'],
		['SIXTEENTH', '16'], ['FIFTEENTH', '15'], ['FOURTEENTH', '14'],
		['THIRTEENTH', '13'], ['TWELFTH', '12'], ['ELEVENTH', '11'],
		['TENTH', '10'], ['NINTH', '9'], ['EIGHTH', '8'], ['SEVENTH', '7'],
		['SIXTH', '6'], ['FIFTH', '5'], ['FOURTH', '4'], ['THIRD', '3'],
		['SECOND', '2'], ['FIRST', '1']
	];
	for (const [word, num] of ordinals) {
		n = n.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
	}

	n = n.replace(/\bSS\b\.?\s+/g, 'SAINTS ');
	n = n.replace(/\bST\b\.?\s+/g, 'SAINT ');
	n = n.replace(/ IN LENT/g, ' OF LENT');
	n = n.replace(/ IN ADVENT/g, ' OF ADVENT');
	n = n.replace(/ IN EASTER/g, ' OF EASTER');
	n = n.replace(/ IN ORDINARY TIME/g, '');
	n = n.replace(/ OF ORDINARY TIME/g, '');

	return n.replace(/\s+/g, ' ').trim();
}

function getDayOfWeek(date) {
	return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
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

// ============================================================================
// LECTIONARY MATCHING
// ============================================================================

function findLectionaryMatch(ordoEntry, lectionary, yearCycles) {
	const { calendar_date, liturgical_name } = ordoEntry;
	const date = new Date(calendar_date);
	const dayOfWeek = getDayOfWeek(date);
	const { sundayCycle, weekdayCycle } = yearCycles;

	const rank = ordoEntry.liturgical_rank || inferRank(liturgical_name);
	const season = ordoEntry.liturgical_season || inferSeason(liturgical_name);
	const week = ordoEntry.liturgical_week || inferWeek(liturgical_name);

	const isMemorial = rank.toLowerCase().includes('memorial');
	const isSunday = dayOfWeek === 'Sunday';
	const month = date.getMonth(); // 0-indexed, December = 11
	const day = date.getDate();

	// PRIORITY 0: Easter Triduum - Holy Thursday, Good Friday, Easter Vigil
	const triduumMatch = findTriduumReading(lectionary, liturgical_name, sundayCycle);
	if (triduumMatch) {
		return { ...triduumMatch, match_type: 'exact', match_method: 'triduum' };
	}

	// PRIORITY 0.5: Fixed Feasts by date (e.g., "6 August – Transfiguration")
	const fixedFeastMatch = findFixedFeastByDate(lectionary, liturgical_name, date, sundayCycle);
	if (fixedFeastMatch) {
		return { ...fixedFeastMatch, match_type: 'exact', match_method: 'date' };
	}

	// PRIORITY 1: Dec 17-24 with date-only names use Advent proper readings
	const isDateOnlyName = /^\d{1,2}\s+(December|Dec)$/i.test(liturgical_name.trim());
	if (month === 11 && day >= 17 && day <= 24 && !isSunday && isDateOnlyName) {
		const adventProper = findAdventProperReading(lectionary, day);
		if (adventProper) {
			return { ...adventProper, match_type: 'exact', match_method: 'advent_proper' };
		}
	}

	// PRIORITY 2: Christmas week (Dec 25-31) - match by date/feast to avoid wrong partial matches
	if (month === 11 && day >= 25 && day <= 31) {
		const christmasMatch = findChristmasWeekReading(lectionary, liturgical_name, day, isSunday, sundayCycle);
		if (christmasMatch) {
			return { ...christmasMatch, match_type: 'exact', match_method: 'christmas_week' };
		}
	}

	// PRIORITY 3: Early January (Jan 2-5) before Epiphany - use date-specific Christmas season entries
	// e.g., "Saturday before Epiphany" on Jan 3 should match "3rd January", not "EPIPHANY"
	if (month === 0 && day >= 2 && day <= 5 && !isSunday) {
		const earlyJanMatch = findEarlyJanuaryReading(lectionary, day);
		if (earlyJanMatch) {
			return { ...earlyJanMatch, match_type: 'exact', match_method: 'early_january' };
		}
	}

	// For memorials, find the weekday reading instead of saint reading
	// Calculate week from date if not available (e.g., "Saint Benedict" has no week in name)
	const effectiveWeek = week || (isMemorial && season ? calculateLiturgicalWeek(date, season) : null);

	if (isMemorial && effectiveWeek && season) {
		const weekdayMatch = findWeekdayReading(lectionary, dayOfWeek, season, effectiveWeek, weekdayCycle);
		if (weekdayMatch) {
			return {
				...weekdayMatch,
				match_type: 'exact',
				match_method: 'weekday_for_memorial'
			};
		}
	}

	// Try exact name match with year cycle
	const ordoNorm = normalize(liturgical_name);
	const weekdayYear = weekdayCycle === 'I' ? '1' : '2';

	for (const entry of lectionary) {
		const lectNorm = normalize(entry.liturgical_day);
		const lectYear = entry.year;

		// Year filter for Sundays (A/B/C)
		if (isSunday && lectYear && !['Season', '1', '2', 'Feast'].includes(lectYear)) {
			if (lectYear !== sundayCycle) continue;
		}

		// Year filter for Ordinary Time weekdays (1/2)
		if (!isSunday && season === 'Ordinary Time' && ['1', '2'].includes(lectYear)) {
			if (lectYear !== weekdayYear) continue;
		}

		// Exact match
		if (ordoNorm === lectNorm) {
			return {
				lectionary_id: entry.admin_order,
				lectionary_day: entry.liturgical_day,
				first_reading: entry.first_reading,
				psalm: entry.psalm,
				second_reading: entry.second_reading,
				gospel_reading: entry.gospel_reading,
				match_type: 'exact',
				match_method: 'name'
			};
		}
	}

	// Try pattern-based matching for Sundays
	// Adjust Brisbane week number for OT Sundays after Pentecost (+1 to match lectionary)
	if (isSunday && week && season) {
		const adjustedWeek = adjustBrisbaneWeekForLectionary(week, season, date, true);
		const sundayMatch = findSundayReading(lectionary, season, adjustedWeek, sundayCycle);
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
	const expectedTime = season ? seasonToTime[season] : null;

	// For solemnities and feasts, don't apply season filtering - they use Fixed/Moving Feast entries
	const isFeastOrSolemnity = rank === 'Solemnity' || rank === 'Feast';

	// Try partial/substring match
	for (const entry of lectionary) {
		const lectNorm = normalize(entry.liturgical_day);
		const lectYear = entry.year;
		const lectTime = entry.time;

		// CRITICAL: Filter by liturgical season (time) to avoid cross-season matches
		// e.g., Advent weekday matching Ordinary Time "Monday of the first week"
		// BUT: Skip this filter for feasts/solemnities - they have Fixed/Moving Feast entries
		if (!isFeastOrSolemnity && expectedTime && lectTime && lectTime !== expectedTime) {
			continue;
		}

		// Year filter for Sundays (A/B/C)
		if (isSunday && lectYear && !['Season', '1', '2', 'Feast'].includes(lectYear)) {
			if (lectYear !== sundayCycle) continue;
		}

		// Year filter for Ordinary Time weekdays (1/2)
		if (!isSunday && season === 'Ordinary Time' && ['1', '2'].includes(lectYear)) {
			if (lectYear !== weekdayYear) continue;
		}

		// Handle Advent weekday Year A vs B/C matching
		// Lectionary has "Year A" and "Year B/C" variants for some Advent weekdays
		if (!isSunday && season === 'Advent') {
			const lectName = entry.liturgical_day.toLowerCase();
			if (lectName.includes('year a') && sundayCycle !== 'A') continue;
			if (lectName.includes('year b/c') && sundayCycle === 'A') continue;
		}

		if (ordoNorm.includes(lectNorm) || lectNorm.includes(ordoNorm)) {
			return {
				lectionary_id: entry.admin_order,
				lectionary_day: entry.liturgical_day,
				first_reading: entry.first_reading,
				psalm: entry.psalm,
				second_reading: entry.second_reading,
				gospel_reading: entry.gospel_reading,
				match_type: 'partial',
				match_method: 'substring'
			};
		}
	}

	return null;
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

	for (const entry of lectionary) {
		const lectNorm = normalize(entry.liturgical_day);
		const lectYear = entry.year;
		const lectTime = entry.time;

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
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}
	return null;
}

function findWeekdayReading(lectionary, dayOfWeek, season, week, weekdayCycle) {
	const ordinal = weekToOrdinal(week);
	const patterns = [];

	// Map season to expected lectionary time field
	const seasonToTime = {
		'Lent': 'Lent',
		'Easter': 'Easter',
		'Advent': 'Advent',
		'Ordinary Time': 'Ordinary'  // Lectionary uses 'Ordinary'
	};
	const expectedTime = seasonToTime[season];

	if (season === 'Lent') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week of lent`.toLowerCase());
	} else if (season === 'Easter') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week of easter`.toLowerCase());
	} else if (season === 'Advent') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week of advent`.toLowerCase());
	} else if (season === 'Ordinary Time') {
		patterns.push(`${dayOfWeek} of the ${ordinal} week`.toLowerCase());
	}

	// Map I/II to 1/2 for lectionary matching
	const lectYear = weekdayCycle === 'I' ? '1' : '2';

	for (const entry of lectionary) {
		const lectName = entry.liturgical_day.toLowerCase();
		const entryYear = entry.year;
		const lectTime = entry.time;

		// Filter by liturgical season/time to avoid cross-season matches
		if (expectedTime && lectTime && lectTime !== expectedTime) {
			continue;
		}

		// For Ordinary Time weekdays, filter by year cycle (1 or 2)
		if (season === 'Ordinary Time' && entryYear && ['1', '2'].includes(entryYear)) {
			if (entryYear !== lectYear) continue;
		}

		for (const pattern of patterns) {
			if (lectName.includes(pattern) || pattern.includes(lectName.replace(/,.*$/, ''))) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}
	return null;
}

/**
 * Find Advent proper reading for Dec 17-24
 */
function findAdventProperReading(lectionary, day) {
	const suffix = day === 21 ? 'st' : day === 22 ? 'nd' : day === 23 ? 'rd' : 'th';
	const pattern = `${day}${suffix} december`.toLowerCase();

	for (const entry of lectionary) {
		if (entry.time !== 'Advent') continue;

		const lectName = entry.liturgical_day.toLowerCase();
		if (lectName.includes(pattern) || lectName.includes(`${day} december`)) {
			return {
				lectionary_id: entry.admin_order,
				lectionary_day: entry.liturgical_day,
				first_reading: entry.first_reading,
				psalm: entry.psalm,
				second_reading: entry.second_reading,
				gospel_reading: entry.gospel_reading
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

	for (const entry of lectionary) {
		// Only match Christmas season entries, not Fixed Feasts
		if (entry.time !== 'Christmas') continue;

		const lectName = entry.liturgical_day.toLowerCase();
		for (const pattern of patterns) {
			if (lectName.includes(pattern)) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}
	return null;
}

/**
 * Find Triduum reading - Holy Thursday, Good Friday, Easter Vigil
 */
function findTriduumReading(lectionary, liturgicalName, yearCycle) {
	const nameUpper = liturgicalName.toUpperCase();

	// HOLY THURSDAY
	if (nameUpper.includes('HOLY THURSDAY') || nameUpper.includes("LORD'S SUPPER") || nameUpper.includes('MAUNDY')) {
		for (const entry of lectionary) {
			const lectName = entry.liturgical_day.toUpperCase();
			if (lectName.includes('HOLY THURSDAY') || lectName.includes("LORD'S SUPPER")) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	// GOOD FRIDAY
	if (nameUpper.includes('GOOD FRIDAY') || nameUpper.includes("LORD'S PASSION")) {
		for (const entry of lectionary) {
			const lectName = entry.liturgical_day.toUpperCase();
			if (lectName.includes('GOOD FRIDAY') || lectName.includes("LORD'S PASSION")) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	// EASTER VIGIL
	if (nameUpper.includes('EASTER VIGIL') && !nameUpper.includes('SUNDAY')) {
		for (const entry of lectionary) {
			const lectName = entry.liturgical_day.toUpperCase();
			if (lectName.includes('EASTER VIGIL') && entry.year === yearCycle) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	// PENTECOST SUNDAY (not Vigil)
	if (nameUpper === 'PENTECOST' || nameUpper.includes('PENTECOST SUNDAY')) {
		for (const entry of lectionary) {
			const lectName = entry.liturgical_day.toUpperCase();
			if (lectName.includes('PENTECOST SUNDAY') && entry.year === yearCycle) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	return null;
}

/**
 * Known fixed feasts with date prefixes in lectionary
 */
const FIXED_FEASTS = {
	'TRANSFIGURATION': 'transfiguration',
	'PRESENTATION OF THE LORD': 'presentation',
	'ANNUNCIATION': 'annunciation',
	'ASSUMPTION': 'assumption',
	'BIRTH OF MARY': 'birth of mary',
	'NATIVITY OF THE BLESSED VIRGIN': 'birth of mary',
	'NATIVITY OF MARY': 'birth of mary',
	'EXALTATION': 'exaltation',
	'HOLY CROSS': 'exaltation',
	'IMMACULATE CONCEPTION': 'immaculate conception',
	'OUR LADY OF THE ROSARY': 'rosary',
	'GUARDIAN ANGELS': 'guardian angels',
	'ARCHANGELS': 'archangels',
	'ALL SOULS': 'all souls',
	'FAITHFUL DEPARTED': 'all souls',
	'ST JOHN LATERAN': 'john lateran',
	'LATERAN BASILICA': 'john lateran',
	'DEDICATION OF THE LATERAN': 'john lateran',
	'CHAIR OF PETER': 'chair of peter',
	'CONVERSION OF PAUL': 'conversion of paul',
	'BIRTH OF JOHN THE BAPTIST': 'birth of john',
	'NATIVITY OF JOHN THE BAPTIST': 'birth of john',
	'NATIVITY OF SAINT JOHN': 'birth of john',
	'PETER AND PAUL': 'peter and paul',
	'VISITATION': 'visitation',
	'QUEENSHIP OF MARY': 'queenship',
	'QUEENSHIP OF THE BLESSED': 'queenship',
	// Australian-specific
	'OUR LADY, HELP OF CHRISTIANS': 'mary help of christians',
	'MARY HELP OF CHRISTIANS': 'mary help of christians',
	'HELP OF CHRISTIANS': 'mary help of christians',
	'MARY OF THE CROSS': 'mary of the cross'
};

/**
 * Find Fixed Feast by calendar date
 */
function findFixedFeastByDate(lectionary, liturgicalName, date, yearCycle) {
	const nameUpper = liturgicalName.toUpperCase();
	const month = date.getMonth();
	const day = date.getDate();

	const monthNames = [
		'january', 'february', 'march', 'april', 'may', 'june',
		'july', 'august', 'september', 'october', 'november', 'december'
	];
	const monthName = monthNames[month];

	// Find feast keyword
	let feastKeyword = null;
	for (const [ordo, lect] of Object.entries(FIXED_FEASTS)) {
		if (nameUpper.includes(ordo)) {
			feastKeyword = lect;
			break;
		}
	}

	if (!feastKeyword) return null;

	// Build date patterns - include adjacent days for transferrable feasts
	// Australian feasts like "Mary Help of Christians" (May 24) can be transferred
	const datePatterns = [`${day} ${monthName}`, `${day}th ${monthName}`];

	// For transferrable feasts, also check adjacent days
	const transferrableFeasts = ['mary help of christians', 'mary of the cross'];
	if (transferrableFeasts.includes(feastKeyword)) {
		// Add day before and after
		if (day > 1) datePatterns.push(`${day - 1} ${monthName}`);
		datePatterns.push(`${day + 1} ${monthName}`);
	}

	// Search lectionary
	for (const entry of lectionary) {
		const lectName = entry.liturgical_day.toLowerCase();

		const hasDatePrefix = datePatterns.some(p => lectName.includes(p));
		const hasFeastKeyword = lectName.includes(feastKeyword);

		if (hasDatePrefix && hasFeastKeyword) {
			// For year-specific entries (Year A/B/C in name), match the year cycle
			const lectHasYearSuffix = /year [abc]/i.test(entry.liturgical_day);
			if (lectHasYearSuffix) {
				const lectYear = entry.liturgical_day.match(/year ([abc])/i)?.[1]?.toUpperCase();
				if (lectYear === yearCycle) {
					return {
						lectionary_id: entry.admin_order,
						lectionary_day: entry.liturgical_day,
						first_reading: entry.first_reading,
						psalm: entry.psalm,
						second_reading: entry.second_reading,
						gospel_reading: entry.gospel_reading
					};
				}
			} else if (entry.year && ['A', 'B', 'C'].includes(entry.year)) {
				if (entry.year === yearCycle) {
					return {
						lectionary_id: entry.admin_order,
						lectionary_day: entry.liturgical_day,
						first_reading: entry.first_reading,
						psalm: entry.psalm,
						second_reading: entry.second_reading,
						gospel_reading: entry.gospel_reading
					};
				}
			} else {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	return null;
}

/**
 * Find Christmas week reading (Dec 25-31)
 * Handles: Christmas Day, Holy Family, Dec 26-28 feasts, octave days
 */
function findChristmasWeekReading(lectionary, liturgicalName, day, isSunday, yearCycle) {
	const nameUpper = liturgicalName.toUpperCase();

	// HOLY FAMILY (Sunday in Christmas octave) - must use correct year cycle
	if (isSunday && (nameUpper.includes('HOLY FAMILY') || nameUpper.includes('FAMILIA'))) {
		for (const entry of lectionary) {
			if (entry.time === 'Christmas' &&
				entry.liturgical_day.toUpperCase().includes('HOLY FAMILY') &&
				entry.year === yearCycle) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	// CHRISTMAS DAY (Dec 25)
	if (day === 25 && (nameUpper.includes('NATIVITY') || nameUpper.includes('CHRISTMAS'))) {
		for (const entry of lectionary) {
			if (entry.time === 'Christmas' &&
				entry.liturgical_day.toLowerCase().includes('christmas day')) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	// DEC 26-28 FEASTS - match by date pattern in Christmas season
	if (day >= 26 && day <= 28) {
		const datePattern = `${day} december`.toLowerCase();
		for (const entry of lectionary) {
			if (entry.time !== 'Christmas') continue;

			const lectName = entry.liturgical_day.toLowerCase();
			if (lectName.includes(datePattern)) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	// DEC 29-31 OCTAVE DAYS
	if (day >= 29 && day <= 31) {
		const ordinals = { 29: 'fifth', 30: 'sixth', 31: 'seventh' };
		const ordinal = ordinals[day];
		const datePattern = `${day} december`.toLowerCase();

		for (const entry of lectionary) {
			if (entry.time !== 'Christmas') continue;

			const lectName = entry.liturgical_day.toLowerCase();
			if ((lectName.includes(`${ordinal} day`) && lectName.includes('octave')) ||
				lectName.includes(datePattern)) {
				return {
					lectionary_id: entry.admin_order,
					lectionary_day: entry.liturgical_day,
					first_reading: entry.first_reading,
					psalm: entry.psalm,
					second_reading: entry.second_reading,
					gospel_reading: entry.gospel_reading
				};
			}
		}
	}

	return null;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
	const args = process.argv.slice(2);
	const shouldPush = args.includes('--push');
	const checkDateIdx = args.indexOf('--check');
	const checkDate = checkDateIdx !== -1 ? args[checkDateIdx + 1] : null;

	console.log('='.repeat(80));
	console.log('ORDO → LECTIONARY PROCESSOR');
	console.log('='.repeat(80));

	// Initialize Supabase
	const supabase = createClient(
		process.env.PUBLIC_SUPABASE_URL,
		process.env.SUPABASE_SERVICE_ROLE_KEY
	);

	// Load lectionary
	console.log('\nLoading lectionary...');
	const { data: lectionary, error: lectError } = await supabase
		.from('lectionary')
		.select('admin_order, year, week, day, time, liturgical_day, first_reading, psalm, second_reading, gospel_reading')
		.order('admin_order');

	if (lectError) throw lectError;
	console.log(`  Loaded ${lectionary.length} lectionary entries`);

	// Load ordo calendar
	console.log('Loading ordo_calendar...');
	const { data: ordo, error: ordoError } = await supabase
		.from('ordo_calendar')
		.select('*')
		.order('calendar_date');

	if (ordoError) throw ordoError;
	console.log(`  Loaded ${ordo.length} ordo entries`);

	// Process each entry
	console.log('\nProcessing...');
	const results = [];
	let stats = { exact: 0, partial: 0, none: 0 };

	for (const entry of ordo) {
		// If checking specific date, skip others
		if (checkDate && entry.calendar_date !== checkDate) continue;

		const date = new Date(entry.calendar_date);
		const yearCycles = getYearCycles(date);

		const match = findLectionaryMatch(entry, lectionary, yearCycles);

		const result = {
			calendar_date: entry.calendar_date,
			liturgical_name: entry.liturgical_name,
			liturgical_rank: entry.liturgical_rank || inferRank(entry.liturgical_name),
			liturgical_season: entry.liturgical_season || inferSeason(entry.liturgical_name),
			liturgical_week: entry.liturgical_week || inferWeek(entry.liturgical_name),
			year_cycle: yearCycles.sundayCycle,
			weekday_cycle: yearCycles.weekdayCycle,
			lectionary_id: match?.lectionary_id || null,
			lectionary_name: match?.lectionary_day || 'NO MATCH',
			match_type: match?.match_type || 'none',
			match_method: match?.match_method || '',
			first_reading: match?.first_reading || '',
			psalm: match?.psalm || '',
			second_reading: match?.second_reading || '',
			gospel_reading: match?.gospel_reading || ''
		};

		results.push(result);

		if (match?.match_type === 'exact') stats.exact++;
		else if (match?.match_type === 'partial') stats.partial++;
		else stats.none++;
	}

	// Show results for specific date check
	if (checkDate) {
		const r = results[0];
		if (r) {
			console.log('\n' + '='.repeat(60));
			console.log(`DATE: ${r.calendar_date}`);
			console.log(`NAME: ${r.liturgical_name}`);
			console.log(`RANK: ${r.liturgical_rank}`);
			console.log(`SEASON: ${r.liturgical_season} | WEEK: ${r.liturgical_week}`);
			console.log(`YEAR CYCLE: ${r.year_cycle} (weekday: ${r.weekday_cycle})`);
			console.log('-'.repeat(60));
			console.log(`MATCH: ${r.lectionary_name}`);
			console.log(`METHOD: ${r.match_method} (${r.match_type})`);
			console.log(`GOSPEL: ${r.gospel_reading}`);
			console.log('='.repeat(60));
		} else {
			console.log(`No entry found for ${checkDate}`);
		}
		return;
	}

	// Stats
	console.log('\nStatistics:');
	console.log(`  Exact matches:   ${stats.exact} (${(stats.exact / ordo.length * 100).toFixed(1)}%)`);
	console.log(`  Partial matches: ${stats.partial} (${(stats.partial / ordo.length * 100).toFixed(1)}%)`);
	console.log(`  No matches:      ${stats.none} (${(stats.none / ordo.length * 100).toFixed(1)}%)`);

	// Write CSV
	const csvPath = 'data/generated/ordo_lectionary_mapping.csv';
	const headers = Object.keys(results[0]).join(',');
	const rows = results.map(r =>
		Object.values(r).map(v =>
			typeof v === 'string' && (v.includes(',') || v.includes('"'))
				? `"${v.replace(/"/g, '""')}"`
				: v ?? ''
		).join(',')
	);
	writeFileSync(csvPath, [headers, ...rows].join('\n'));
	console.log(`\n✅ CSV saved to: ${csvPath}`);

	// Push to database if requested
	if (shouldPush) {
		console.log('\nPushing to database...');

		// Update ordo_calendar with correct year_cycle
		for (const r of results) {
			await supabase
				.from('ordo_calendar')
				.update({
					year_cycle: r.year_cycle,
					liturgical_season: r.liturgical_season,
					liturgical_week: r.liturgical_week,
					liturgical_rank: r.liturgical_rank
				})
				.eq('calendar_date', r.calendar_date);
		}

		// Update ordo_lectionary_mapping
		const mappings = results
			.filter(r => r.lectionary_id)
			.map(r => ({
				calendar_date: r.calendar_date,
				lectionary_id: r.lectionary_id,
				match_type: r.match_type,
				match_method: r.match_method
			}));

		const { error: mapError } = await supabase
			.from('ordo_lectionary_mapping')
			.upsert(mappings, { onConflict: 'calendar_date' });

		if (mapError) throw mapError;

		console.log(`✅ Updated ${results.length} ordo_calendar entries`);
		console.log(`✅ Updated ${mappings.length} ordo_lectionary_mapping entries`);
	}

	// Show sample of Advent Sundays
	console.log('\n--- ADVENT SUNDAYS CHECK ---');
	const adventSundays = results.filter(r =>
		r.liturgical_name.toUpperCase().includes('SUNDAY') &&
		r.liturgical_name.toUpperCase().includes('ADVENT')
	);
	for (const a of adventSundays.slice(0, 8)) {
		console.log(`${a.calendar_date} | ${a.liturgical_name} | Year ${a.year_cycle} | ${a.gospel_reading.substring(0, 20)}...`);
	}
}

main().catch(console.error);
