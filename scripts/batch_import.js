#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = 'https://snuifqzfezxqnkzizija.supabase.co';
const SUPABASE_KEY = 'sb_secret_nvuXMIl_96UeaGyhl_3I4g_0ihgGo3b';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

async function importOrdo() {
    console.log('\n📅 Importing Ordo calendar...');

    const csv = fs.readFileSync('data/generated/ordo_normalized.csv', 'utf-8');
    const records = parse(csv, { columns: true, skip_empty_lines: true });

    const rows = records.map(row => {
        const year = parseInt(row.year);
        const cycles = ['C', 'A', 'B'];
        const yearCycle = cycles[(year - 2025) % 3];

        return {
            calendar_date: row.calendar_date,
            liturgical_year: year,
            liturgical_season: row.liturgical_season || null,
            liturgical_week: row.liturgical_week ? parseInt(row.liturgical_week) : null,
            liturgical_name: row.liturgical_name,
            liturgical_rank: row.liturgical_rank || null,
            year_cycle: yearCycle
        };
    });

    const { error } = await supabase.from('ordo_calendar').insert(rows);
    if (error) throw error;

    console.log(`✅ Imported ${rows.length} Ordo entries`);
    return rows.length;
}

async function importLectionary() {
    console.log('\n📖 Importing Lectionary...');

    const csv = fs.readFileSync('data/source/Lectionary.csv', 'utf-8');
    const records = parse(csv, { columns: true, skip_empty_lines: true, bom: true });

    const rows = records
        .filter(row => row['Admin Order']?.trim())
        .map(row => ({
            admin_order: parseInt(row['Admin Order'].trim()),
            year: row.Year?.trim() || null,
            week: row.Week?.trim() || null,
            day: row.Day?.trim() || null,
            time: row.Time?.trim() || null,
            liturgical_day: row['Liturgical Day']?.trim() || '',
            first_reading: row['First Reading']?.trim() || null,
            psalm: row.Psalm?.trim() || null,
            second_reading: row['Second Reading']?.trim() || null,
            gospel_reading: row['Gospel Reading']?.trim() || null
        }));

    const { error } = await supabase.from('lectionary').insert(rows);
    if (error) throw error;

    console.log(`✅ Imported ${rows.length} Lectionary entries`);
    return rows.length;
}

async function importMapping() {
    console.log('\n🔗 Importing Ordo-Lectionary mapping...');

    const csv = fs.readFileSync('data/generated/ordo_lectionary_mapping.csv', 'utf-8');
    const records = parse(csv, { columns: true, skip_empty_lines: true });

    const rows = records.map(row => ({
        calendar_date: row.calendar_date,
        lectionary_id: row.lectionary_id?.trim() ? parseInt(row.lectionary_id.trim()) : null,
        match_type: row.match_type,
        match_method: row.match_method?.trim() || null
    }));

    const { error } = await supabase.from('ordo_lectionary_mapping').insert(rows);
    if (error) throw error;

    console.log(`✅ Imported ${rows.length} mapping entries`);
    return rows.length;
}

async function verify() {
    console.log('\n🔍 Verifying import...');

    const { count: ordoCount } = await supabase
        .from('ordo_calendar')
        .select('*', { count: 'exact', head: true });
    console.log(`  Ordo entries: ${ordoCount}`);

    const { count: lectCount } = await supabase
        .from('lectionary')
        .select('*', { count: 'exact', head: true });
    console.log(`  Lectionary entries: ${lectCount}`);

    const { count: mapCount } = await supabase
        .from('ordo_lectionary_mapping')
        .select('*', { count: 'exact', head: true });
    console.log(`  Mapping entries: ${mapCount}`);

    // Test the function
    console.log('\n🧪 Testing get_readings_for_date(2025-01-01)...');
    const { data, error } = await supabase.rpc('get_readings_for_date', { target_date: '2025-01-01' });

    if (error) {
        console.log(`  ❌ Error: ${error.message}`);
    } else if (data && data.length > 0) {
        const reading = data[0];
        console.log(`  ✅ ${reading.liturgical_day}`);
        console.log(`     Gospel: ${reading.gospel_reading || 'N/A'}`);
    } else {
        console.log(`  ❌ No reading found`);
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('📚 IMPORTING LECTIONARY DATA');
    console.log('='.repeat(60));

    try {
        await importOrdo();
        await importLectionary();
        await importMapping();
        await verify();

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
