#!/usr/bin/env tsx
/**
 * Database Schema Validation Script
 *
 * This script validates that all database operations in the codebase
 * use the correct column names as defined in the database types.
 *
 * Usage: npm run validate-schema
 */

import { Database } from '../src/lib/database.types';
import * as fs from 'fs';
import * as path from 'path';

type Tables = Database['public']['Tables'];

// Define expected column names for key tables
const SCHEMA: Record<string, string[]> = {
	courses_reflection_questions: [
		'id',
		'session_id',  // NOT session-id
		'question_text',
		'created_at',
		'updated_at'
	],
	courses_modules: [
		'id',
		'course_id',
		'name',  // NOT module_name or title
		'description',
		'order_number'
	],
	courses_sessions: [
		'id',
		'module_id',
		'session_number',
		'title',
		'description',
		'learning_objectives',
		'reflections_enabled',
		'created_at',
		'updated_at'
	],
	courses_cohorts: [
		'id',
		'module_id',
		'name',
		'start_date',
		'end_date',
		'current_session',
		'status',
		'email_preferences',
		'created_at',
		'updated_at'
	],
	courses_enrollments: [
		'id',
		'cohort_id',
		'user_profile_id',
		'email',
		'full_name',
		'role',
		'status',
		'hub_id',
		'assigned_admin_id',
		'current_session',
		'enrolled_at',
		'invitation_accepted_at',
		'imported_by',
		'error_message',
		'created_at',
		'updated_at'
	],
	courses_materials: [
		'id',
		'session_id',  // NOT module_id
		'title',
		'content',
		'type',
		'display_order',
		'created_at',
		'updated_at'
	],
	courses_reflection_responses: [
		'id',
		'enrollment_id',
		'cohort_id',
		'question_id',
		'session_number',
		'response_text',
		'is_public',
		'status',
		'feedback',
		'marked_by',
		'marked_at',
		'created_at',
		'updated_at'
	]
};

// Common mistakes to check for
const COMMON_MISTAKES: Record<string, string[]> = {
	'courses_reflection_questions': [
		'session-id',  // Wrong: should be session_id
		'module_id',   // Wrong: reflection questions are linked to sessions, not modules
		'text',        // Wrong: should be question_text
		'question'     // Wrong: should be question_text
	],
	'courses_modules': [
		'module_name', // Wrong: should be name
		'title',       // Wrong: should be name
		'number',      // Wrong: should be order_number
		'order'        // Wrong: should be order_number
	],
	'courses_sessions': [
		'session-id',  // Wrong: should be session_id
		'name',        // Wrong: should be title
		'week_number'  // Wrong: should be session_number
	],
	'courses_materials': [
		'module_id',   // Wrong: materials are linked to sessions, not modules
		'session-id'   // Wrong: should be session_id
	]
};

interface Issue {
	file: string;
	line: number;
	table: string;
	issue: string;
	suggestion: string;
}

const issues: Issue[] = [];

function findFilesRecursive(dir: string, pattern: RegExp): string[] {
	const files: string[] = [];

	try {
		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				if (entry.name !== 'node_modules' && entry.name !== '.git') {
					files.push(...findFilesRecursive(fullPath, pattern));
				}
			} else if (entry.isFile() && pattern.test(entry.name)) {
				files.push(fullPath);
			}
		}
	} catch (err) {
		console.error(`Error reading directory ${dir}:`, err);
	}

	return files;
}

function validateFile(filePath: string) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');

	// Check each table
	for (const [tableName, validColumns] of Object.entries(SCHEMA)) {
		const commonMistakes = COMMON_MISTAKES[tableName] || [];

		// Find references to this table
		const tableRegex = new RegExp(`\\.from\\(['"\`]${tableName}['"\`]\\)`, 'g');
		let match;

		while ((match = tableRegex.exec(content)) !== null) {
			const startIndex = match.index;

			// Get approximate line number
			const lineNumber = content.substring(0, startIndex).split('\n').length;

			// Extract the query block (next ~20 lines after .from())
			const queryBlock = lines.slice(lineNumber - 1, lineNumber + 20).join('\n');

			// Check for common mistakes in the query block
			for (const mistake of commonMistakes) {
				// Check in insert/update objects
				const insertRegex = new RegExp(`\\b${mistake}\\s*:`, 'g');
				if (insertRegex.test(queryBlock)) {
					const correctColumn = validColumns.find(col =>
						col.toLowerCase().includes(mistake.replace(/[_-]/g, '').toLowerCase())
					);

					issues.push({
						file: filePath,
						line: lineNumber,
						table: tableName,
						issue: `Using invalid column name: ${mistake}`,
						suggestion: correctColumn
							? `Use "${correctColumn}" instead`
							: `Check valid columns: ${validColumns.join(', ')}`
					});
				}

				// Check in .eq(), .select() etc
				const methodRegex = new RegExp(`\\.(?:eq|neq|select|in|order)\\(['"]\s*${mistake}`, 'g');
				if (methodRegex.test(queryBlock)) {
					const correctColumn = validColumns.find(col =>
						col.toLowerCase().includes(mistake.replace(/[_-]/g, '').toLowerCase())
					);

					issues.push({
						file: filePath,
						line: lineNumber,
						table: tableName,
						issue: `Using invalid column name in query: ${mistake}`,
						suggestion: correctColumn
							? `Use "${correctColumn}" instead`
							: `Check valid columns: ${validColumns.join(', ')}`
					});
				}
			}
		}
	}
}

function main() {
	console.log('🔍 Validating database schema usage in course routes...\n');

	const srcDir = path.join(process.cwd(), 'src');
	const files = findFilesRecursive(srcDir, /\.(ts|svelte)$/);

	console.log(`Found ${files.length} files to check\n`);

	for (const file of files) {
		validateFile(file);
	}

	// Report results
	if (issues.length === 0) {
		console.log('✅ No schema mismatches found!\n');
		process.exit(0);
	} else {
		console.log(`❌ Found ${issues.length} potential schema issues:\n`);

		// Group by file
		const byFile = issues.reduce((acc, issue) => {
			if (!acc[issue.file]) acc[issue.file] = [];
			acc[issue.file].push(issue);
			return acc;
		}, {} as Record<string, Issue[]>);

		for (const [file, fileIssues] of Object.entries(byFile)) {
			console.log(`\n📄 ${path.relative(process.cwd(), file)}`);

			for (const issue of fileIssues) {
				console.log(`  Line ${issue.line}: ${issue.issue}`);
				console.log(`  Table: ${issue.table}`);
				console.log(`  💡 ${issue.suggestion}`);
				console.log('');
			}
		}

		// Summary by table
		console.log('\n📊 Summary by table:');
		const byTable = issues.reduce((acc, issue) => {
			acc[issue.table] = (acc[issue.table] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		for (const [table, count] of Object.entries(byTable)) {
			console.log(`  ${table}: ${count} issue(s)`);
		}

		console.log(`\n⚠️  Total issues found: ${issues.length}\n`);
		process.exit(1);
	}
}

main();
