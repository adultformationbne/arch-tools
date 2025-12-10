/**
 * Central Liturgical Rules Module
 *
 * SINGLE SOURCE OF TRUTH for:
 * 1. Year cycle lookup (A/B/C for Sundays, I/II for weekdays)
 * 2. Lectionary matching logic
 *
 * The Ordo CSV provides: calendar_date + liturgical_name
 * This module figures out: which lectionary entry to use
 */

import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { join } from 'path';

// Types
export interface YearCycleData {
	year: number;
	sundayCycle: 'A' | 'B' | 'C';
	weekdayCycle: 'I' | 'II';
	firstSundayOfAdvent: Date;
	// Extended fields for week calculation
	easterSunday?: string;
	pentecostSunday?: string;
	ashWednesday?: string;
	weekOfOtAfterPentecost?: number;
	weeksBeforeLent?: number;
}

export interface ProcessedOrdoEntry {
	calendar_date: string;
	liturgical_name: string;
	liturgical_rank: string;
	liturgical_season: string | null;
	liturgical_week: number | null;
	year_cycle: 'A' | 'B' | 'C';
	weekday_cycle: 'I' | 'II';
	lectionary_id: number | null;
	lectionary_name: string | null;
	match_type: 'exact' | 'partial' | 'none';
	match_method: string;
	first_reading: string | null;
	psalm: string | null;
	second_reading: string | null;
	gospel_reading: string | null;
}

// Cache
let yearDataCache: Map<number, YearCycleData> | null = null;

// Cache for auto-detected Brisbane week adjustments per year
// Key: year, Value: adjustment amount (0 or 1)
const brisbaneAdjustmentCache: Map<number, number> = new Map();

/**
 * Parse "Nov-30" or "Feb 27" into Date
 */
function parseMonthDay(dateStr: string, year: number): Date {
	const months: Record<string, number> = {
		'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
		'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
	};
	const [monthStr, dayStr] = dateStr.replace(' ', '-').split('-');
	return new Date(year, months[monthStr], parseInt(dayStr, 10));
}

/**
 * Load year cycle data from CSV
 */
export function loadYearCycleData(): Map<number, YearCycleData> {
	if (yearDataCache) return yearDataCache;

	const csvPath = join(process.cwd(), 'src/lib/data/litugical-year.csv');
	const csvContent = readFileSync(csvPath, 'utf-8');
	const records = parse(csvContent, { columns: true, skip_empty_lines: true });

	yearDataCache = new Map();
	for (const r of records) {
		const year = parseInt(r.year, 10);
		yearDataCache.set(year, {
			year,
			sundayCycle: r.sunday_cycle as 'A' | 'B' | 'C',
			weekdayCycle: r.weekday_cycle as 'I' | 'II',
			firstSundayOfAdvent: parseMonthDay(r.first_sunday_of_advent, year),
			// Extended fields for week calculation
			easterSunday: r.easter_sunday,
			pentecostSunday: r.pentecost_sunday,
			ashWednesday: r.ash_wednesday,
			weekOfOtAfterPentecost: r.week_of_ot_after_pentecost ? parseInt(r.week_of_ot_after_pentecost, 10) : undefined,
			weeksBeforeLent: r.weeks_of_ot_before_lent ? parseInt(r.weeks_of_ot_before_lent, 10) : undefined
		});
	}
	return yearDataCache;
}

/**
 * Get year cycles (A/B/C and I/II) for a calendar date
 *
 * Key rule: If date >= first_sunday_of_advent, we're in the NEXT liturgical year
 */
export function getYearCycles(date: Date): { sundayCycle: 'A' | 'B' | 'C'; weekdayCycle: 'I' | 'II' } {
	const data = loadYearCycleData();
	const calendarYear = date.getFullYear();

	const currentYear = data.get(calendarYear);
	if (!currentYear) throw new Error(`No data for year ${calendarYear}`);

	// Past first Sunday of Advent? Use next year's cycle
	if (date >= currentYear.firstSundayOfAdvent) {
		const nextYear = data.get(calendarYear + 1);
		if (!nextYear) throw new Error(`No data for year ${calendarYear + 1}`);
		return { sundayCycle: nextYear.sundayCycle, weekdayCycle: nextYear.weekdayCycle };
	}

	return { sundayCycle: currentYear.sundayCycle, weekdayCycle: currentYear.weekdayCycle };
}

/**
 * Calculate liturgical week number from date and season
 * Used for memorials where the week isn't in the name (e.g., "Saint Anthony")
 *
 * This is CRITICAL for matching memorials to weekday readings instead of saint readings.
 */
export function calculateLiturgicalWeek(date: Date, season: string | null): number | null {
	if (!season) return null;

	const data = loadYearCycleData();
	const calendarYear = date.getFullYear();
	const yearData = data.get(calendarYear);
	if (!yearData) return null;

	// Parse key dates from year data
	const easterSunday = yearData.easterSunday ? parseMonthDay(yearData.easterSunday, calendarYear) : null;
	const pentecostSunday = yearData.pentecostSunday ? parseMonthDay(yearData.pentecostSunday, calendarYear) : null;
	const ashWednesday = yearData.ashWednesday ? parseMonthDay(yearData.ashWednesday, calendarYear) : null;
	const weekOfOtAfterPentecost = yearData.weekOfOtAfterPentecost || 8;
	const weeksBeforeLent = yearData.weeksBeforeLent || 6;
	const firstSundayOfAdvent = yearData.firstSundayOfAdvent;

	const msPerDay = 24 * 60 * 60 * 1000;

	if (season === 'Easter' && easterSunday) {
		// Easter Week 1 = Easter Sunday week
		const daysSinceEaster = Math.floor((date.getTime() - easterSunday.getTime()) / msPerDay);
		if (daysSinceEaster < 0) return null;
		return Math.floor(daysSinceEaster / 7) + 1;
	}

	if (season === 'Lent' && ashWednesday) {
		// Lent Week 1 starts with Ash Wednesday
		const daysSinceAshWednesday = Math.floor((date.getTime() - ashWednesday.getTime()) / msPerDay);
		if (daysSinceAshWednesday < 0) return null;
		return Math.floor(daysSinceAshWednesday / 7) + 1;
	}

	if (season === 'Ordinary Time') {
		// After Pentecost: use week_of_ot_after_pentecost as base
		if (pentecostSunday) {
			const daysSincePentecost = Math.floor((date.getTime() - pentecostSunday.getTime()) / msPerDay);
			if (daysSincePentecost >= 0) {
				return weekOfOtAfterPentecost + Math.floor(daysSincePentecost / 7);
			}
		}

		// Before Lent: calculate from weeks_of_ot_before_lent working back from Ash Wednesday
		if (ashWednesday) {
			const daysUntilLent = Math.floor((ashWednesday.getTime() - date.getTime()) / msPerDay);
			if (daysUntilLent > 0 && daysUntilLent < 70) {
				const fullWeeksBeforeAsh = Math.floor((daysUntilLent - 1) / 7);
				const week = weeksBeforeLent - fullWeeksBeforeAsh;
				if (week >= 1) return week;
			}
		}
		return null;
	}

	if (season === 'Advent' && firstSundayOfAdvent) {
		// Advent has 4 weeks, starting from First Sunday of Advent
		const daysSinceAdventStart = Math.floor((date.getTime() - firstSundayOfAdvent.getTime()) / msPerDay);
		if (daysSinceAdventStart >= 0 && daysSinceAdventStart < 28) {
			return Math.floor(daysSinceAdventStart / 7) + 1;
		}
		return null;
	}

	return null;
}

/**
 * Detect the Brisbane week adjustment needed for a specific year.
 *
 * Rule: Brisbane's OT Sunday numbering after Pentecost differs from the lectionary
 * based on when Pentecost falls. When week_of_ot_after_pentecost >= 10 (late Pentecost),
 * Brisbane matches lectionary directly. When < 10 (early Pentecost), Brisbane needs +1.
 *
 * Verified against:
 * - 2025 (week=10): Brisbane "14 ORDINARY" = Lectionary 14th Sunday ✓
 * - 2026 (week=8): Brisbane "11 ORDINARY" = Lectionary 12th Sunday ✓
 *
 * @param year - Calendar year to detect adjustment for
 * @returns 0 if no adjustment needed, 1 if +1 adjustment needed
 */
export function detectBrisbaneAdjustment(year: number): number {
	// Check cache first
	if (brisbaneAdjustmentCache.has(year)) {
		return brisbaneAdjustmentCache.get(year)!;
	}

	const data = loadYearCycleData();
	const yearData = data.get(year);
	if (!yearData) {
		brisbaneAdjustmentCache.set(year, 0);
		return 0;
	}

	const weekOfOt = yearData.weekOfOtAfterPentecost || 8;

	// Rule: When Pentecost is late (week >= 10), Brisbane matches lectionary.
	// When Pentecost is early (week < 10), Brisbane is 1 less than lectionary.
	const adjustment = weekOfOt >= 10 ? 0 : 1;

	brisbaneAdjustmentCache.set(year, adjustment);
	return adjustment;
}

/**
 * Adjust Brisbane Ordo week number to match Roman Lectionary numbering
 *
 * This function uses auto-detected adjustments when available (via detectBrisbaneAdjustment),
 * or falls back to a heuristic based on week_of_ot_after_pentecost.
 *
 * This only applies to OT Sundays after Pentecost with week < 33.
 */
export function adjustBrisbaneWeekForLectionary(
	week: number,
	season: string | null,
	date: Date,
	isSunday: boolean
): number {
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
		// Check if we have a cached/detected adjustment for this year
		if (brisbaneAdjustmentCache.has(calendarYear)) {
			return week + brisbaneAdjustmentCache.get(calendarYear)!;
		}

		// Fallback: use heuristic based on week_of_ot_after_pentecost
		const weekOfOtAfterPentecost = yearData.weekOfOtAfterPentecost || 8;
		if (weekOfOtAfterPentecost < 10) {
			return week + 1;
		}
	}

	return week;
}

/**
 * Clear the Brisbane adjustment cache (useful for testing)
 */
export function clearBrisbaneAdjustmentCache(): void {
	brisbaneAdjustmentCache.clear();
}

/**
 * Infer rank from liturgical name
 */
export function inferRank(name: string): string {
	const upper = name.toUpperCase();

	// All caps + key words = Solemnity
	if (name === upper && (
		upper.includes('CHRISTMAS') || upper.includes('EASTER') || upper.includes('PENTECOST') ||
		upper.includes('ASCENSION') || upper.includes('TRINITY') || upper.includes('ASSUMPTION') ||
		upper.includes('EPIPHANY') || upper.includes('NATIVITY') || upper.includes('IMMACULATE') ||
		upper.includes('ALL SAINTS') || upper.includes('MARY') || upper.includes('HOLY FAMILY') ||
		upper.includes('BODY AND BLOOD') || upper.includes('SACRED HEART') ||
		upper.includes('CHRIST') || upper.includes('SUNDAY OF ADVENT') ||
		upper.includes('SUNDAY OF EASTER') || upper.includes('SUNDAY OF LENT') ||
		upper.includes('SUNDAY IN ORDINARY')
	)) {
		return upper.includes('SUNDAY') ? 'Sunday' : 'Solemnity';
	}

	if (upper.includes('SUNDAY')) return 'Sunday';
	if (upper.includes('PALM SUNDAY') || upper.includes('PASSION')) return 'Sunday';

	// Saints
	if (upper.includes('SAINT') || upper.includes('ST ') || upper.includes('ST.') || upper.startsWith('SS ')) {
		return upper.includes('OPTIONAL') ? 'Optional Memorial' : 'Memorial';
	}

	// Weekdays
	if (/\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)\b/.test(upper)) {
		return 'Feria';
	}

	// December dates (17-24 December)
	if (/^\d{1,2}\s+(DECEMBER|DEC)/.test(upper)) {
		return 'Feria';
	}

	return 'Feria';
}

/**
 * Infer season from liturgical name
 */
export function inferSeason(name: string): string | null {
	const upper = name.toUpperCase();

	if (upper.includes('ADVENT')) return 'Advent';
	if (upper.includes('CHRISTMAS') || upper.includes('EPIPHANY') || upper.includes('BAPTISM')) return 'Christmas';
	if (upper.includes('LENT') || upper.includes('ASH WEDNESDAY')) return 'Lent';
	if (upper.includes('PALM') || upper.includes('HOLY WEEK') || upper.includes('PASSION')) return 'Holy Week';
	if (upper.includes('HOLY THURSDAY') || upper.includes('GOOD FRIDAY') || upper.includes('HOLY SATURDAY')) return 'Easter Triduum';
	if (upper.includes('EASTER') || upper.includes('PENTECOST') || upper.includes('ASCENSION')) return 'Easter';
	if (upper.includes('ORDINARY') || /\b\d+\s+(SUNDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY)\b/.test(upper)) return 'Ordinary Time';

	// December dates are Advent
	if (/^\d{1,2}\s+(DECEMBER|DEC)/.test(upper)) return 'Advent';

	return null;
}

/**
 * Infer week number from liturgical name
 */
export function inferWeek(name: string): number | null {
	const upper = name.toUpperCase();

	// Match patterns like "1 LENT", "FIRST SUNDAY OF ADVENT", "Monday of the thirty-second week"
	const ordinalMap: Record<string, number> = {
		'FIRST': 1, 'SECOND': 2, 'THIRD': 3, 'FOURTH': 4, 'FIFTH': 5,
		'SIXTH': 6, 'SEVENTH': 7, 'EIGHTH': 8, 'NINTH': 9, 'TENTH': 10,
		'ELEVENTH': 11, 'TWELFTH': 12, 'THIRTEENTH': 13, 'FOURTEENTH': 14,
		'FIFTEENTH': 15, 'SIXTEENTH': 16, 'SEVENTEENTH': 17, 'EIGHTEENTH': 18,
		'NINETEENTH': 19, 'TWENTIETH': 20, 'TWENTY-FIRST': 21, 'TWENTY-SECOND': 22,
		'TWENTY-THIRD': 23, 'TWENTY-FOURTH': 24, 'TWENTY-FIFTH': 25,
		'TWENTY-SIXTH': 26, 'TWENTY-SEVENTH': 27, 'TWENTY-EIGHTH': 28,
		'TWENTY-NINTH': 29, 'THIRTIETH': 30, 'THIRTY-FIRST': 31,
		'THIRTY-SECOND': 32, 'THIRTY-THIRD': 33, 'THIRTY-FOURTH': 34
	};

	// Check for ordinal words
	for (const [word, num] of Object.entries(ordinalMap)) {
		if (upper.includes(word)) return num;
	}

	// Check for "1 LENT", "2 EASTER" pattern
	const numMatch = upper.match(/^(\d+)\s+(LENT|EASTER|ADVENT|ORDINARY)/);
	if (numMatch) return parseInt(numMatch[1], 10);

	// Check for "Week 32" or "week of Week 32" pattern
	const weekMatch = upper.match(/WEEK\s+(\d+)/);
	if (weekMatch) return parseInt(weekMatch[1], 10);

	return null;
}

/**
 * Map Brisbane feast names to lectionary names
 * These are common naming differences between Australian Ordo and Roman Lectionary
 */
const FEAST_NAME_MAPPINGS: Record<string, string> = {
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

/**
 * Normalize text for lectionary matching
 */
export function normalize(text: string): string {
	if (!text) return '';

	let n = text.toUpperCase().trim();

	// Apply feast name mappings first
	for (const [from, to] of Object.entries(FEAST_NAME_MAPPINGS)) {
		if (n.includes(from)) {
			n = n.replace(from, to);
		}
	}

	// Remove date prefixes
	n = n.replace(/^\d{1,2}\s+[A-Z]+\s*[–—-]\s*/, '');

	// Remove year suffix
	n = n.replace(/,?\s*YEAR\s+[ABC]\s*$/i, '');

	// Normalize ordinals to numbers
	const ordinals: [string, string][] = [
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

	// Normalize saints
	n = n.replace(/\bSS\b\.?\s+/g, 'SAINTS ');
	n = n.replace(/\bST\b\.?\s+/g, 'SAINT ');

	// Normalize prepositions
	n = n.replace(/ IN LENT/g, ' OF LENT');
	n = n.replace(/ IN ADVENT/g, ' OF ADVENT');
	n = n.replace(/ IN EASTER/g, ' OF EASTER');
	n = n.replace(/ IN ORDINARY TIME/g, '');
	n = n.replace(/ OF ORDINARY TIME/g, '');

	return n.replace(/\s+/g, ' ').trim();
}

/**
 * Get day of week from date
 */
export function getDayOfWeek(date: Date): string {
	return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
}

/**
 * Check if this is a memorial (uses weekday readings, not saint readings)
 */
export function isMemorial(rank: string): boolean {
	const r = rank.toLowerCase();
	return r.includes('memorial');
}

/**
 * Find Triduum reading - Holy Thursday, Good Friday, Easter Vigil
 * These have unique entries in the lectionary that need exact matching
 */
export function findTriduumReading(lectionary: any[], liturgicalName: string, yearCycle: string): any | null {
	const nameUpper = liturgicalName.toUpperCase();

	// HOLY THURSDAY - "HOLY THURSDAY - Mass of the Lord's Supper"
	if (nameUpper.includes('HOLY THURSDAY') || nameUpper.includes("LORD'S SUPPER") || nameUpper.includes('MAUNDY')) {
		for (const lect of lectionary) {
			const lectName = lect.liturgical_day.toUpperCase();
			if (lectName.includes('HOLY THURSDAY') || lectName.includes("LORD'S SUPPER")) {
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

	// GOOD FRIDAY - "GOOD FRIDAY - Solemn Commemoration of the Lord's Passion"
	if (nameUpper.includes('GOOD FRIDAY') || nameUpper.includes("LORD'S PASSION")) {
		for (const lect of lectionary) {
			const lectName = lect.liturgical_day.toUpperCase();
			if (lectName.includes('GOOD FRIDAY') || lectName.includes("LORD'S PASSION")) {
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

	// EASTER VIGIL - "THE EASTER VIGIL - Year A/B/C"
	if (nameUpper.includes('EASTER VIGIL') && !nameUpper.includes('SUNDAY')) {
		for (const lect of lectionary) {
			const lectName = lect.liturgical_day.toUpperCase();
			if (lectName.includes('EASTER VIGIL') && lect.year === yearCycle) {
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

	// PENTECOST SUNDAY (not Vigil) - "PENTECOST SUNDAY, Year A/B/C"
	if (nameUpper === 'PENTECOST' || nameUpper.includes('PENTECOST SUNDAY')) {
		for (const lect of lectionary) {
			const lectName = lect.liturgical_day.toUpperCase();
			if (lectName.includes('PENTECOST SUNDAY') && lect.year === yearCycle) {
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
 * Known fixed feasts with date prefixes in lectionary
 * Maps: Brisbane Ordo name keywords -> lectionary entry keywords
 */
const FIXED_FEASTS: Record<string, string> = {
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
	'MARY OF THE CROSS': 'mary of the cross',
	// Apostle & Archangel Feasts (have proper readings, not weekday)
	'MICHAEL, GABRIEL AND RAPHAEL': 'michael, gabriel and raphael',
	'MICHAEL, GABRIEL, RAPHAEL': 'michael, gabriel and raphael',
	'ARCHANGELS': 'michael, gabriel and raphael',
	'SIMON AND JUDE': 'simon and jude',
	'ANDREW': 'andrew',
	'THOMAS': 'thomas',
	'JAMES': 'james',
	'PHILIP AND JAMES': 'philip and james',
	'BARTHOLOMEW': 'bartholomew',
	'MATTHEW': 'matthew',
	'LUKE': 'luke',
	'MARK': 'mark'
};

/**
 * Find Fixed Feast by calendar date
 * Matches entries like "6 August – Transfiguration (Year A)" by date + keyword
 * This handles feasts that have date prefixes in the lectionary
 */
export function findFixedFeastByDate(lectionary: any[], liturgicalName: string, date: Date, yearCycle: string): any | null {
	const nameUpper = liturgicalName.toUpperCase();
	const month = date.getMonth(); // 0-indexed
	const day = date.getDate();

	// Month names for matching date prefixes
	const monthNames = [
		'january', 'february', 'march', 'april', 'may', 'june',
		'july', 'august', 'september', 'october', 'november', 'december'
	];
	const monthName = monthNames[month];

	// Check if this is a known fixed feast
	let feastKeyword: string | null = null;
	for (const [ordo, lect] of Object.entries(FIXED_FEASTS)) {
		if (nameUpper.includes(ordo)) {
			feastKeyword = lect;
			break;
		}
	}

	if (!feastKeyword) return null;

	// Build date patterns to match
	const datePatterns = [
		`${day} ${monthName}`,       // "6 august"
		`${day}th ${monthName}`,     // "6th august"
	];

	// Search for matching lectionary entry
	for (const lect of lectionary) {
		const lectName = lect.liturgical_day.toLowerCase();

		// Check if this entry has our date pattern and feast keyword
		const hasDatePrefix = datePatterns.some(p => lectName.includes(p));
		const hasFeastKeyword = lectName.includes(feastKeyword);

		if (hasDatePrefix && hasFeastKeyword) {
			// For year-specific entries (A/B/C), match the year cycle
			if (lect.year && ['A', 'B', 'C'].includes(lect.year)) {
				if (lect.year === yearCycle) {
					return {
						admin_order: lect.admin_order,
						first_reading: lect.first_reading,
						psalm: lect.psalm,
						second_reading: lect.second_reading,
						gospel_reading: lect.gospel_reading
					};
				}
			} else {
				// No year specified, use this entry
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

// For CLI/testing
export { parseMonthDay };
