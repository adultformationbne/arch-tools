#!/usr/bin/env node

import { execSync } from 'child_process';

// Parse command line arguments
const args = process.argv.slice(2);
const tableName = args[0];
const filters = args[1] || '';
const limit = args[2] || '10';

if (!tableName) {
	console.log(`
🔍 Database Query Tool

Usage: npm run query <table_name> [filters] [limit]

Examples:
  npm run query blocks                           # Get 10 latest blocks
  npm run query blocks "tag='chapter'" 5        # Get 5 chapter blocks
  npm run query dgr_schedule "status='pending'" # Get pending DGR entries
  npm run query books "" 3                      # Get 3 latest books (empty filter)

Available tables:
  📝 Editor: blocks, books, chapters, editor_logs, admin_settings
  📧 DGR: dgr_contributors, dgr_schedule, dgr_email_queue

Filter examples:
  - "status='pending'"
  - "created_at > '2025-01-01'"
  - "tag='chapter' AND content LIKE '%Introduction%'"
  - "active=true"
  `);
	process.exit(1);
}

// Build the SQL query
let query = `SELECT * FROM ${tableName}`;

if (filters && filters.trim()) {
	query += ` WHERE ${filters}`;
}

query += ` ORDER BY created_at DESC LIMIT ${limit};`;

console.log(`🔍 Querying: ${query}\n`);

try {
	// Execute the query using docker exec
	const command = `docker exec supabase_db_editor-app psql -U postgres -d postgres -c "${query}"`;
	const result = execSync(command, { encoding: 'utf8' });

	console.log(result);

	// Also show row count if results exist
	if (!result.includes('(0 rows)')) {
		const countQuery = `SELECT COUNT(*) as total_rows FROM ${tableName}${filters && filters.trim() ? ` WHERE ${filters}` : ''};`;
		const countCommand = `docker exec supabase_db_editor-app psql -U postgres -d postgres -c "${countQuery}"`;
		const countResult = execSync(countCommand, { encoding: 'utf8' });

		console.log('📊 Total matching rows:');
		console.log(countResult);
	}
} catch (error) {
	console.error('❌ Query failed:');
	console.error(error.message);
	console.log('\n💡 Tips:');
	console.log('- Make sure Supabase is running: supabase status');
	console.log('- Check table name spelling');
	console.log('- Use single quotes for string values in filters');
	console.log('- Escape special characters properly');
	process.exit(1);
}
