#!/usr/bin/env node
/**
 * Bulk Upload DGR Reflections from Word Documents
 *
 * Usage: node scripts/bulk-upload-dgr.js [--dry-run]
 *
 * Reads .docx files from data/archive, parses them using mammoth,
 * and uploads to dgr_schedule table.
 */

import mammoth from 'mammoth';
import { createClient } from '@supabase/supabase-js';
import { readdir } from 'fs/promises';
import { join } from 'path';
import 'dotenv/config';

const ARCHIVE_DIR = 'data/archive';
const DRY_RUN = process.argv.includes('--dry-run');

// Initialize Supabase
const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY
);

// Author name to contributor mapping (will be loaded from DB)
let contributorMap = {};

/**
 * Parse date from filename: "DGR YY.MM.DD AUTHOR edited.docx"
 */
function parseDateFromFilename(filename) {
	const match = filename.match(/DGR\s+(\d{2})\.(\d{2})\.(\d{2})/);
	if (!match) return null;

	const [, yy, mm, dd] = match;
	const year = 2000 + parseInt(yy);
	return `${year}-${mm}-${dd}`;
}

/**
 * Parse the HTML table output from mammoth
 */
function parseWordHtml(html) {
	const result = {
		date: null,
		liturgicalDate: null,
		readings: null,
		title: null,
		gospelQuote: null,
		author: null,
		reflection: null
	};

	// Extract table cells - mammoth outputs <tr><td>Label</td><td>Value</td></tr>
	const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
	const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

	let lastLabel = null;
	let reflectionParagraphs = [];
	let inReflection = false;

	// Process each row
	let rowMatch;
	while ((rowMatch = rowRegex.exec(html)) !== null) {
		const rowContent = rowMatch[1];
		const cells = [];
		let cellMatch;

		while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
			// Strip HTML tags and clean up
			const text = cellMatch[1]
				.replace(/<[^>]+>/g, ' ')
				.replace(/&nbsp;/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();
			cells.push(text);
		}

		if (cells.length === 0) continue;

		// Check if this is a colspan row (reflection text)
		if (rowContent.includes('colspan')) {
			// This is likely the reflection content
			// Extract paragraphs
			const paragraphs = rowContent
				.split(/<\/p>\s*<p[^>]*>/i)
				.map(p => p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
				.filter(p => p.length > 0);

			reflectionParagraphs = paragraphs;
			continue;
		}

		if (cells.length >= 2) {
			const label = cells[0].replace(/:$/, '').trim().toLowerCase();
			const value = cells[1];

			switch (label) {
				case 'date':
					result.date = value;
					break;
				case 'liturgical date':
					result.liturgicalDate = value;
					break;
				case 'readings':
					result.readings = value;
					break;
				case 'title':
					result.title = value;
					break;
				case 'gospel quote':
					result.gospelQuote = value;
					break;
				case 'written by':
				case 'reflection written by':
					result.author = value;
					break;
			}
		}
	}

	// Join reflection paragraphs
	if (reflectionParagraphs.length > 0) {
		result.reflection = reflectionParagraphs.join('\n\n');
	}

	return result;
}

/**
 * Find contributor by name (fuzzy match)
 */
function findContributor(authorName) {
	if (!authorName) return null;

	const normalized = authorName.toLowerCase().trim();

	// Direct match
	for (const [name, id] of Object.entries(contributorMap)) {
		if (name.toLowerCase() === normalized) {
			return id;
		}
	}

	// Match ignoring titles/suffixes in parentheses: "Chad Hargrave (Deacon)" matches "Chad Hargrave"
	for (const [name, id] of Object.entries(contributorMap)) {
		const nameWithoutTitle = name.replace(/\s*\([^)]+\)\s*/g, '').toLowerCase().trim();
		if (nameWithoutTitle === normalized) {
			return id;
		}
	}

	// Partial match (first + last name)
	for (const [name, id] of Object.entries(contributorMap)) {
		const nameWithoutTitle = name.replace(/\s*\([^)]+\)\s*/g, '').toLowerCase().trim();
		const nameParts = nameWithoutTitle.split(/\s+/);
		const authorParts = normalized.split(/\s+/);

		// Check if first and last name match
		if (nameParts.length >= 2 && authorParts.length >= 2) {
			if (nameParts[0] === authorParts[0] &&
				nameParts[nameParts.length - 1] === authorParts[authorParts.length - 1]) {
				return id;
			}
		}

		// Check if just first name matches (for short names)
		if (nameParts[0] === authorParts[0] && authorParts.length === 1) {
			return id;
		}
	}

	return null;
}

/**
 * Load contributors from database
 */
async function loadContributors() {
	const { data, error } = await supabase
		.from('dgr_contributors')
		.select('id, name, email');

	if (error) {
		console.error('Failed to load contributors:', error);
		return;
	}

	contributorMap = {};
	for (const c of data) {
		contributorMap[c.name] = c.id;
	}

	console.log(`Loaded ${data.length} contributors`);
}

/**
 * Process a single .docx file
 */
async function processFile(filepath, filename) {
	console.log(`\nProcessing: ${filename}`);

	// Parse date from filename
	const date = parseDateFromFilename(filename);
	if (!date) {
		console.log(`  ⚠️  Could not parse date from filename`);
		return { success: false, error: 'Invalid filename format' };
	}
	console.log(`  Date: ${date}`);

	// Extract HTML from docx
	let html;
	try {
		const result = await mammoth.convertToHtml({ path: filepath });
		html = result.value;
	} catch (err) {
		console.log(`  ❌ Failed to read docx: ${err.message}`);
		return { success: false, error: err.message };
	}

	// Parse the HTML
	const parsed = parseWordHtml(html);
	console.log(`  Title: ${parsed.title || '(none)'}`);
	console.log(`  Author: ${parsed.author || '(none)'}`);
	console.log(`  Liturgical: ${parsed.liturgicalDate || '(none)'}`);
	console.log(`  Readings: ${parsed.readings || '(none)'}`);
	console.log(`  Quote: ${(parsed.gospelQuote || '').substring(0, 50)}...`);
	console.log(`  Reflection: ${(parsed.reflection || '').substring(0, 50)}...`);

	// Find contributor
	const contributorId = findContributor(parsed.author);
	if (contributorId) {
		console.log(`  ✓ Matched contributor: ${parsed.author}`);
	} else if (parsed.author) {
		console.log(`  ⚠️  Unknown contributor: ${parsed.author}`);
	}

	// Validate required fields
	if (!parsed.reflection) {
		console.log(`  ❌ No reflection content found`);
		return { success: false, error: 'No reflection content' };
	}

	if (DRY_RUN) {
		console.log(`  [DRY RUN] Would upsert schedule entry`);
		return { success: true, dryRun: true };
	}

	// Check if entry exists
	const { data: existing } = await supabase
		.from('dgr_schedule')
		.select('id')
		.eq('date', date)
		.single();

	// Prepare data
	const scheduleData = {
		date,
		liturgical_date: parsed.liturgicalDate,
		reflection_title: parsed.title,
		reflection_content: parsed.reflection,
		gospel_quote: parsed.gospelQuote,
		status: 'approved',
		submitted_at: new Date().toISOString(),
		approved_at: new Date().toISOString()
	};

	// Add contributor if found
	if (contributorId) {
		scheduleData.contributor_id = contributorId;
	}

	// Parse readings into readings_data format
	if (parsed.readings) {
		const readingsParts = parsed.readings.split(/\s*[|;]\s*/);
		const readingsData = {
			combined_sources: parsed.readings // Keep original format for template
		};

		if (readingsParts[0]) readingsData.first_reading = { source: readingsParts[0].trim() };
		if (readingsParts[1]) readingsData.psalm = { source: readingsParts[1].trim() };

		// Handle 3-reading days (weekdays) vs 4-reading days (Sundays)
		if (readingsParts.length === 3) {
			// Weekday: first reading, psalm, gospel (no second reading)
			readingsData.gospel = { source: readingsParts[2].trim() };
			scheduleData.gospel_reference = readingsParts[2].trim();
		} else if (readingsParts.length >= 4) {
			// Sunday/Solemnity: first reading, psalm, second reading, gospel
			readingsData.second_reading = { source: readingsParts[2].trim() };
			readingsData.gospel = { source: readingsParts[3].trim() };
			scheduleData.gospel_reference = readingsParts[3].trim();
		} else if (readingsParts[2]) {
			// Fallback
			readingsData.gospel = { source: readingsParts[2].trim() };
			scheduleData.gospel_reference = readingsParts[2].trim();
		}

		scheduleData.readings_data = readingsData;
	}

	// Upsert
	let result;
	if (existing) {
		const { data, error } = await supabase
			.from('dgr_schedule')
			.update(scheduleData)
			.eq('id', existing.id)
			.select()
			.single();

		if (error) {
			console.log(`  ❌ Update failed: ${error.message}`);
			return { success: false, error: error.message };
		}
		console.log(`  ✓ Updated existing entry`);
		result = data;
	} else {
		const { data, error } = await supabase
			.from('dgr_schedule')
			.insert(scheduleData)
			.select()
			.single();

		if (error) {
			console.log(`  ❌ Insert failed: ${error.message}`);
			return { success: false, error: error.message };
		}
		console.log(`  ✓ Created new entry`);
		result = data;
	}

	return { success: true, data: result };
}

/**
 * Main function
 */
async function main() {
	console.log('='.repeat(60));
	console.log('DGR Bulk Upload Script');
	console.log('='.repeat(60));

	if (DRY_RUN) {
		console.log('\n🔍 DRY RUN MODE - No changes will be made\n');
	}

	// Load contributors
	await loadContributors();

	// Get list of .docx files
	const files = await readdir(ARCHIVE_DIR);
	const docxFiles = files.filter(f => f.endsWith('.docx') && f.startsWith('DGR'));

	console.log(`\nFound ${docxFiles.length} DGR files to process`);

	// Process each file
	const results = {
		success: 0,
		failed: 0,
		skipped: 0
	};

	for (const filename of docxFiles.sort()) {
		const filepath = join(ARCHIVE_DIR, filename);
		const result = await processFile(filepath, filename);

		if (result.success) {
			results.success++;
		} else {
			results.failed++;
		}
	}

	// Summary
	console.log('\n' + '='.repeat(60));
	console.log('Summary');
	console.log('='.repeat(60));
	console.log(`✓ Success: ${results.success}`);
	console.log(`✗ Failed: ${results.failed}`);

	if (DRY_RUN) {
		console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
	}
}

main().catch(console.error);
