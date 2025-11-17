#!/usr/bin/env node
/**
 * Database Schema Validation Script
 *
 * Validates that all database operations use correct column names
 * by parsing the actual schema from database.types.ts
 *
 * Usage: npm run validate-schema
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const issues = [];

/**
 * Parse database.types.ts to extract table schemas
 */
function parseSchemaFromTypes() {
	const typesPath = path.join(__dirname, '../src/lib/database.types.ts');
	const content = fs.readFileSync(typesPath, 'utf-8');

	const schemas = {};

	// Find all table definitions in the Tables section
	// Pattern: table_name: { Row: { column: type, ... } }
	const tableRegex = /(\w+):\s*\{[^}]*Row:\s*\{([^}]+)\}/gs;
	let match;

	while ((match = tableRegex.exec(content)) !== null) {
		const tableName = match[1];
		const rowContent = match[2];

		// Extract column names from Row definition
		const columnRegex = /(\w+):\s*[\w\[\]|<>]+/g;
		const columns = [];
		let colMatch;

		while ((colMatch = columnRegex.exec(rowContent)) !== null) {
			columns.push(colMatch[1]);
		}

		if (columns.length > 0) {
			schemas[tableName] = columns;
		}
	}

	return schemas;
}

function findFilesRecursive(dir, pattern) {
	const files = [];

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

function validateFile(filePath, schemas) {
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');

	// Check each table that we have schema info for
	for (const [tableName, validColumns] of Object.entries(schemas)) {
		// Find references to this table
		const tableRegex = new RegExp(`\\.from\\(['"\`]${tableName}['"\`]\\)`, 'g');
		let match;

		while ((match = tableRegex.exec(content)) !== null) {
			const startIndex = match.index;
			const lineNumber = content.substring(0, startIndex).split('\n').length;

			// Extract query block - look for the complete method chain
			// Stop at semicolon, closing brace, or next .from()
			let endIndex = content.indexOf(';', startIndex);
			const nextFrom = content.indexOf('.from(', startIndex + 10);
			if (nextFrom !== -1 && nextFrom < endIndex) {
				endIndex = nextFrom;
			}

			const queryBlock = content.substring(startIndex, endIndex !== -1 ? endIndex : startIndex + 500);

			// Check .insert() operations
			const insertMatch = queryBlock.match(/\.insert\(\s*(\{[^}]+\}|\[)/);
			if (insertMatch && insertMatch[1].startsWith('{')) {
				// Single object insert
				const objectContent = extractObject(queryBlock, insertMatch.index + insertMatch[0].length - 1);
				validateColumns(objectContent, tableName, validColumns, filePath, lineNumber, 'insert');
			}

			// Check .update() operations
			const updateMatch = queryBlock.match(/\.update\(\s*\{/);
			if (updateMatch) {
				const objectContent = extractObject(queryBlock, updateMatch.index + updateMatch[0].length - 1);
				validateColumns(objectContent, tableName, validColumns, filePath, lineNumber, 'update');
			}
		}
	}
}

/**
 * Extract a JavaScript object from code starting at a given position
 */
function extractObject(code, startPos) {
	let braceCount = 1;
	let i = startPos + 1;

	while (i < code.length && braceCount > 0) {
		if (code[i] === '{') braceCount++;
		if (code[i] === '}') braceCount--;
		i++;
	}

	return code.substring(startPos, i);
}

/**
 * Validate that all columns in an object exist in the table schema
 */
function validateColumns(objectContent, tableName, validColumns, filePath, lineNumber, operation) {
	// Extract column names - pattern: columnName: value
	// Handle both simple and complex cases
	const columnRegex = /(\w+):/g;
	let match;

	const usedColumns = new Set();

	while ((match = columnRegex.exec(objectContent)) !== null) {
		const columnName = match[1];

		// Skip JavaScript keywords and common non-column patterns
		const skipWords = ['status', 'data', 'error', 'type', 'message', 'success', 'default'];
		if (skipWords.includes(columnName)) continue;

		usedColumns.add(columnName);
	}

	// Check each used column against the schema
	for (const columnName of usedColumns) {
		if (!validColumns.includes(columnName)) {
			// Try to find a similar column (for better suggestions)
			const similar = validColumns.find(col =>
				col.includes(columnName) ||
				columnName.includes(col) ||
				col.replace(/_/g, '') === columnName.replace(/_/g, '')
			);

			issues.push({
				file: filePath,
				line: lineNumber,
				table: tableName,
				operation,
				issue: `Column "${columnName}" doesn't exist in table`,
				suggestion: similar
					? `Did you mean "${similar}"?`
					: `Valid columns: ${validColumns.join(', ')}`
			});
		}
	}
}

function main() {
	console.log('🔍 Validating database schema against database.types.ts...\n');

	// Parse schema from TypeScript types
	const schemas = parseSchemaFromTypes();
	const tableCount = Object.keys(schemas).length;

	console.log(`📊 Loaded ${tableCount} table schemas from database.types.ts\n`);

	// Find all TypeScript/Svelte files
	const srcDir = path.join(__dirname, '..', 'src');
	const files = findFilesRecursive(srcDir, /\.(ts|svelte)$/);

	console.log(`📁 Checking ${files.length} files...\n`);

	// Validate each file
	for (const file of files) {
		validateFile(file, schemas);
	}

	// Report results
	if (issues.length === 0) {
		console.log('✅ No schema mismatches found!\n');
		console.log('All database operations use valid column names.\n');
		process.exit(0);
	} else {
		console.log(`❌ Found ${issues.length} schema mismatch(es):\n`);

		// Group by file
		const byFile = issues.reduce((acc, issue) => {
			if (!acc[issue.file]) acc[issue.file] = [];
			acc[issue.file].push(issue);
			return acc;
		}, {});

		for (const [file, fileIssues] of Object.entries(byFile)) {
			const relativePath = path.relative(path.join(__dirname, '..'), file);
			console.log(`\n📄 ${relativePath}`);

			for (const issue of fileIssues) {
				console.log(`  Line ${issue.line} (${issue.operation}):`);
				console.log(`    ${issue.issue}`);
				console.log(`    💡 ${issue.suggestion}`);
				console.log('');
			}
		}

		// Summary
		console.log('\n📊 Summary by table:');
		const byTable = issues.reduce((acc, issue) => {
			acc[issue.table] = (acc[issue.table] || 0) + 1;
			return acc;
		}, {});

		for (const [table, count] of Object.entries(byTable)) {
			console.log(`  ${table}: ${count} issue(s)`);
		}

		console.log(`\n⚠️  Total: ${issues.length} schema mismatch(es)\n`);
		process.exit(1);
	}
}

main();
