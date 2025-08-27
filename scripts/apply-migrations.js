import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try direct connection
const connectionString = `postgresql://postgres.snuifqzfezxqnkzizija:JIL6Cd1LxOQ2elje@db.snuifqzfezxqnkzizija.supabase.co:5432/postgres`;

async function applyMigrations() {
	const client = new pg.Client({ connectionString });

	try {
		await client.connect();
		console.log('✅ Connected to database');

		const migrations = [
			'001_create_blocks_table.sql',
			'002_create_books_table.sql',
			'003_create_editor_logs_table.sql'
		];

		for (const migration of migrations) {
			console.log(`\nApplying migration: ${migration}`);

			try {
				const sql = readFileSync(
					join(__dirname, '..', 'supabase', 'migrations', migration),
					'utf-8'
				);

				await client.query(sql);
				console.log(`✅ Successfully applied ${migration}`);
			} catch (err) {
				if (err.message.includes('already exists')) {
					console.log(`Tables from ${migration} already exist, skipping...`);
				} else {
					console.error(`Error applying ${migration}:`, err.message);
					throw err;
				}
			}
		}

		console.log('\n✅ All migrations completed successfully!');
	} catch (err) {
		console.error('Migration failed:', err);
		process.exit(1);
	} finally {
		await client.end();
	}
}

applyMigrations().catch(console.error);
