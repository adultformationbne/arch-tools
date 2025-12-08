#!/usr/bin/env node
/**
 * Compare XML parser output with database lectionary mapping
 * Usage: node scripts/compare-ordo-outputs.js [--wrong]
 */

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const showWrong = process.argv.includes('--wrong');

// Load my XML parser output
const xmlOutput = JSON.parse(readFileSync('data/generated/ordo-2026.json'));

// Load process-ordo.js output
const csvContent = readFileSync('data/generated/ordo_lectionary_mapping.csv', 'utf-8');
const lectMapping = parse(csvContent, { columns: true, skip_empty_lines: true });

// Create lookup
const lectMap = new Map();
for (const row of lectMapping) {
  lectMap.set(row.calendar_date, row);
}

// Book name normalization
const bookMap = {
  'mt': 'matthew', 'mk': 'mark', 'lk': 'luke', 'jn': 'john',
  'matthew': 'matthew', 'mark': 'mark', 'luke': 'luke', 'john': 'john'
};

function normalizeGospelRef(ref) {
  if (!ref) return null;
  const clean = ref.replace(/\s+/g, '').toLowerCase();
  const match = clean.match(/^(mt|mk|lk|jn|matthew|mark|luke|john)(\d+):(\d+)/);
  if (!match) return null;
  return {
    book: bookMap[match[1]] || match[1],
    chapter: match[2],
    verse: match[3]
  };
}

// Compare
const discrepancies = [];
let matched = 0;
let bothHaveReadings = 0;
let xmlOnly = 0;
let lectOnly = 0;

for (const xmlEntry of xmlOutput) {
  const lect = lectMap.get(xmlEntry.date);
  if (!lect) continue;

  const xmlRef = normalizeGospelRef(xmlEntry.readings?.gospel);
  const lectRef = normalizeGospelRef(lect.gospel_reading);

  // Count where both have readings
  if (xmlRef && lectRef) {
    bothHaveReadings++;

    if (xmlRef.book === lectRef.book && xmlRef.chapter === lectRef.chapter) {
      matched++;
    } else {
      discrepancies.push({
        date: xmlEntry.date,
        name: xmlEntry.liturgical_day?.substring(0, 40),
        xmlGospel: xmlEntry.readings?.gospel,
        lectGospel: lect.gospel_reading,
        issue: xmlRef.book !== lectRef.book ? 'book_mismatch' : 'chapter_mismatch'
      });
    }
  } else if (xmlRef && !lectRef) {
    xmlOnly++;
  } else if (!xmlRef && lectRef) {
    lectOnly++;
  }
}

console.log('=== COMPARISON STATS ===');
console.log('Both have readings:', bothHaveReadings);
console.log('Gospel matches:', matched, '(' + (matched/bothHaveReadings*100).toFixed(1) + '%)');
console.log('Discrepancies:', discrepancies.length);
console.log('XML has reading, DB missing:', xmlOnly);
console.log('DB has reading, XML missing:', lectOnly);

console.log('\n=== DISCREPANCIES ===');
for (const d of discrepancies.slice(0, 30)) {
  console.log(d.date, '|', d.name);
  console.log('  XML:', d.xmlGospel);
  console.log('  DB: ', d.lectGospel);
  console.log('  Issue:', d.issue);
}

if (discrepancies.length > 30) {
  console.log(`\n... and ${discrepancies.length - 30} more discrepancies`);
}

// Show sample matches to verify
if (!showWrong) {
  console.log('\n=== SAMPLE MATCHES (verification) ===');
  let sampleCount = 0;
  for (const xmlEntry of xmlOutput) {
    if (sampleCount >= 10) break;
    const lect = lectMap.get(xmlEntry.date);
    if (!lect) continue;

    const xmlRef = normalizeGospelRef(xmlEntry.readings?.gospel);
    const lectRef = normalizeGospelRef(lect.gospel_reading);

    if (xmlRef && lectRef && xmlRef.book === lectRef.book && xmlRef.chapter === lectRef.chapter) {
      console.log(xmlEntry.date, '|', xmlEntry.liturgical_day?.substring(0, 30));
      console.log('  XML:', xmlEntry.readings?.gospel);
      console.log('  DB: ', lect.gospel_reading);
      sampleCount++;
    }
  }
}

// --wrong flag: Show dates where DB is definitively wrong
if (showWrong) {
  console.log('\n=== DATES WHERE DATABASE IS WRONG vs ACTUAL ORDO ===\n');

  // Known correct Year A readings
  const checks = [
    { date: '2025-12-01', expected: 'mt8', desc: 'Monday Advent Week 1 - Mt 8:5-11' },
    { date: '2026-03-08', expected: 'jn4', desc: '3rd Sunday Lent Year A - Woman at Well (Jn 4)' },
    { date: '2026-03-15', expected: 'jn9', desc: '4th Sunday Lent Year A - Man Born Blind (Jn 9)' },
    { date: '2026-03-22', expected: 'jn11', desc: '5th Sunday Lent Year A - Raising Lazarus (Jn 11)' },
    { date: '2026-04-19', expected: 'lk24', desc: '3rd Sunday Easter Year A - Road to Emmaus (Lk 24)' },
    { date: '2026-04-26', expected: 'jn10', desc: '4th Sunday Easter Year A - Good Shepherd (Jn 10)' },
    { date: '2026-05-03', expected: 'jn14', desc: '5th Sunday Easter Year A - (Jn 14)' },
    { date: '2026-05-10', expected: 'jn14', desc: '6th Sunday Easter Year A - (Jn 14)' },
  ];

  for (const check of checks) {
    const xml = xmlOutput.find(x => x.date === check.date);
    const db = lectMap.get(check.date);

    const xmlGospel = xml?.readings?.gospel || 'MISSING';
    const dbGospel = db?.gospel_reading || 'MISSING';

    const xmlNorm = xmlGospel.toLowerCase().replace(/\s+/g, '');
    const dbNorm = dbGospel.toLowerCase().replace(/\s+/g, '');

    const xmlCorrect = xmlNorm.includes(check.expected);
    const dbCorrect = dbNorm.includes(check.expected);

    if (xmlCorrect && !dbCorrect) {
      console.log('DATE:', check.date);
      console.log('  ' + check.desc);
      console.log('  ORDO (correct):  ', xmlGospel);
      console.log('  DATABASE (wrong):', dbGospel);
      console.log('');
    }
  }

  console.log('=== MORE WRONG DB ENTRIES (different Gospel book) ===\n');

  const bookMap = { Mt: 'Matthew', Mk: 'Mark', Lk: 'Luke', Jn: 'John' };
  let count = 0;

  for (const xml of xmlOutput) {
    if (count >= 20) break;
    const db = lectMap.get(xml.date);
    if (!db || !xml.readings?.gospel || !db.gospel_reading) continue;

    const xmlBook = xml.readings.gospel.match(/^(Mt|Mk|Lk|Jn)/)?.[1];
    const dbBook = db.gospel_reading.match(/^(Matthew|Mark|Luke|John)/)?.[1];

    if (xmlBook && dbBook && bookMap[xmlBook] !== dbBook) {
      // Skip saints days (legitimate alternatives)
      const name = xml.liturgical_day || '';
      if (name.includes('St ') || name.includes('Sts ') || name.includes('Memorial')) continue;

      console.log(xml.date, '|', name.substring(0, 45));
      console.log('  ORDO:', xml.readings.gospel);
      console.log('  DB:  ', db.gospel_reading);
      console.log('');
      count++;
    }
  }
}
