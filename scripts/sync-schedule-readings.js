#!/usr/bin/env node
/**
 * Sync DGR Schedule Readings
 *
 * This script compares dgr_schedule.readings_data against the canonical
 * lectionary mappings and:
 * 1. Auto-updates PENDING rows with correct readings
 * 2. Flags SUBMITTED/APPROVED/PUBLISHED rows that have wrong readings
 *
 * Usage:
 *   node scripts/sync-schedule-readings.js [--dry-run] [--fix-all] [--all-dates]
 *
 * Options:
 *   --dry-run     Show what would be changed without making changes
 *   --fix-all     Also fix submitted/approved/published rows (use with caution)
 *   --all-dates   Include past dates (default: future dates only)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FIX_ALL = args.includes('--fix-all');
const ALL_DATES = args.includes('--all-dates');

async function getCanonicalReadings(date) {
  // Get readings from ordo_calendar -> ordo_lectionary_mapping -> lectionary
  const { data, error } = await supabase.rpc('get_readings_for_date', { target_date: date });

  if (error) {
    // Fallback to manual join if RPC doesn't exist
    const { data: mapping } = await supabase
      .from('ordo_lectionary_mapping')
      .select('lectionary_id')
      .eq('calendar_date', date)
      .single();

    if (!mapping) return null;

    const { data: lectionary } = await supabase
      .from('lectionary')
      .select('*')
      .eq('admin_order', mapping.lectionary_id)
      .single();

    return lectionary;
  }

  return data;
}

async function main() {
  console.log('='.repeat(60));
  console.log('DGR Schedule Readings Sync');
  console.log('='.repeat(60));
  if (DRY_RUN) console.log('🔍 DRY RUN MODE - No changes will be made');
  if (FIX_ALL) console.log('⚠️  FIX ALL MODE - Will update non-pending rows too');

  const today = new Date().toISOString().split('T')[0];
  if (!ALL_DATES) {
    console.log(`📅 Checking dates from ${today} onwards (use --all-dates for all)`);
  } else {
    console.log('📅 Checking ALL dates (including past)');
  }
  console.log('');

  // Get schedule rows (future only by default)
  let query = supabase
    .from('dgr_schedule')
    .select('id, date, status, gospel_reference, readings_data, liturgical_date')
    .order('date', { ascending: true });

  if (!ALL_DATES) {
    query = query.gte('date', today);
  }

  const { data: scheduleRows, error } = await query;

  if (error) {
    console.error('Error fetching schedule:', error);
    process.exit(1);
  }

  console.log(`Found ${scheduleRows.length} schedule rows to check\n`);

  const results = {
    correct: [],
    pendingFixed: [],
    flagged: [],
    noMapping: [],
    errors: []
  };

  for (const row of scheduleRows) {
    try {
      // Get canonical readings from mapping
      const { data: mapping } = await supabase
        .from('ordo_lectionary_mapping')
        .select('lectionary_id')
        .eq('calendar_date', row.date)
        .single();

      if (!mapping) {
        results.noMapping.push({ date: row.date, status: row.status });
        continue;
      }

      const { data: lectionary } = await supabase
        .from('lectionary')
        .select('*')
        .eq('admin_order', mapping.lectionary_id)
        .single();

      if (!lectionary) {
        results.noMapping.push({ date: row.date, status: row.status, lectionary_id: mapping.lectionary_id });
        continue;
      }

      // Compare gospel readings
      const currentGospel = row.gospel_reference || row.readings_data?.gospel?.source || '';
      const correctGospel = lectionary.gospel_reading;

      const isMatch = normalizeReference(currentGospel) === normalizeReference(correctGospel);

      if (isMatch) {
        results.correct.push({ date: row.date, status: row.status });
        continue;
      }

      // Mismatch found
      const mismatchInfo = {
        id: row.id,
        date: row.date,
        status: row.status,
        liturgical_date: row.liturgical_date,
        current: {
          gospel: currentGospel,
          first_reading: row.readings_data?.first_reading?.source,
          psalm: row.readings_data?.psalm?.source
        },
        correct: {
          gospel: lectionary.gospel_reading,
          first_reading: lectionary.first_reading,
          psalm: lectionary.psalm,
          second_reading: lectionary.second_reading
        }
      };

      if (row.status === 'pending' || FIX_ALL) {
        // Auto-fix pending rows (or all if FIX_ALL)
        if (!DRY_RUN) {
          const newReadingsData = {
            first_reading: { source: lectionary.first_reading, text: '', heading: '' },
            psalm: { source: lectionary.psalm, text: '' },
            second_reading: lectionary.second_reading ? { source: lectionary.second_reading, text: '', heading: '' } : null,
            gospel: { source: lectionary.gospel_reading, text: '', heading: '' },
            combined_sources: [
              lectionary.first_reading,
              lectionary.psalm,
              lectionary.second_reading,
              lectionary.gospel_reading
            ].filter(Boolean).join('; ')
          };

          const { error: updateError } = await supabase
            .from('dgr_schedule')
            .update({
              gospel_reference: lectionary.gospel_reading,
              readings_data: newReadingsData
            })
            .eq('id', row.id);

          if (updateError) {
            results.errors.push({ ...mismatchInfo, error: updateError.message });
            continue;
          }
        }
        results.pendingFixed.push(mismatchInfo);
      } else {
        // Flag non-pending rows for manual review
        results.flagged.push(mismatchInfo);
      }
    } catch (err) {
      results.errors.push({ date: row.date, error: err.message });
    }
  }

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));

  console.log(`\n✅ Correct: ${results.correct.length} rows`);

  if (results.pendingFixed.length > 0) {
    console.log(`\n🔧 ${DRY_RUN ? 'Would fix' : 'Fixed'} (pending): ${results.pendingFixed.length} rows`);
    for (const row of results.pendingFixed) {
      console.log(`   ${row.date} | ${row.liturgical_date}`);
      console.log(`      Was: ${row.current.gospel}`);
      console.log(`      Now: ${row.correct.gospel}`);
    }
  }

  if (results.flagged.length > 0) {
    console.log(`\n🚩 FLAGGED (needs manual review): ${results.flagged.length} rows`);
    console.log('   These rows have been submitted/approved/published with wrong readings:\n');
    for (const row of results.flagged) {
      console.log(`   ${row.date} | ${row.status.toUpperCase()} | ${row.liturgical_date}`);
      console.log(`      Current gospel:  ${row.current.gospel}`);
      console.log(`      Correct gospel:  ${row.correct.gospel}`);
      console.log(`      Current 1st:     ${row.current.first_reading}`);
      console.log(`      Correct 1st:     ${row.correct.first_reading}`);
      console.log('');
    }
  }

  if (results.noMapping.length > 0) {
    console.log(`\n⚠️  No mapping found: ${results.noMapping.length} rows`);
    for (const row of results.noMapping) {
      console.log(`   ${row.date} | ${row.status}`);
    }
  }

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors: ${results.errors.length} rows`);
    for (const row of results.errors) {
      console.log(`   ${row.date}: ${row.error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total rows:      ${scheduleRows.length}`);
  console.log(`Correct:         ${results.correct.length}`);
  console.log(`Fixed:           ${results.pendingFixed.length}`);
  console.log(`Flagged:         ${results.flagged.length}`);
  console.log(`No mapping:      ${results.noMapping.length}`);
  console.log(`Errors:          ${results.errors.length}`);

  if (results.flagged.length > 0 && !FIX_ALL) {
    console.log('\n💡 To also fix flagged rows, run with --fix-all');
    console.log('   (Review flagged rows first - contributors may need to revise reflections)');
  }
}

function normalizeReference(ref) {
  if (!ref) return '';

  // Book abbreviation mappings
  const abbreviations = {
    'mt': 'matthew',
    'mk': 'mark',
    'lk': 'luke',
    'jn': 'john',
    'acts': 'acts',
    'rom': 'romans',
    'cor': 'corinthians',
    'gal': 'galatians',
    'eph': 'ephesians',
    'phil': 'philippians',
    'col': 'colossians',
    'thess': 'thessalonians',
    'tim': 'timothy',
    'tit': 'titus',
    'phlm': 'philemon',
    'heb': 'hebrews',
    'jas': 'james',
    'pet': 'peter',
    'jude': 'jude',
    'rev': 'revelation',
    'gen': 'genesis',
    'ex': 'exodus',
    'lev': 'leviticus',
    'num': 'numbers',
    'deut': 'deuteronomy',
    'josh': 'joshua',
    'judg': 'judges',
    'sam': 'samuel',
    'kgs': 'kings',
    'chr': 'chronicles',
    'ezra': 'ezra',
    'neh': 'nehemiah',
    'esth': 'esther',
    'ps': 'psalm',
    'prov': 'proverbs',
    'eccl': 'ecclesiastes',
    'song': 'song of songs',
    'is': 'isaiah',
    'jer': 'jeremiah',
    'lam': 'lamentations',
    'ezek': 'ezekiel',
    'dan': 'daniel',
    'hos': 'hosea',
    'obad': 'obadiah',
    'jon': 'jonah',
    'mic': 'micah',
    'nah': 'nahum',
    'hab': 'habakkuk',
    'zeph': 'zephaniah',
    'hag': 'haggai',
    'zech': 'zechariah',
    'mal': 'malachi',
    'sir': 'sirach',
    'wis': 'wisdom',
    'bar': 'baruch',
    'tob': 'tobit',
    'jdt': 'judith',
    'macc': 'maccabees'
  };

  let normalized = ref
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\./g, ':')  // Normalize period separators to colons (e.g., 7.4-17 -> 7:4-17)
    .trim();

  // Expand abbreviations
  for (const [abbrev, full] of Object.entries(abbreviations)) {
    // Match abbreviation at start or after number (e.g., "1 sam" or "mt")
    const regex = new RegExp(`\\b(\\d\\s*)?${abbrev}\\b`, 'gi');
    normalized = normalized.replace(regex, (match, num) => {
      return (num || '') + full;
    });
  }

  // Normalize verse range formats: remove spaces around dashes/colons
  normalized = normalized.replace(/\s*[-:,]\s*/g, (match) => match.trim());

  return normalized;
}

main().catch(console.error);
