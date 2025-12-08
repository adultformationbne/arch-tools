#!/usr/bin/env node
/**
 * Find database readings that are wrong compared to the Ordo
 * Rule: Ordo is source of truth, first reading listed wins
 */
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const xmlOutput = JSON.parse(readFileSync('data/generated/ordo-2026.json'));
const csvContent = readFileSync('data/generated/ordo_lectionary_mapping.csv', 'utf-8');
const lectMapping = parse(csvContent, { columns: true, skip_empty_lines: true });

const lectMap = new Map();
for (const row of lectMapping) {
  lectMap.set(row.calendar_date, row);
}

// Normalize book names for comparison
const bookNorm = {
  'mt': 'matthew', 'mk': 'mark', 'lk': 'luke', 'jn': 'john',
  'matthew': 'matthew', 'mark': 'mark', 'luke': 'luke', 'john': 'john'
};

function parseRef(ref) {
  if (!ref) return null;
  const clean = ref.toLowerCase().replace(/\s+/g, '');
  const m = clean.match(/^(mt|mk|lk|jn|matthew|mark|luke|john)(\d+):(\d+)/);
  if (!m) return null;
  return { book: bookNorm[m[1]], chapter: m[2], verse: m[3] };
}

console.log('=== DATABASE READINGS TO FIX ===');
console.log('Rule: Ordo is source of truth, first reading listed wins\n');

const errors = [];

for (const xml of xmlOutput) {
  const db = lectMap.get(xml.date);
  if (!db || !xml.readings?.gospel || !db.gospel_reading) continue;

  const xmlRef = parseRef(xml.readings.gospel);
  const dbRef = parseRef(db.gospel_reading);

  if (!xmlRef || !dbRef) continue;

  // Check if they match (same book and chapter)
  if (xmlRef.book === dbRef.book && xmlRef.chapter === dbRef.chapter) continue;

  // They don't match - DB needs to be updated to match Ordo
  const name = xml.liturgical_day || '';

  errors.push({
    date: xml.date,
    name: name.substring(0, 45),
    dayOfWeek: xml.day_of_week,
    ordoReading: xml.readings.gospel,
    dbReading: db.gospel_reading,
  });
}

// Sort by date
errors.sort((a, b) => a.date.localeCompare(b.date));

console.log('| Date | Day | Liturgical Day | ORDO (correct) | DB (wrong) |');
console.log('|------|-----|----------------|----------------|------------|');

for (const e of errors) {
  console.log(`| ${e.date} | ${e.dayOfWeek.substring(0,3)} | ${e.name} | ${e.ordoReading} | ${e.dbReading} |`);
}

console.log('\n=== TOTAL: ' + errors.length + ' readings to fix ===\n');

// Output as JSON for easy processing
const fixList = errors.map(e => ({
  date: e.date,
  correct_gospel: e.ordoReading,
  wrong_gospel: e.dbReading
}));

console.log('JSON for programmatic fixing:');
console.log(JSON.stringify(fixList, null, 2));
