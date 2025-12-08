#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const data = JSON.parse(readFileSync('data/generated/ordo-2026.json'));

// Check what's still missing
const missing = data.filter(e => e.readings?.gospel === null);

console.log('=== STILL MISSING (' + missing.length + ') ===\n');

// Categorize
const sundays = missing.filter(e => e.day_of_week === 'Sunday');
const weekdays = missing.filter(e => e.day_of_week !== 'Sunday');

console.log('Sundays missing:', sundays.length);
for (const e of sundays) {
  console.log('  ', e.date, '-', e.liturgical_day);
}

console.log('\nWeekdays missing:', weekdays.length);
console.log('Sample weekdays:');
for (const e of weekdays.slice(0, 15)) {
  console.log('  ', e.date, '-', e.liturgical_day?.substring(0, 45));
}

// Update CSV
const csvLines = ['date,day_of_week,liturgical_day,first_reading,psalm,second_reading,gospel'];
for (const e of data) {
  csvLines.push([
    e.date,
    e.day_of_week,
    '"' + (e.liturgical_day || '').replace(/"/g, '""') + '"',
    e.readings?.first_reading || '',
    e.readings?.psalm || '',
    e.readings?.second_reading || '',
    e.readings?.gospel || ''
  ].join(','));
}
writeFileSync('data/generated/ordo-2026.csv', csvLines.join('\n'));
console.log('\n✅ CSV updated: data/generated/ordo-2026.csv');

// Stats
const withGospel = data.filter(e => e.readings?.gospel).length;
console.log('\nFinal stats:');
console.log('  Total entries:', data.length);
console.log('  With gospel:', withGospel, '(' + (withGospel/data.length*100).toFixed(1) + '%)');
console.log('  Missing gospel:', missing.length);
