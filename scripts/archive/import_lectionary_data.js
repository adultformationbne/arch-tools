#!/usr/bin/env node
/**
 * Import Ordo, Lectionary, and mapping data into Supabase.
 * Run this after creating the tables with the migration.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('ERROR: Missing Supabase credentials in environment variables');
    console.error('Please set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importOrdo() {
    console.log('Importing Ordo calendar...');

    const csvContent = fs.readFileSync('data/generated/ordo_normalized.csv', 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    const rows = [];
    for (const row of records) {
        // Determine year cycle (A, B, C) based on year
        const year = parseInt(row.year);
        // Year cycle: 2025=C, 2026=A, 2027=B, 2028=C, 2029=A, 2030=B
        const cycles = ['C', 'A', 'B'];
        const yearCycle = cycles[(year - 2025) % 3];

        rows.push({
            calendar_date: row.calendar_date,
            liturgical_year: year,
            liturgical_season: row.liturgical_season || null,
            liturgical_week: row.liturgical_week ? parseInt(row.liturgical_week) : null,
            liturgical_name: row.liturgical_name,
            liturgical_rank: row.liturgical_rank || null,
            year_cycle: yearCycle
        });
    }

    // Batch insert
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.table('ordo_calendar').upsert(batch);
        if (error) throw error;
        console.log(`  Imported ${batch.length} Ordo entries (${i + batch.length}/${rows.length})`);
    }

    console.log(`✅ Imported ${rows.length} Ordo entries`);
}

async function importLectionary() {
    console.log('\nImporting Lectionary...');

    const csvContent = fs.readFileSync('data/source/Lectionary.csv', 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, bom: true });

    const rows = [];
    for (const row of records) {
        const adminOrder = row['Admin Order']?.trim();
        if (!adminOrder) continue;

        rows.push({
            admin_order: parseInt(adminOrder),
            year: row.Year?.trim() || null,
            week: row.Week?.trim() || null,
            day: row.Day?.trim() || null,
            time: row.Time?.trim() || null,
            liturgical_day: row['Liturgical Day']?.trim() || '',
            first_reading: row['First Reading']?.trim() || null,
            psalm: row.Psalm?.trim() || null,
            second_reading: row['Second Reading']?.trim() || null,
            gospel_reading: row['Gospel Reading']?.trim() || null
        });
    }

    // Batch insert
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.table('lectionary').upsert(batch);
        if (error) throw error;
        console.log(`  Imported ${batch.length} Lectionary entries (${i + batch.length}/${rows.length})`);
    }

    console.log(`✅ Imported ${rows.length} Lectionary entries`);
}

async function importMapping() {
    console.log('\nImporting Ordo-Lectionary mapping...');

    const csvContent = fs.readFileSync('data/generated/ordo_lectionary_mapping.csv', 'utf-8');
    const records = parse(csvContent, { columns: true, skip_empty_lines: true });

    const rows = [];
    for (const row of records) {
        const lectionaryId = row.lectionary_id?.trim();

        rows.push({
            calendar_date: row.calendar_date,
            lectionary_id: lectionaryId ? parseInt(lectionaryId) : null,
            match_type: row.match_type,
            match_method: row.match_method?.trim() || null
        });
    }

    // Batch insert
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.table('ordo_lectionary_mapping').upsert(batch);
        if (error) throw error;
        console.log(`  Imported ${batch.length} mapping entries (${i + batch.length}/${rows.length})`);
    }

    console.log(`✅ Imported ${rows.length} mapping entries`);
}

async function verifyImport() {
    console.log('\nVerifying import...');

    // Check Ordo
    const { count: ordoCount, error: ordoError } = await supabase
        .from('ordo_calendar')
        .select('*', { count: 'exact', head: true });
    if (ordoError) throw ordoError;
    console.log(`  Ordo entries: ${ordoCount}`);

    // Check Lectionary
    const { count: lectCount, error: lectError } = await supabase
        .from('lectionary')
        .select('*', { count: 'exact', head: true });
    if (lectError) throw lectError;
    console.log(`  Lectionary entries: ${lectCount}`);

    // Check Mapping
    const { count: mapCount, error: mapError } = await supabase
        .from('ordo_lectionary_mapping')
        .select('*', { count: 'exact', head: true });
    if (mapError) throw mapError;
    console.log(`  Mapping entries: ${mapCount}`);

    // Test the function
    const testDate = '2025-01-01';
    console.log(`\nTesting get_readings_for_date('${testDate}')...`);
    const { data, error } = await supabase.rpc('get_readings_for_date', { target_date: testDate });

    if (error) throw error;

    if (data && data.length > 0) {
        const reading = data[0];
        console.log(`  ✅ Found: ${reading.liturgical_day}`);
        console.log(`     Gospel: ${reading.gospel_reading || 'N/A'}`);
    } else {
        console.log(`  ❌ No reading found for ${testDate}`);
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('IMPORTING LECTIONARY DATA TO SUPABASE');
    console.log('='.repeat(60));

    try {
        await importOrdo();
        await importLectionary();
        await importMapping();
        await verifyImport();

        console.log('\n' + '='.repeat(60));
        console.log('✅ IMPORT COMPLETE!');
        console.log('='.repeat(60));
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

main();
