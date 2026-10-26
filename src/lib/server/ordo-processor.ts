/**
 * Ordo → Lectionary processor (single source of truth)
 *
 * Used by the DGR liturgical calendar upload (/api/dgr/liturgical-calendar/upload)
 * and by `scripts/process-ordo.ts`. Do not add a second matcher anywhere else.
 *
 * How it works:
 * 1. The liturgical identity of every date (season, week, Sunday/weekday, A/B/C and I/II
 *    cycles) is CALCULATED from the date — Easter, Advent, Epiphany etc. are computed.
 *    The Ordo's wording is never trusted for this; it is only cross-checked, and any
 *    disagreement becomes a warning on that day.
 * 2. The Ordo decides which celebration a date keeps. Solemnities (ALL CAPS in the
 *    Brisbane Ordo) and the feasts in PROPER_CELEBRATIONS use their proper readings.
 *    Every other saint's day is a memorial and uses the weekday readings.
 *
 * Australian calendar assumptions: Epiphany, Ascension and Corpus Christi are kept on
 * Sundays; St Mark is 26 April (Anzac Day takes 25 April).
 *
 * Kept free of $lib / Vite imports so it runs under plain Node (scripts/process-ordo.ts).
 */
import { parse } from 'csv-parse/sync';

export interface LectionaryRow {
	admin_order: number | null;
	year: string | null;
	week: string | null;
	day: string | null;
	time: string | null;
	liturgical_day: string;
	first_reading: string | null;
	psalm: string | null;
	second_reading: string | null;
	gospel_reading: string | null;
}

/** A lectionary row that can be referenced (the table allows a null admin_order) */
interface Entry extends LectionaryRow {
	admin_order: number;
}

export interface OrdoRow {
	date: string; // YYYY-MM-DD
	name: string;
}

export interface ProcessedEntry {
	calendar_date: string;
	liturgical_name: string;
	liturgical_year: number;
	liturgical_season: string;
	liturgical_week: number | null;
	liturgical_rank: string;
	year_cycle: 'A' | 'B' | 'C';
	weekday_cycle: 'I' | 'II';
	lectionary_id: number | null;
	lectionary_name: string | null;
	match_type: 'exact' | 'none';
	match_method: string | null;
	first_reading: string | null;
	psalm: string | null;
	second_reading: string | null;
	gospel_reading: string | null;
	warnings: string[];
	error: string | null;
}

export interface ProcessResult {
	total: number;
	exact: number;
	partial: number;
	unmatched: number;
	warningCount: number;
	errorCount: number;
	/** Problems with the file as a whole (missing or duplicate dates) */
	fileWarnings: string[];
	entries: ProcessedEntry[];
}

/**
 * Fixed-date celebrations that take their own readings, following what the Brisbane Ordo
 * prints: feasts, plus the few memorials whose readings the lectionary makes compulsory
 * (marked 'memorial'). Every other memorial — even when it is the Ordo's first option —
 * is printed in the Ordo with the weekday readings (checked against the 2026 Ordo).
 * Solemnities are recognised from the Ordo's ALL CAPS anyway, but are listed so a
 * transferred solemnity can be found by name.
 * [MM-DD of the lectionary entry, keyword in its name, 'memorial'?]
 */
const PROPER_CELEBRATIONS: [string, string, 'memorial'?][] = [
	['01-25', 'conversion'],
	['01-26', 'australia day'],
	['01-27', 'timothy', 'memorial'],
	['02-02', 'presentation of the lord'],
	['02-22', 'chair of peter'],
	['03-17', 'patrick'],
	['03-19', 'joseph'],
	['03-25', 'annunciation'],
	['04-25', 'anzac'],
	['04-26', 'mark'],
	['05-03', 'philip and james'],
	['05-14', 'matthias'],
	['05-24', 'help of christians'],
	['05-31', 'visitation'],
	['06-11', 'barnabas', 'memorial'],
	['06-24', 'birth of john'],
	['06-29', 'peter and paul'],
	['07-03', 'thomas'],
	['07-22', 'mary magdalene'],
	['07-25', 'james'],
	['07-29', 'martha', 'memorial'],
	['08-06', 'transfiguration'],
	['08-08', 'mary of the cross'],
	['08-10', 'lawrence'],
	['08-15', 'assumption'],
	['08-24', 'bartholomew'],
	['08-29', 'beheading', 'memorial'],
	['09-08', 'birth of mary'],
	['09-14', 'exaltation'],
	['09-15', 'sorrows', 'memorial'],
	['09-21', 'matthew'],
	['09-29', 'michael'],
	['10-02', 'guardian angels', 'memorial'],
	['10-18', 'luke'],
	['10-28', 'simon and jude'],
	['11-01', 'all saints'],
	['11-02', 'all souls'],
	['11-09', 'lateran'],
	['11-30', 'andrew'],
	['12-08', 'immaculate conception']
];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const ORDINALS = [
	'', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
	'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth',
	'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third',
	'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth',
	'twenty-ninth', 'thirtieth', 'thirty-first', 'thirty-second', 'thirty-third', 'thirty-fourth'
];

// ---------------------------------------------------------------------------
// Date arithmetic on day numbers (days since 1970-01-01, UTC) — no timezone surprises
// ---------------------------------------------------------------------------

const dayNum = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / 86400000;
const fromIso = (iso: string) => {
	const [y, m, d] = iso.split('-').map(Number);
	return dayNum(y, m, d);
};
const toParts = (dn: number) => {
	const dt = new Date(dn * 86400000);
	return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
};
const toIso = (dn: number) => new Date(dn * 86400000).toISOString().slice(0, 10);
const weekday = (dn: number) => (((dn + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
const pad = (n: number) => String(n).padStart(2, '0');
const ordinalSuffix = (n: number) =>
	n >= 11 && n <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th';

/** Gregorian Easter (Meeus/Jones/Butcher) */
export function easterSunday(y: number): number {
	const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
	const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
	return dayNum(y, month, day);
}

export function firstSundayOfAdvent(y: number): number {
	const christmas = dayNum(y, 12, 25);
	const fourthSunday = christmas - (weekday(christmas) || 7);
	return fourthSunday - 21;
}

/** Epiphany is kept on the Sunday between 2 and 8 January (Australia) */
function epiphany(y: number): number {
	const jan2 = dayNum(y, 1, 2);
	return jan2 + ((7 - weekday(jan2)) % 7);
}

/** Baptism: Sunday after Epiphany, or the Monday when Epiphany falls on 7 or 8 January */
function baptism(y: number): number {
	const ep = epiphany(y);
	return toParts(ep).d >= 7 ? ep + 1 : ep + 7;
}

/** Holy Family: Sunday within the Christmas octave, else 30 December */
function holyFamily(y: number): number {
	for (let d = 26; d <= 31; d++) if (weekday(dayNum(y, 12, d)) === 0) return dayNum(y, 12, d);
	return dayNum(y, 12, 30);
}

/** A/B/C and I/II cycles for a YYYY-MM-DD date (switches at the First Sunday of Advent) */
export function cyclesForDate(iso: string) {
	return yearCycles(fromIso(iso));
}

function yearCycles(dn: number): { sundayCycle: 'A' | 'B' | 'C'; weekdayCycle: 'I' | 'II' } {
	const { y } = toParts(dn);
	const liturgicalYear = dn >= firstSundayOfAdvent(y) ? y + 1 : y;
	return {
		sundayCycle: (['C', 'A', 'B'] as const)[liturgicalYear % 3],
		weekdayCycle: liturgicalYear % 2 === 1 ? 'I' : 'II'
	};
}

// ---------------------------------------------------------------------------
// Temporal identity of a date
// ---------------------------------------------------------------------------

type Lookup =
	| { kind: 'name'; name: string }
	| { kind: 'prefix'; prefix: string; time: string }
	| { kind: 'ot-sunday'; week: number }
	| { kind: 'ot-weekday'; week: number; dow: string };

interface Temporal {
	season: string;
	week: number | null;
	isSunday: boolean;
	/** Outranks anything the Ordo might put on this date */
	fixed: boolean;
	rank: string;
	label: string;
	lookup: Lookup;
}

export function temporalDay(dn: number): Temporal {
	const { y, m, d } = toParts(dn);
	const dowNum = weekday(dn);
	const dow = DAYS[dowNum];
	const isSunday = dowNum === 0;
	const { sundayCycle: c } = yearCycles(dn);
	const cl = c.toLowerCase();
	const E = easterSunday(y);
	const advent = firstSundayOfAdvent(y);
	const ash = E - 46;
	const pentecost = E + 49;
	const t = (season: string, week: number | null, fixed: boolean, rank: string, label: string, lookup: Lookup): Temporal => ({
		season, week, isSunday, fixed, rank, label, lookup
	});
	const byName = (name: string): Lookup => ({ kind: 'name', name });

	// Christmas and its octave
	if (m === 12 && d === 25) return t('Christmas', null, true, 'Solemnity', 'Christmas Day', byName('christmas day'));
	if (m === 12 && d > 25) {
		if (dn === holyFamily(y)) return t('Christmas', null, true, 'Feast', 'Holy Family', byName(`holy family, year ${cl}`));
		return t('Christmas', null, true, d <= 28 ? 'Feast' : 'Feria', `${d} December`, { kind: 'prefix', prefix: `${d} december`, time: 'Christmas' });
	}

	// Advent
	if (dn >= advent) {
		const week = Math.floor((dn - advent) / 7) + 1;
		if (isSunday) return t('Advent', week, true, 'Sunday', `${ORDINALS[week]} Sunday of Advent`, byName(`${ORDINALS[week]} sunday of advent, year ${cl}`));
		if (m === 12 && d >= 17) return t('Advent', week, false, 'Feria', `${d} December`, byName(`${d}${ordinalSuffix(d)} december`));
		if (week === 1 && dowNum === 1) {
			return t('Advent', week, false, 'Feria', 'Monday of the first week of Advent', byName(`monday of the first week of advent - year ${c === 'A' ? 'a' : 'b/c'}`));
		}
		return t('Advent', week, false, 'Feria', `${dow} of the ${ORDINALS[week]} week of Advent`, byName(`${dow.toLowerCase()} of the ${ORDINALS[week]} week of advent`));
	}

	// Christmas season in January
	if (m === 1 && d === 1) return t('Christmas', null, true, 'Solemnity', 'Mary, Mother of God', { kind: 'prefix', prefix: '1 january', time: 'Christmas' });
	const ep = epiphany(y);
	const bap = baptism(y);
	if (dn < bap) {
		if (dn === ep) return t('Christmas', null, true, 'Solemnity', 'Epiphany', byName('epiphany'));
		if (dn < ep) return t('Christmas', null, false, 'Feria', `${d} January`, byName(`${d}${ordinalSuffix(d)} january`));
		return t('Christmas', null, false, 'Feria', `${dow} after Epiphany`, byName(`${dow.toLowerCase()} after epiphany`));
	}
	if (dn === bap) return t('Christmas', 1, true, 'Feast', 'Baptism of the Lord', byName(`baptism of the lord, year ${cl}`));

	// Ordinary Time before Lent (week 1 starts the day after the Baptism)
	if (dn < ash) {
		const anchor = weekday(bap) === 0 ? bap : ep;
		const week = Math.floor((dn - anchor) / 7) + 1;
		return isSunday
			? t('Ordinary Time', week, false, 'Sunday', `${week} Ordinary`, { kind: 'ot-sunday', week })
			: t('Ordinary Time', week, false, 'Feria', `${dow} of week ${week} in Ordinary Time`, { kind: 'ot-weekday', week, dow });
	}

	// Lent
	if (dn < E - 42) {
		if (dn === ash) return t('Lent', null, true, 'Feria', 'Ash Wednesday', byName('ash wednesday'));
		return t('Lent', null, false, 'Feria', `${dow} after Ash Wednesday`, byName(`${dow.toLowerCase()} after ash wednesday`));
	}
	if (dn < E - 7) {
		const week = Math.floor((dn - (E - 42)) / 7) + 1;
		if (isSunday) return t('Lent', week, true, 'Sunday', `${ORDINALS[week]} Sunday of Lent`, byName(`${ORDINALS[week]} sunday in lent, year ${cl}`));
		return t('Lent', week, false, 'Feria', `${dow} of the ${ORDINALS[week]} week of Lent`, byName(`${dow.toLowerCase()} of the ${ORDINALS[week]} week of lent`));
	}

	// Holy Week and the Triduum
	if (dn < E) {
		if (dn === E - 7) return t('Holy Week', 6, true, 'Sunday', 'Palm Sunday', byName(`passion sunday (palm sunday), year ${cl}`));
		if (dn === E - 3) return t('Easter Triduum', null, true, 'Solemnity', 'Holy Thursday', { kind: 'prefix', prefix: 'holy thursday', time: 'Easter Triduum' });
		if (dn === E - 2) return t('Easter Triduum', null, true, 'Solemnity', 'Good Friday', { kind: 'prefix', prefix: 'good friday', time: 'Easter Triduum' });
		if (dn === E - 1) return t('Easter Triduum', null, true, 'Solemnity', 'Easter Vigil', byName(`the easter vigil - year ${cl}`));
		return t('Holy Week', 6, true, 'Feria', `${dow} of Holy Week`, byName(`${dow.toLowerCase()} of holy week`));
	}

	// Easter season (Ascension is kept on the 7th Sunday in Australia)
	if (dn <= pentecost) {
		const week = Math.floor((dn - E) / 7) + 1;
		if (dn === E) return t('Easter', 1, true, 'Solemnity', 'Easter Sunday', byName('easter sunday'));
		if (dn === pentecost) return t('Easter', null, true, 'Solemnity', 'Pentecost', byName(`pentecost sunday, year ${cl}`));
		if (week === 1) return t('Easter', 1, true, 'Solemnity', `Easter ${dow}`, byName(`easter ${dow.toLowerCase()}`));
		if (isSunday && week === 7) return t('Easter', 7, true, 'Solemnity', 'Ascension', byName(`the ascension of the lord, year ${cl}`));
		if (isSunday) return t('Easter', week, true, 'Sunday', `${ORDINALS[week]} Sunday of Easter`, byName(`${ORDINALS[week]} sunday of easter, year ${cl}`));
		if (week === 4 && dowNum === 1) return t('Easter', week, false, 'Feria', 'Monday of the fourth week of Easter', byName(`monday of the fourth week of easter - ${cl}`));
		return t('Easter', week, false, 'Feria', `${dow} of the ${ORDINALS[week]} week of Easter`, byName(`${dow.toLowerCase()} of the ${ORDINALS[week]} week of easter`));
	}

	// Ordinary Time after Pentecost, numbered back from Christ the King (week 34)
	const week = 34 - Math.floor((advent - 1 - dn) / 7);
	if (dn === pentecost + 7) return t('Ordinary Time', week, true, 'Solemnity', 'Trinity Sunday', byName(`trinity sunday, year ${cl}`));
	if (dn === pentecost + 14) return t('Ordinary Time', week, true, 'Solemnity', 'Body and Blood of Christ', byName(`the body and blood of christ, year ${cl}`));
	if (dn === pentecost + 19) return t('Ordinary Time', week, true, 'Solemnity', 'Sacred Heart', byName(`most sacred heart of jesus, year ${cl}`));
	if (dn === advent - 7) return t('Ordinary Time', 34, true, 'Solemnity', 'Christ the King', { kind: 'ot-sunday', week: 34 });
	return isSunday
		? t('Ordinary Time', week, false, 'Sunday', `${week} Ordinary`, { kind: 'ot-sunday', week })
		: t('Ordinary Time', week, false, 'Feria', `${dow} of week ${week} in Ordinary Time`, { kind: 'ot-weekday', week, dow });
}

// ---------------------------------------------------------------------------
// Lectionary index
// ---------------------------------------------------------------------------

const cleanName = (s: string) => s.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

/** "26 April – St Mark" → "04-26"; null for entries without a date prefix */
function rowDateKey(row: Entry): string | null {
	const match = row.liturgical_day.toLowerCase().match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
	if (!match) return null;
	const month = MONTHS.indexOf(match[2]);
	return month < 0 ? null : `${pad(month + 1)}-${pad(parseInt(match[1], 10))}`;
}

/** Significant words of a celebration name, for comparing Ordo and lectionary names */
function nameTokens(name: string): Set<string> {
	const STOP = new Set([
		'the', 'of', 'and', 'saint', 'saints', 'st', 'ss', 'sts', 'a', 'in', 'our', 'lady', 'blessed',
		'virgin', 'lord', 'holy', 'pope', 'apostle', 'apsotle', 'apostles', 'evangelist', 'martyr',
		'martyrs', 'companions', 'year', 'vigil', 'australia', 'commemoration', 'most', 'his', 'her'
	]);
	let s = name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/^\d{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s*\([^)]*\))?\s*[-–—]\s*/, '')
		.replace(/\([^)]*\)/g, ' ')
		.replace(/\byear [abc]\b/g, ' ')
		.replace(/all the faithful departed/g, 'all souls')
		.replace(/\bnativity\b/g, 'birth')
		.replace(/\bpassion\b/g, 'beheading');
	s = s.replace(/[^a-z\s]/g, ' ');
	return new Set(s.split(/\s+/).filter((w) => w && !STOP.has(w)));
}

function overlap(a: Set<string>, b: Set<string>): number {
	let n = 0;
	for (const w of a) if (b.has(w)) n++;
	return n;
}

class LectionaryIndex {
	byName = new Map<string, Entry[]>();
	sanctoral: Entry[] = [];
	properIds = new Set<number>();
	properMemorialIds = new Set<number>();
	rows: Entry[];

	constructor(rows: LectionaryRow[]) {
		this.rows = rows.filter((r): r is Entry => r.admin_order != null);
		for (const row of this.rows) {
			const key = cleanName(row.liturgical_day);
			if (!this.byName.has(key)) this.byName.set(key, []);
			this.byName.get(key)!.push(row);
			if (row.time === 'Fixed Feast' && rowDateKey(row)) this.sanctoral.push(row);
		}
		for (const row of this.sanctoral) {
			const key = rowDateKey(row);
			const lower = row.liturgical_day.toLowerCase();
			const listed = PROPER_CELEBRATIONS.find(([md, word]) => md === key && lower.includes(word));
			if (listed) this.properIds.add(row.admin_order);
			if (listed?.[2] === 'memorial') this.properMemorialIds.add(row.admin_order);
		}
	}

	lookup(l: Lookup, cycles: { sundayCycle: string; weekdayCycle: string }): Entry | null {
		if (l.kind === 'name') return this.byName.get(cleanName(l.name))?.[0] ?? null;
		if (l.kind === 'prefix') {
			return this.rows.find((r) => r.time === l.time && cleanName(r.liturgical_day).startsWith(l.prefix)) ?? null;
		}
		if (l.kind === 'ot-sunday') {
			if (l.week === 1) return this.lookup({ kind: 'name', name: `baptism of the lord, year ${cycles.sundayCycle.toLowerCase()}` }, cycles);
			return this.rows.find((r) => r.time === 'Ordinary' && r.day === 'Sunday' && r.week === String(l.week) && r.year === cycles.sundayCycle) ?? null;
		}
		const year = cycles.weekdayCycle === 'I' ? '1' : '2';
		return this.rows.find((r) => r.time === 'Ordinary' && r.year === year && r.week === String(l.week) && r.day === l.dow) ?? null;
	}

	/** The cycle-appropriate variant of a sanctoral entry (e.g. "6 August – Transfiguration (Year B)") */
	resolveVariant(row: Entry, sundayCycle: string): Entry {
		const key = rowDateKey(row);
		const tokens = nameTokens(row.liturgical_day);
		const variants = this.sanctoral.filter((r) => {
			if (rowDateKey(r) !== key) return false;
			const t = nameTokens(r.liturgical_day);
			return t.size === tokens.size && overlap(t, tokens) === tokens.size;
		});
		// The cycle is in the year column, or only in the name ("…, Year B")
		const cycleOf = (r: Entry) =>
			['A', 'B', 'C'].includes(r.year ?? '') ? r.year : (r.liturgical_day.match(/\byear ([abc])\b/i)?.[1].toUpperCase() ?? null);
		return variants.find((r) => cycleOf(r) === sundayCycle) ?? variants.find((r) => !cycleOf(r)) ?? row;
	}

	/** Find the lectionary entry for a celebration the Ordo names on a date */
	findCelebration(ordoName: string, dn: number, allowTransfer = true): Entry | null {
		const { m, d } = toParts(dn);
		const dateKey = `${pad(m)}-${pad(d)}`;
		const tokens = nameTokens(ordoName);
		let best: Entry | null = null;
		let bestScore = 0;
		for (const row of this.sanctoral) {
			if (rowDateKey(row) !== dateKey) continue;
			const score = overlap(tokens, nameTokens(row.liturgical_day));
			if (score > bestScore) [best, bestScore] = [row, score];
		}
		if (best || !allowTransfer) return best;

		// Not on its own date: a transferred feast or solemnity (only celebrations with propers move)
		let bestDistance = Infinity;
		for (const row of this.sanctoral) {
			if (!this.properIds.has(row.admin_order)) continue;
			const score = overlap(tokens, nameTokens(row.liturgical_day));
			if (score === 0) continue;
			const [mm, dd] = rowDateKey(row)!.split('-').map(Number);
			const distance = Math.abs(dayNum(toParts(dn).y, mm, dd) - dn);
			if (score > bestScore || (score === bestScore && distance < bestDistance)) {
				[best, bestScore, bestDistance] = [row, score, distance];
			}
		}
		return best;
	}
}

// ---------------------------------------------------------------------------
// Reading the Ordo's wording
// ---------------------------------------------------------------------------

const WEEKDAY_RE = '(monday|tuesday|wednesday|thursday|friday|saturday)';
const SEASON_NAMES: Record<string, string> = {
	'ordinary time': 'Ordinary Time', ordinary: 'Ordinary Time', advent: 'Advent', lent: 'Lent', easter: 'Easter'
};

function ordinalToNumber(word: string): number | null {
	const n = parseInt(word, 10);
	if (!Number.isNaN(n)) return n;
	const i = ORDINALS.indexOf(word.toLowerCase());
	return i > 0 ? i : null;
}

interface TemporalClaim {
	season?: string;
	week?: number | null;
	sunday?: boolean;
	dow?: string;
}

/**
 * If the Ordo name describes a day of the season (not a saint's day), return what it
 * claims. `{}` means "a seasonal day, nothing specific to check"; null means it names a
 * celebration.
 */
function parseTemporalName(name: string): TemporalClaim | null {
	const n = name.toLowerCase().replace(/\s+/g, ' ').trim();
	if (new RegExp(`^${WEEKDAY_RE} of (?:the )?holy week$`).test(n)) return {};
	// Tolerates the Ordo's typos ("weke", "weekin", "week Ordinary Time")
	let match = n.match(new RegExp(`^${WEEKDAY_RE} of (?:the )?([\\w-]+) we\\w*\\b(.*)$`));
	if (match) {
		const season = match[3].match(/advent|lent|easter/)?.[0] ?? 'ordinary time';
		return { dow: match[1], week: ordinalToNumber(match[2]), season: SEASON_NAMES[season], sunday: false };
	}
	match = n.match(/^(\d+) (ordinary|advent|lent|easter)(?: time)?$/);
	if (match) return { sunday: true, week: parseInt(match[1], 10), season: SEASON_NAMES[match[2]] };
	match = n.match(/^([\w-]+) sunday (?:of|in) (advent|lent|easter|ordinary time)/);
	if (match) return { sunday: true, week: ordinalToNumber(match[1]), season: SEASON_NAMES[match[2]] };
	if (new RegExp(`^${WEEKDAY_RE} (after|before) (epiphany|ash wednesday)$`).test(n)) return {};
	if (new RegExp(`^easter ${WEEKDAY_RE}$`).test(n)) return {};
	if (/^\d{1,2} (december|january)$/.test(n)) return {};
	if (/day in the octave of christmas/.test(n)) return {};
	return null;
}

/** Brisbane Ordo prints solemnities in capitals; ignores notes like "(NZ: Memorial)" */
const isAllCaps = (name: string) => {
	const main = name.replace(/\([^)]*\)/g, '');
	return /[A-Z]{3}/.test(main) && main === main.toUpperCase();
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an Ordo CSV (first column date, second column name). Accepts "1 January",
 * "01/01/2027" (day first) or "2027-01-01". Rows without a date (optional memorials,
 * headings, blank lines) are skipped.
 */
export function parseOrdoCsv(text: string, year: number): OrdoRow[] {
	const records = parse(text, { relax_column_count: true, skip_empty_lines: true, bom: true }) as string[][];
	const rows: OrdoRow[] = [];
	for (const record of records) {
		const rawDate = (record[0] ?? '').trim();
		const name = (record[1] ?? '').trim();
		if (!rawDate || !name) continue;
		const date = parseOrdoDate(rawDate, year);
		if (date) rows.push({ date, name });
	}
	return rows;
}

function parseOrdoDate(raw: string, year: number): string | null {
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
	const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
	if (dmy) {
		const [, d, m, y] = dmy.map(Number);
		return d >= 1 && d <= 31 && m >= 1 && m <= 12 ? `${y}-${pad(m)}-${pad(d)}` : null;
	}
	const named = raw.match(/^(\d{1,2})\s+([A-Za-z]+)$/);
	if (named) {
		const month = MONTHS.indexOf(named[2].toLowerCase());
		if (month >= 0) return `${year}-${pad(month + 1)}-${pad(parseInt(named[1], 10))}`;
	}
	return null;
}

export function processOrdo(ordoRows: OrdoRow[], lectionaryRows: LectionaryRow[], year: number): ProcessResult {
	const index = new LectionaryIndex(lectionaryRows);
	const entries: ProcessedEntry[] = [];
	const fileWarnings: string[] = [];
	const seen = new Set<string>();

	for (const { date, name } of ordoRows) {
		if (seen.has(date)) {
			fileWarnings.push(`${date} appears more than once; only the first line was used`);
			continue;
		}
		seen.add(date);
		entries.push(processDay(date, name, index, year));
	}

	// Every day of the year should be present
	const missing: string[] = [];
	for (let dn = dayNum(year, 1, 1); dn <= dayNum(year, 12, 31); dn++) {
		if (!seen.has(toIso(dn))) missing.push(toIso(dn));
	}
	if (missing.length) {
		fileWarnings.push(`${missing.length} date(s) of ${year} are missing from the file: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
	}
	const outsideYear = entries.filter((e) => !e.calendar_date.startsWith(`${year}-`)).length;
	if (outsideYear) fileWarnings.push(`${outsideYear} row(s) are dated outside ${year}`);

	const unmatched = entries.filter((e) => !e.lectionary_id).length;
	return {
		total: entries.length,
		exact: entries.length - unmatched,
		partial: 0,
		unmatched,
		warningCount: entries.filter((e) => e.warnings.length).length,
		errorCount: entries.filter((e) => e.error).length,
		fileWarnings,
		entries
	};
}

function processDay(date: string, name: string, index: LectionaryIndex, year: number): ProcessedEntry {
	const dn = fromIso(date);
	const cycles = yearCycles(dn);
	const temporal = temporalDay(dn);
	const warnings: string[] = [];
	let row: Entry | null = null;
	let rank = temporal.rank;
	let method = 'temporal';
	let error: string | null = null;

	const claim = parseTemporalName(name);

	if (claim) {
		// Cross-check the Ordo's wording against the calculated day
		const problems: string[] = [];
		if (claim.season && claim.season !== temporal.season) problems.push(`season ${temporal.season}`);
		if (claim.week != null && temporal.week != null && claim.week !== temporal.week) problems.push(`week ${temporal.week}`);
		if (claim.sunday !== undefined && claim.sunday !== temporal.isSunday) problems.push(DAYS[weekday(dn)]);
		if (claim.dow && claim.dow !== DAYS[weekday(dn)].toLowerCase()) problems.push(DAYS[weekday(dn)]);
		if (problems.length) {
			warnings.push(`The Ordo calls this "${name}", but by the date it is ${temporal.label} (${problems.join(', ')}). Used the readings for ${temporal.label}.`);
		}
	} else if (temporal.fixed) {
		// e.g. Ordo names a saint on Easter Monday — the season day wins. (The Ordo naming
		// the day's own solemnity, like "SOLEMNITY OF MARY" on 1 January, is fine.)
		const celebration = index.findCelebration(name, dn, false);
		const namesOwnSolemnity = temporal.rank === 'Solemnity' && isAllCaps(name);
		if (celebration && !namesOwnSolemnity && (isAllCaps(name) || index.properIds.has(celebration.admin_order))) {
			warnings.push(`The Ordo lists "${name}" on ${temporal.label}. Used the readings for ${temporal.label}; check whether it should be transferred.`);
		}
	} else if (/mother of the church/i.test(name)) {
		row = index.lookup({ kind: 'name', name: 'mary, mother of the church' }, cycles);
		rank = 'Memorial';
		method = 'proper';
	} else {
		const celebration = index.findCelebration(name, dn);
		const caps = isAllCaps(name);
		if (celebration && (caps || index.properIds.has(celebration.admin_order))) {
			row = index.resolveVariant(celebration, cycles.sundayCycle);
			rank = caps ? 'Solemnity' : index.properMemorialIds.has(celebration.admin_order) ? 'Memorial' : 'Feast';
			method = 'proper';
			if (temporal.isSunday && !caps && !/presentation|transfiguration|exaltation|lateran/i.test(name)) {
				warnings.push(`"${name}" replaces the ${temporal.label}; only solemnities and feasts of the Lord normally do.`);
			}
		} else if (caps) {
			error = `"${name}" looks like a solemnity, but no matching entry was found in the lectionary.`;
		} else {
			rank = 'Memorial';
			method = 'weekday_for_memorial';
			if (!celebration) {
				warnings.push(`"${name}" wasn't found in the lectionary's saints, so it was treated as a memorial with the weekday readings.`);
			}
		}
	}

	if (!row && !error) {
		row = index.lookup(temporal.lookup, cycles);
		if (!row) error = `No lectionary entry for ${temporal.label} (${cycles.sundayCycle}/${cycles.weekdayCycle}).`;
	}

	return {
		calendar_date: date,
		liturgical_name: name,
		liturgical_year: year,
		liturgical_season: temporal.season,
		liturgical_week: temporal.week,
		liturgical_rank: rank,
		year_cycle: cycles.sundayCycle,
		weekday_cycle: cycles.weekdayCycle,
		lectionary_id: row?.admin_order ?? null,
		lectionary_name: row?.liturgical_day ?? null,
		match_type: row ? 'exact' : 'none',
		match_method: row ? method : null,
		first_reading: row?.first_reading ?? null,
		psalm: row?.psalm ?? null,
		second_reading: row?.second_reading ?? null,
		gospel_reading: row?.gospel_reading ?? null,
		warnings,
		error
	};
}
