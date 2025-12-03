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
			firstSundayOfAdvent: parseMonthDay(r.first_sunday_of_advent, year)
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
 * Normalize text for lectionary matching
 */
export function normalize(text: string): string {
	if (!text) return '';

	let n = text.toUpperCase().trim();

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

// For CLI/testing
export { parseMonthDay };
