#!/usr/bin/env node
/**
 * Check an Ordo CSV against the lectionary from the command line.
 *
 * Uses the same processor as the DGR Liturgical Calendar upload page
 * (src/lib/server/ordo-processor.ts) — it never writes to the database.
 * Import from the upload page once the output looks right.
 *
 * Usage:
 *   node --experimental-strip-types scripts/process-ordo.ts <ordo.csv> <year> [--out result.json] [--lectionary lectionary.json]
 */
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { parseOrdoCsv, processOrdo } from '../src/lib/server/ordo-processor.ts';
import type { LectionaryRow } from '../src/lib/server/ordo-processor.ts';

dotenv.config();

const args = process.argv.slice(2);
const option = (flag: string) => {
	const i = args.indexOf(flag);
	return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const outPath = option('--out');
const lectionaryPath = option('--lectionary');
const [csvPath, yearArg] = args;

if (!csvPath || !yearArg) {
	console.error('Usage: node --experimental-strip-types scripts/process-ordo.ts <ordo.csv> <year> [--out result.json] [--lectionary lectionary.json]');
	process.exit(1);
}

async function loadLectionary(): Promise<LectionaryRow[]> {
	if (lectionaryPath) return JSON.parse(readFileSync(lectionaryPath, 'utf-8'));
	const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
	const { data, error } = await supabase.from('lectionary').select('*');
	if (error) throw error;
	return data;
}

const year = parseInt(yearArg, 10);
const result = processOrdo(parseOrdoCsv(readFileSync(csvPath, 'utf-8'), year), await loadLectionary(), year);

console.log(`${result.total} days · ${result.exact} matched · ${result.unmatched} unmatched · ${result.warningCount} with warnings`);
for (const w of result.fileWarnings) console.log(`FILE  ${w}`);
for (const e of result.entries) {
	if (e.error) console.log(`ERROR ${e.calendar_date}  ${e.error}`);
	for (const w of e.warnings) console.log(`WARN  ${e.calendar_date}  ${w}`);
}
if (outPath) {
	writeFileSync(outPath, JSON.stringify(result, null, 2));
	console.log(`Wrote ${outPath}`);
}
process.exit(result.errorCount ? 1 : 0);
