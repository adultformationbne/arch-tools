#!/usr/bin/env node
/**
 * Execute the pre-generated SQL import files using Supabase
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://snuifqzfezxqnkzizija.supabase.co';
const SUPABASE_KEY = 'sb_secret_nvuXMIl_96UeaGyhl_3I4g_0ihgGo3b';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function executeSQLFile(filepath, name) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Executing ${name}...`);
    console.log(`${'='.repeat(60)}`);

    const sql = fs.readFileSync(filepath, 'utf-8');
    const statements = sql.trim().split('\n\n');

    console.log(`  Found ${statements.length} SQL statements`);

    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
        process.stdout.write(`  [${i + 1}/${statements.length}] Executing... `);

        try {
            const { error } = await supabase.rpc('exec_sql', { sql_query: statements[i] });
            if (error) {
                // If RPC doesn't exist, try direct execution via postgrest
                const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    },
                    body: JSON.stringify({ query: statements[i] })
                });

                if (!response.ok) {
                    // Last resort: use the postgres connection string
                    throw new Error(`HTTP ${response.status}`);
                }
            }

            successCount++;
            console.log(`✓`);
        } catch (error) {
            console.log(`✗ ERROR: ${error.message}`);
            console.log(`  Statement: ${statements[i].substring(0, 100)}...`);
            // Continue with next statement
        }
    }

    console.log(`\n✅ ${name}: ${successCount}/${statements.length} statements executed successfully`);
    return successCount === statements.length;
}

async function verifyImport() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('Verifying import...');
    console.log(`${'='.repeat(60)}`);

    try {
        // Check Ordo
        const { count: ordoCount } = await supabase
            .from('ordo_calendar')
            .select('*', { count: 'exact', head: true });
        console.log(`  Ordo entries: ${ordoCount}`);

        // Check Lectionary
        const { count: lectCount } = await supabase
            .from('lectionary')
            .select('*', { count: 'exact', head: true });
        console.log(`  Lectionary entries: ${lectCount}`);

        // Check Mapping
        const { count: mapCount } = await supabase
            .from('ordo_lectionary_mapping')
            .select('*', { count: 'exact', head: true });
        console.log(`  Mapping entries: ${mapCount}`);

        // Test the function
        const testDate = '2025-01-01';
        console.log(`\nTesting get_readings_for_date('${testDate}')...`);
        const { data, error } = await supabase.rpc('get_readings_for_date', { target_date: testDate });

        if (error) {
            console.log(`  ⚠️  Function error: ${error.message}`);
        } else if (data && data.length > 0) {
            const reading = data[0];
            console.log(`  ✅ Found: ${reading.liturgical_day}`);
            console.log(`     Gospel: ${reading.gospel_reading || 'N/A'}`);
        } else {
            console.log(`  ⚠️  No reading found`);
        }
    } catch (error) {
        console.error(`  ❌ Verification error: ${error.message}`);
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('EXECUTING SQL IMPORTS');
    console.log('='.repeat(60));

    try {
        const success = await executeSQLFile('/tmp/complete_import.sql', 'Complete Import (Ordo + Lectionary + Mapping)');

        if (!success) {
            console.log('\n⚠️  Some statements failed, but continuing with verification...');
        }

        await verifyImport();

        console.log('\n' + '='.repeat(60));
        console.log('✅ IMPORT PROCESS COMPLETE!');
        console.log('='.repeat(60));
    } catch (error) {
        console.error(`\n❌ ERROR: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

main();
