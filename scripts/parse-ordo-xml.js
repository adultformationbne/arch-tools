#!/usr/bin/env node
/**
 * Parse Ordo 2026 XML - Improved extraction
 * Fixes: alleluia citations, 1 Jn split, boundary issues
 */

import { readFileSync, writeFileSync } from 'fs';

const xml = readFileSync('ORDO 2026.xml', 'utf-8');

// Extract blocks
let text = xml
  .replace(/<\?[^?]+\?>/g, '')
  .replace(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/g, '')
  .replace(/<bookmark-tree[\s\S]*?<\/bookmark-tree>/g, '')
  .replace(/<\/?(P|TD|TH|TR|Table|Part|Sect|H[1-6]|L|LI|Lbl|LBody)[^>]*>/g, '|||')
  .replace(/<[^>]+>/g, '');

const parts = text.split('|||').map(p => p.trim()).filter(Boolean);

// Patterns
const dayPattern = /^(\d{1,2})\s+(SUNDAY|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/i;
const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];

// Reading patterns - look for readings with titles (format: "Book ref: Title...")
// This excludes alleluia citations which are in parentheses like "(Lk 3:4, 6)"

// Psalm - simple pattern
const psalmPattern = /\bPs\s+(\d+)[:.\s]*([\d,\-–\s]*)/;

// Gospel pattern: "Mt/Mk/Lk/Jn ref:" followed by title text (capital letter)
// Allows cross-chapter refs like "Mt 9:35 – 10:1, 6-8:"
// Use negative lookbehind to avoid matching "1 Jn", "2 Jn", "3 Jn" as Gospel
const gospelWithTitlePattern = /(?<![123]\s)\b(Mt|Mk|Lk|Jn)\s+(\d+):([0-9,:–\-\s]+?):\s+[A-Z]/;

// OT books followed by title text
const otBooks = 'Gen|Ex|Lev|Num|Deut|Josh|Judges|Ruth|1 Sam|2 Sam|1 Kings|2 Kings|1 Chr|2 Chr|Ezra|Neh|Tob|Jud|Esth|1 Macc|2 Macc|Job|Prov|Eccles|Song|Wis|Sirach|Is|Jer|Lam|Bar|Ezek|Dan|Hos|Joel|Amos|Obad|Jon|Mic|Nah|Hab|Zeph|Hag|Zech|Mal|Acts';
const otWithTitlePattern = new RegExp(`\\b(${otBooks})\\s+(\\d+):([0-9,:–\\-\\s]+?):\\s+[A-Z]`);

// NT letters followed by title text
const ntLetters = 'Rom|1 Cor|2 Cor|Gal|Eph|Phil|Col|1 Thess|2 Thess|1 Tim|2 Tim|Titus|Philemon|Heb|James|1 Pet|2 Pet|1 Jn|2 Jn|3 Jn|Jude|Rev';
const ntWithTitlePattern = new RegExp(`\\b(${ntLetters})\\s+(\\d+):([0-9,:–\\-\\s]+?):\\s+[A-Z]`);

function normalizeRef(book, chapter, verses) {
  // Clean up verses: normalize whitespace, convert en-dash to hyphen
  let cleanVerse = verses.trim()
    .replace(/\s*–\s*/g, '-')   // en-dash with optional spaces → hyphen
    .replace(/\s*-\s*/g, '-')   // spaces around hyphen
    .replace(/\s*,\s*/g, ',')   // spaces around comma
    .replace(/\s*:\s*/g, ':');  // spaces around colon (for cross-chapter)
  return `${book} ${chapter}:${cleanVerse}`;
}

function extractReadings(textBlock) {
  const readings = { first_reading: null, psalm: null, second_reading: null, gospel: null };

  // Find Gospel - pattern "Mt/Mk/Lk/Jn ref:" with colon indicating title follows
  const gospelMatch = textBlock.match(gospelWithTitlePattern);
  if (gospelMatch) {
    readings.gospel = normalizeRef(gospelMatch[1], gospelMatch[2], gospelMatch[3]);
  }

  // Find Psalm
  const psalmMatch = textBlock.match(psalmPattern);
  if (psalmMatch) {
    const versesPart = psalmMatch[2] ? ':' + psalmMatch[2].trim().replace(/\s+/g, '') : '';
    readings.psalm = `Ps ${psalmMatch[1]}${versesPart}`.replace(/:$/, '');
  }

  // Find first reading (OT/Acts) - pattern "Book ref:" with colon
  const otMatch = textBlock.match(otWithTitlePattern);
  if (otMatch) {
    readings.first_reading = normalizeRef(otMatch[1], otMatch[2], otMatch[3]);
  }

  // Find second reading (NT letter) - pattern "Book ref:" with colon
  const ntMatch = textBlock.match(ntWithTitlePattern);
  if (ntMatch) {
    readings.second_reading = normalizeRef(ntMatch[1], ntMatch[2], ntMatch[3]);
  }

  return readings;
}

// Build index of all day entries
const dayIndex = new Map();

let currentMonth = 10;
let currentYear = 2025;
let lastDay = 0;

// First pass: explicit day entries
for (let i = 0; i < parts.length; i++) {
  const part = parts[i];
  const dayMatch = part.match(dayPattern);

  if (dayMatch) {
    const dayNum = parseInt(dayMatch[1]);

    const monthMatch = part.match(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/i);
    if (monthMatch) {
      currentMonth = monthNames.indexOf(monthMatch[1].toLowerCase());
      if (currentMonth === 0 && lastDay > 20) currentYear++;
    } else if (dayNum < lastDay && lastDay > 20) {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    }
    lastDay = dayNum;

    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    dayIndex.set(dateStr, { line: part, startIdx: i });
  }
}

// Set end indices
const dates = [...dayIndex.keys()].sort();
for (let i = 0; i < dates.length; i++) {
  const entry = dayIndex.get(dates[i]);
  const nextEntry = dayIndex.get(dates[i + 1]);
  entry.endIdx = nextEntry ? nextEntry.startIdx : parts.length;
}

console.log(`Found ${dayIndex.size} day entries`);

// Key liturgical dates
const liturgicalDates = {
  '2025-11-30': 'First Sunday of Advent',
  '2025-12-03': 'St Francis Xavier',
  '2025-12-07': 'Second Sunday of Advent',
  '2025-12-08': 'Immaculate Conception',
  '2025-12-14': 'Third Sunday of Advent',
  '2025-12-21': 'Fourth Sunday of Advent',
  '2025-12-25': 'The Nativity of the Lord',
  '2025-12-28': 'Holy Family',
  '2026-01-01': 'Mary, Mother of God',
  '2026-01-04': 'Epiphany of the Lord',
  '2026-01-11': 'Baptism of the Lord',
  '2026-02-18': 'Ash Wednesday',
  '2026-02-22': 'First Sunday of Lent',
  '2026-03-25': 'Annunciation',
  '2026-03-29': 'Palm Sunday',
  '2026-04-02': 'Holy Thursday',
  '2026-04-03': 'Good Friday',
  '2026-04-04': 'Holy Saturday',
  '2026-04-05': 'Easter Sunday',
  '2026-05-14': 'Ascension',
  '2026-05-24': 'Pentecost',
  '2026-08-15': 'Assumption',
  '2026-11-01': 'All Saints',
  '2026-11-22': 'Christ the King',
  '2026-11-29': 'First Sunday of Advent',
  '2026-12-25': 'The Nativity of the Lord'
};

// Season boundaries
const adventStart2025 = new Date('2025-11-30');
const easter2026 = new Date('2026-04-05');
const ashWednesday2026 = new Date('2026-02-18');
const pentecost2026 = new Date('2026-05-24');
const adventStart2026 = new Date('2026-11-29');

function ordinal(n) {
  const ordinals = ['', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
  return ordinals[n] || `${n}th`;
}

function getLiturgicalInfo(dateStr) {
  const date = new Date(dateStr);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[date.getDay()];

  if (liturgicalDates[dateStr]) return { name: liturgicalDates[dateStr] };

  if (date >= adventStart2026) {
    const weeks = Math.floor((date - adventStart2026) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return { name: date.getDay() === 0 ? `${ordinal(weeks)} Sunday of Advent` : `${dayOfWeek} of ${ordinal(weeks)} week of Advent` };
  }

  if (date >= pentecost2026 && date < adventStart2026) {
    const weeks = Math.floor((date - pentecost2026) / (7 * 24 * 60 * 60 * 1000)) + 9;
    return { name: date.getDay() === 0 ? `${ordinal(weeks)} Sunday in Ordinary Time` : `Weekday, Ordinary Time ${weeks}` };
  }

  if (date >= easter2026 && date < pentecost2026) {
    const weeks = Math.floor((date - easter2026) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return { name: date.getDay() === 0 ? `${ordinal(weeks)} Sunday of Easter` : `${dayOfWeek} of ${ordinal(weeks)} week of Easter` };
  }

  if (date >= ashWednesday2026 && date < easter2026) {
    const weeks = Math.floor((date - ashWednesday2026) / (7 * 24 * 60 * 60 * 1000)) + 1;
    if (date >= new Date('2026-03-29')) return { name: `Holy Week - ${dayOfWeek}` };
    return { name: date.getDay() === 0 ? `${ordinal(weeks)} Sunday of Lent` : `${dayOfWeek} of ${ordinal(weeks)} week of Lent` };
  }

  if (date >= new Date('2026-01-12') && date < ashWednesday2026) {
    const weeks = Math.floor((date - new Date('2026-01-11')) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return { name: date.getDay() === 0 ? `${ordinal(weeks)} Sunday in Ordinary Time` : `Weekday, Ordinary Time ${weeks}` };
  }

  if (date >= adventStart2025 && date < new Date('2025-12-25')) {
    const weeks = Math.floor((date - adventStart2025) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return { name: date.getDay() === 0 ? `${ordinal(weeks)} Sunday of Advent` : `${dayOfWeek} of ${ordinal(weeks)} week of Advent` };
  }

  if (date >= new Date('2025-12-25') && date <= new Date('2026-01-11')) {
    return { name: 'Christmas Time' };
  }

  return { name: dayOfWeek };
}

// Generate all dates
const allDates = [];
const start = new Date('2025-11-30');
const end = new Date('2026-12-31');
for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  allDates.push(d.toISOString().split('T')[0]);
}

// Build entries
const entries = [];
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

for (const dateStr of allDates) {
  const indexed = dayIndex.get(dateStr);
  const date = new Date(dateStr);
  const dayOfWeek = dayNames[date.getDay()];

  let liturgicalDay = '';
  let readings = { first_reading: null, psalm: null, second_reading: null, gospel: null };

  if (indexed) {
    liturgicalDay = indexed.line
      .replace(dayPattern, '')
      .replace(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/gi, '')
      .replace(/\b(violet|green|white|red|rose|black)\b/gi, '')
      .replace(/\b(Solemnity|Feast|Memorial|Optional)\b/gi, '')
      .replace(/\s+with\s+octave\b/gi, '')
      .replace(/^Mass of \d{1,2} \w+/i, '')
      .replace(/Preface.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    const textBlock = parts.slice(indexed.startIdx, indexed.endIdx).join(' ');
    readings = extractReadings(textBlock);
  }

  if (!liturgicalDay) {
    liturgicalDay = getLiturgicalInfo(dateStr).name;
  }

  entries.push({
    date: dateStr,
    day_of_week: dayOfWeek,
    liturgical_day: liturgicalDay,
    readings
  });
}

// Stats
const withReadings = entries.filter(e => e.readings.gospel || e.readings.first_reading).length;
const missingReadings = entries.filter(e => !e.readings.gospel && !e.readings.first_reading);

console.log(`\nStats:`);
console.log(`  Total entries: ${entries.length}`);
console.log(`  With readings: ${withReadings}`);
console.log(`  Missing readings: ${missingReadings.length}`);

// Write outputs
writeFileSync('data/generated/ordo-2026.json', JSON.stringify(entries, null, 2));

const csvLines = ['date,day_of_week,liturgical_day,first_reading,psalm,second_reading,gospel'];
for (const e of entries) {
  csvLines.push([
    e.date,
    e.day_of_week,
    `"${(e.liturgical_day || '').replace(/"/g, '""')}"`,
    e.readings.first_reading || '',
    e.readings.psalm || '',
    e.readings.second_reading || '',
    e.readings.gospel || ''
  ].join(','));
}
writeFileSync('data/generated/ordo-2026.csv', csvLines.join('\n'));

// Validation
console.log('\n=== VALIDATION ===');
console.log('\n1. MAJOR FEASTS:');
['2025-12-25', '2026-01-04', '2026-02-18', '2026-04-05', '2026-05-24'].forEach(d => {
  const e = entries.find(x => x.date === d);
  console.log(`  ${d} | ${e?.liturgical_day}`);
  console.log(`    1st: ${e?.readings?.first_reading || '-'} | Gospel: ${e?.readings?.gospel || '-'}`);
});

console.log('\n2. SAMPLE WEEKDAYS:');
entries.filter(e => e.date >= '2025-12-01' && e.date <= '2025-12-10').forEach(e => {
  console.log(`  ${e.date} | ${e.liturgical_day}`);
  console.log(`    1st: ${e.readings.first_reading || '-'} | Ps: ${e.readings.psalm || '-'} | Gospel: ${e.readings.gospel || '-'}`);
});

console.log('\n✅ Written to data/generated/ordo-2026.json and .csv');
