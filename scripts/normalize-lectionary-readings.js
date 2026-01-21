#!/usr/bin/env node
/**
 * Dry-run script to normalize lectionary readings format
 *
 * Issue to fix:
 * - Period format (admin_order 745+): "Psalm 121:1-2.4-5.6-9" → "Psalm 121:1-2, 4-5, 6-9"
 *
 * NOTE: Book continuations like "1 Samuel 18:6-9; 19:1-7" are LEFT AS-IS.
 * This is the standard scholarly/liturgical citation format.
 * The parseReadings() function in dgr-utils.js handles this at parse time.
 *
 * Usage:
 *   node scripts/normalize-lectionary-readings.js          # Dry run (default)
 *   node scripts/normalize-lectionary-readings.js --apply  # Actually apply changes
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DRY_RUN = !process.argv.includes('--apply');

/**
 * Convert period-separated verses to comma-separated
 * "1-2.4-5.6-9" → "1-2, 4-5, 6-9"
 */
function normalizePeriods(reading) {
  if (!reading) return reading;

  // Replace periods between numbers with ", "
  // Run multiple times to handle overlapping patterns like "1.4.13" → "1, 4, 13"
  let result = reading;
  let previous;
  do {
    previous = result;
    result = result.replace(/(\d)\.(\d)/g, '$1, $2');
  } while (result !== previous);

  return result;
}

/**
 * Apply all normalizations to a reading
 */
function normalizeReading(reading) {
  if (!reading) return reading;

  // Only normalize periods to commas
  return normalizePeriods(reading);
}

/**
 * Check if a reading needs normalization
 */
function needsNormalization(reading) {
  if (!reading) return false;

  // Only check for period format (not book continuations - those are handled at parse time)
  return /\d\.\d/.test(reading);
}

async function main() {
  console.log('='.repeat(80));
  console.log('LECTIONARY READINGS NORMALIZATION SCRIPT');
  console.log(DRY_RUN ? '*** DRY RUN MODE - No changes will be made ***' : '*** APPLY MODE - Changes will be written to database ***');
  console.log('='.repeat(80));
  console.log('');

  // Fetch all lectionary entries
  const { data: entries, error } = await supabase
    .from('lectionary')
    .select('admin_order, liturgical_day, first_reading, psalm, second_reading, gospel_reading')
    .order('admin_order');

  if (error) {
    console.error('Error fetching lectionary:', error);
    process.exit(1);
  }

  console.log(`Fetched ${entries.length} lectionary entries\n`);

  const changes = [];
  const fields = ['first_reading', 'psalm', 'second_reading', 'gospel_reading'];

  for (const entry of entries) {
    const entryChanges = {
      admin_order: entry.admin_order,
      liturgical_day: entry.liturgical_day,
      updates: {}
    };

    for (const field of fields) {
      const original = entry[field];
      if (needsNormalization(original)) {
        const normalized = normalizeReading(original);
        if (normalized !== original) {
          entryChanges.updates[field] = {
            from: original,
            to: normalized
          };
        }
      }
    }

    if (Object.keys(entryChanges.updates).length > 0) {
      changes.push(entryChanges);
    }
  }

  // Summary
  console.log('SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Total entries: ${entries.length}`);
  console.log(`Entries needing changes: ${changes.length}`);
  console.log('');

  // Count changes
  let periodChanges = 0;

  for (const change of changes) {
    for (const [field, { from, to }] of Object.entries(change.updates)) {
      if (/\d\.\d/.test(from)) periodChanges++;
    }
  }

  console.log(`Period format changes (. → ,): ${periodChanges}`);
  console.log('');

  // Show detailed changes
  console.log('DETAILED CHANGES');
  console.log('-'.repeat(80));

  for (const change of changes) {
    console.log(`\n[${change.admin_order}] ${change.liturgical_day}`);
    for (const [field, { from, to }] of Object.entries(change.updates)) {
      console.log(`  ${field}:`);
      console.log(`    FROM: ${from}`);
      console.log(`    TO:   ${to}`);
    }
  }

  // Apply changes if not dry run
  if (!DRY_RUN && changes.length > 0) {
    console.log('\n');
    console.log('APPLYING CHANGES...');
    console.log('-'.repeat(80));

    let successCount = 0;
    let errorCount = 0;

    for (const change of changes) {
      const updateData = {};
      for (const [field, { to }] of Object.entries(change.updates)) {
        updateData[field] = to;
      }

      const { error: updateError } = await supabase
        .from('lectionary')
        .update(updateData)
        .eq('admin_order', change.admin_order);

      if (updateError) {
        console.error(`Error updating ${change.admin_order}: ${updateError.message}`);
        errorCount++;
      } else {
        successCount++;
      }
    }

    console.log(`\nApplied ${successCount} updates, ${errorCount} errors`);
  }

  // Output changes as JSON for verification
  if (DRY_RUN) {
    const outputPath = 'data/generated/lectionary-normalization-preview.json';
    const fs = await import('fs');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(changes, null, 2));
    console.log(`\nPreview saved to: ${outputPath}`);
    console.log('\nTo apply changes, run:');
    console.log('  node scripts/normalize-lectionary-readings.js --apply');
  }
}

main().catch(console.error);
