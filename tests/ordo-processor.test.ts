import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import {
	parseOrdoCsv,
	processOrdo,
	easterSunday,
	firstSundayOfAdvent,
	cyclesForDate,
	type LectionaryRow,
	type ProcessResult
} from '$lib/server/ordo-processor';

const iso = (dn: number) => new Date(dn * 86400000).toISOString().slice(0, 10);
const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const fromTable = (year: number, md: string) => {
	const [m, d] = md.split(/[^A-Za-z0-9]+/);
	return `${year}-${MON[m]}-${d.padStart(2, '0')}`;
};

describe('calculated calendar agrees with the liturgical year table', () => {
	const table = parse(readFileSync('src/lib/data/liturgical-year.csv', 'utf-8'), { columns: true }) as Record<string, string>[];

	it.each(table.map((r) => [r.year, r]))('%s', (_, r) => {
		const year = parseInt(r.year, 10);
		const easter = easterSunday(year);
		expect(iso(easter)).toBe(fromTable(year, r.easter_sunday));
		expect(iso(easter - 46)).toBe(fromTable(year, r.ash_wednesday));
		expect(iso(easter + 49)).toBe(fromTable(year, r.pentecost_sunday));
		expect(iso(firstSundayOfAdvent(year))).toBe(fromTable(year, r.first_sunday_of_advent));
		expect(cyclesForDate(`${year}-06-01`)).toEqual({ sundayCycle: r.sunday_cycle, weekdayCycle: r.weekday_cycle });
	});
});

describe('Ordo processing', () => {
	let lectionary: LectionaryRow[];
	const results: Record<number, ProcessResult> = {};
	const reading = (year: number, date: string) => results[year].entries.find((e) => e.calendar_date === date)!;

	beforeAll(async () => {
		const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
		const { data, error } = await supabase.from('lectionary').select('*');
		if (error) throw error;
		lectionary = data;
		const files: Record<number, string> = {
			2025: 'data/source/2025.csv',
			2026: 'data/source/2026.csv',
			2027: 'data/source/ordo_template 2027.csv'
		};
		for (const [year, path] of Object.entries(files)) {
			results[+year] = processOrdo(parseOrdoCsv(readFileSync(path, 'utf-8'), +year), lectionary, +year);
		}
	});

	it('matches every day of 2025–2027 with no file problems', () => {
		for (const result of Object.values(results)) {
			expect(result.total).toBe(365);
			expect(result.unmatched).toBe(0);
			expect(result.fileWarnings).toEqual([]);
		}
	});

	it('only flags the 2027 Ordo typo ("sixteenth" in week 15)', () => {
		const flagged = Object.values(results).flatMap((r) => r.entries.filter((e) => e.warnings.length).map((e) => e.calendar_date));
		expect(flagged).toEqual(['2027-07-13']);
		expect(reading(2027, '2027-07-13').lectionary_name).toBe('Tuesday of the fifteenth week');
	});

	it('uses the weekday cycle even when the Ordo omits "in Ordinary Time"', () => {
		// The bug that showed Romans instead of Ephesians on 26 Oct 2026
		expect(reading(2026, '2026-10-26').first_reading).toBe('Ephesians 4:32 – 5:8');
		expect(reading(2027, '2027-07-12').lectionary_id).toBe(lectionary.find((l) => l.year === '1' && l.week === '15' && l.day === 'Monday')!.admin_order);
	});

	it('numbers Sundays after Pentecost the same way as the Ordo', () => {
		expect(reading(2026, '2026-06-14').lectionary_name).toBe('ELEVENTH SUNDAY');
		expect(reading(2026, '2026-10-25').lectionary_name).toBe('THIRTIETH SUNDAY');
		expect(reading(2027, '2027-06-13').lectionary_name).toBe('ELEVENTH SUNDAY');
	});

	it('switches the Sunday cycle at Advent', () => {
		expect(reading(2026, '2026-11-29').lectionary_name).toBe('FIRST SUNDAY OF ADVENT, Year B');
		expect(reading(2026, '2026-12-27').lectionary_name).toBe('HOLY FAMILY, Year B');
		expect(reading(2027, '2027-01-10').lectionary_name).toBe('BAPTISM OF THE LORD, Year B');
		expect(reading(2027, '2027-11-28').lectionary_name).toBe('FIRST SUNDAY OF ADVENT, Year C');
	});

	it('handles Christmas, late Advent and early January', () => {
		expect(reading(2026, '2026-12-25').lectionary_name).toBe('Christmas Day');
		expect(reading(2026, '2026-12-21').lectionary_name).toBe('21st December');
		expect(reading(2026, '2026-12-14').lectionary_name).toBe('Monday of the third week of Advent');
		expect(reading(2025, '2025-12-27').lectionary_name).toMatch(/^27 December — St John/);
		expect(reading(2026, '2026-01-03').lectionary_name).toBe('3rd January');
	});

	it('uses proper readings for solemnities and feasts, weekday readings for memorials', () => {
		expect(reading(2026, '2026-05-24').lectionary_name).toBe('PENTECOST SUNDAY, Year A');
		expect(reading(2026, '2026-05-25').lectionary_name).toBe('24 May – Mary Help of Christians, Year A'); // transferred
		expect(reading(2027, '2027-05-24').lectionary_name).toBe('24 May – Mary Help of Christians, Year B'); // cycle only in the name
		expect(reading(2026, '2026-09-29').lectionary_name).toMatch(/Michael, Gabriel and Raphael/);
		expect(reading(2026, '2026-08-10').lectionary_name).toMatch(/St Lawrence/);
		expect(reading(2026, '2026-08-06').lectionary_name).toBe('6 August – Transfiguration (Year A)');
		expect(reading(2026, '2026-01-28').match_method).toBe('weekday_for_memorial'); // St Thomas Aquinas
	});

	it('gives memorials the readings the Ordo prints (checked against the 2026 Ordo)', () => {
		const first = (date: string) => reading(2026, date).first_reading;
		const gospel = (date: string) => reading(2026, date).gospel_reading;
		// Memorials the Ordo prints with weekday readings
		expect(first('2026-01-17')).toMatch(/^1 Samuel 9:1-4/); // St Anthony
		expect(first('2026-08-03')).toMatch(/^Jeremiah 28:1-17/); // St Dominic
		expect(first('2026-08-04')).toMatch(/^Jeremiah 30:1-2/); // St John Vianney
		expect(first('2026-08-22')).toMatch(/^Ezekiel 43:1-7/); // Queenship of Mary
		expect(first('2026-10-01')).toMatch(/^Job 19:21-27/); // St Thérèse
		expect(gospel('2026-11-21')).toMatch(/^Luke 20:27-40/); // Presentation of Mary
		// Memorials the Ordo prints with their own readings
		expect(first('2026-06-11')).toMatch(/^Acts 11:21-26/); // St Barnabas
		expect(first('2026-08-29')).toMatch(/^Jeremiah 1:17-19/); // Passion of John the Baptist
		expect(first('2026-09-15')).toMatch(/^Hebrews 5:7-9/); // Our Lady of Sorrows
		expect(first('2026-10-02')).toMatch(/^Exodus 23:20-23/); // Guardian Angels
	});

	it('flags an Ordo whose wording disagrees with the date', () => {
		const result = processOrdo([{ date: '2027-07-14', name: 'Wednesday of the twentieth week in Ordinary Time' }], lectionary, 2027);
		expect(result.entries[0].warnings[0]).toMatch(/week 15/);
		expect(result.entries[0].lectionary_name).toBe('Wednesday of the fifteenth week');
	});
});
