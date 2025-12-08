#!/usr/bin/env node
import { readFileSync } from 'fs';

const data = JSON.parse(readFileSync('data/generated/ordo-2026.json'));

// Find entries missing gospel
const missing = data.filter(e => e.readings?.gospel === null);

console.log('=== MISSING READINGS (' + missing.length + ' total) ===\n');

// Prioritize important dates
const important = missing.filter(e => {
  const name = (e.liturgical_day || '').toUpperCase();
  return name.includes('SUNDAY') ||
         name.includes('ASH') ||
         name.includes('HOLY') ||
         name.includes('TRIDUUM') ||
         name.includes('THURSDAY') && name.includes('HOLY') ||
         name.includes('GOOD FRIDAY') ||
         name.includes('VIGIL');
});

console.log('IMPORTANT MISSING (' + important.length + '):');
for (const e of important) {
  console.log(e.date, '|', e.liturgical_day);
}

console.log('\n--- Other missing (sample) ---');
const others = missing.filter(e => {
  const found = important.find(i => i.date === e.date);
  return !found;
}).slice(0, 30);

for (const e of others) {
  console.log(e.date, '|', e.liturgical_day?.substring(0, 50));
}
