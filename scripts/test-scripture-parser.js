#!/usr/bin/env node
/**
 * Scripture Parser Testing Utility
 *
 * Tests the scripture parsing pipeline to ensure verse numbers and other
 * unwanted content is properly stripped from the text.
 *
 * Usage:
 *   node scripts/test-scripture-parser.js                    # Test with sample refs
 *   node scripts/test-scripture-parser.js "John 3:16-17"     # Test specific reference
 *   node scripts/test-scripture-parser.js --from-db          # Test refs from DGR schedule
 *   node scripts/test-scripture-parser.js --verbose          # Show full text output
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import {
	cleanGospelText,
	formatGospelForDisplay,
	formatGospelAsHtml
} from '../src/lib/utils/dgr-common.js';

dotenv.config();

const OREMUS_BASE_URL = 'https://bible.oremus.org/';

// Sample scripture references for testing
const SAMPLE_REFS = [
	'Luke 21:29-33',
	'Matthew 5:1-12',
	'John 3:16-21',
	'Mark 10:17-27',
	'Luke 12:1-7',
	'Matthew 18:12-14',
	'John 1:1-18',
	'Luke 15:1-10'
];

/**
 * Fetch raw scripture HTML from Oremus API
 */
async function fetchFromOremus(passage, version = 'NRSVAE') {
	const params = new URLSearchParams({
		passage,
		version,
		vnum: 'yes',
		fnote: 'no',
		show_ref: 'yes',
		headings: 'yes'
	});

	const url = `${OREMUS_BASE_URL}?${params}`;
	console.log(`  Fetching: ${url}`);

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Oremus API error: ${response.status} ${response.statusText}`);
	}

	return response.text();
}

/**
 * Extract scripture content from full HTML page
 */
function extractScriptureContent(html) {
	// Method 1: Look for blockquote
	if (html.includes('<blockquote>')) {
		const start = html.indexOf('<blockquote>');
		const end = html.indexOf('</blockquote>') + 13;
		if (start !== -1 && end > start) {
			return html.substring(start, end);
		}
	}

	// Method 2: Look for div.bibletext
	if (html.includes('class="bibletext"')) {
		const start = html.indexOf('<div class="bibletext"');
		const endTag = '</div>';
		let depth = 1;
		let pos = html.indexOf('>', start) + 1;
		while (depth > 0 && pos < html.length) {
			const nextOpen = html.indexOf('<div', pos);
			const nextClose = html.indexOf('</div>', pos);
			if (nextClose === -1) break;
			if (nextOpen !== -1 && nextOpen < nextClose) {
				depth++;
				pos = nextOpen + 4;
			} else {
				depth--;
				if (depth === 0) {
					return html.substring(start, nextClose + 6);
				}
				pos = nextClose + 6;
			}
		}
	}

	// Fallback: return cleaned HTML
	return html
		.replace(/<head>[\s\S]*?<\/head>/i, '')
		.replace(/<div[^>]*nav[^>]*>[\s\S]*?<\/div>/gi, '')
		.replace(/<div[^>]*footer[^>]*>[\s\S]*?<\/div>/gi, '');
}

/**
 * Current cleanGospelText implementation (from dgr-common.js)
 */
function cleanGospelTextCurrent(html) {
	if (!html) return '';

	let cleaned = html;

	// === Handle processed HTML (with classes from parseScripture) ===
	cleaned = cleaned.replace(/<h[1-6][^>]*class="scripture-heading"[^>]*>.*?<\/h[1-6]>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="verse-num[^"]*"[^>]*>.*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<sup[^>]*class="verse-num[^"]*"[^>]*>.*?<\/sup>/gi, '');
	cleaned = cleaned.replace(/<sup[^>]*class="footnote"[^>]*>.*?<\/sup>/gi, '');

	// === Handle raw oremus HTML (no classes) ===
	cleaned = cleaned.replace(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi, '');
	cleaned = cleaned.replace(/<sup[^>]*>.*?<\/sup>/gi, '');
	cleaned = cleaned.replace(/<a[^>]*onmouseover[^>]*>.*?<\/a>/gi, '');
	cleaned = cleaned.replace(/[*†‡§]/g, '');
	cleaned = cleaned.replace(/Gospel\s+Reading\s*/gi, '');
	cleaned = cleaned.replace(/\bNRSV(AE|CE|UE)?\b/gi, '');
	cleaned = cleaned.replace(/^(Mt|Mk|Lk|Jn|Matthew|Mark|Luke|John)\s+[\d:,\-–\s]+/i, '');

	// === Clean up remaining HTML ===
	cleaned = cleaned.replace(/<[^>]+>/g, ' ');
	cleaned = cleaned.replace(/&nbsp;/g, ' ');
	cleaned = cleaned.replace(/&amp;/g, '&');
	cleaned = cleaned.replace(/&lt;/g, '<');
	cleaned = cleaned.replace(/&gt;/g, '>');
	cleaned = cleaned.replace(/&quot;/g, '"');
	cleaned = cleaned.replace(/&#039;/g, "'");
	cleaned = cleaned.replace(/return\s+(nd|overlib)\(\);?/gi, '');
	cleaned = cleaned.replace(/["']\);?\s*["']?/g, '');
	cleaned = cleaned.replace(/\s*>\s*/g, ' ');

	// === Final cleanup ===
	cleaned = cleaned.replace(/([.?!])\s*\d+\s+/g, '$1 ');
	cleaned = cleaned.replace(/^\s*\d+\s+/gm, '');
	cleaned = cleaned.replace(/onmouse(over|out)=["'][^"']*["']/gi, '');
	cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
	cleaned = cleaned.replace(/\s+/g, ' ').trim();

	return cleaned;
}

/**
 * IMPROVED cleanGospelText - more aggressive numeral removal
 */
function cleanGospelTextImproved(html) {
	if (!html) return '';

	let cleaned = html;

	// === PHASE 1: Remove HTML elements that contain verse numbers ===

	// Remove all sup tags (verse numbers, footnotes)
	cleaned = cleaned.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '');

	// Remove span tags with verse-related classes
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*vnum[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*verse[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*cc[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*vv[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*ww[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');

	// Remove headings
	cleaned = cleaned.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');

	// Remove footnote anchors
	cleaned = cleaned.replace(/<a[^>]*onmouseover[^>]*>[\s\S]*?<\/a>/gi, '');
	cleaned = cleaned.replace(/<a[^>]*class="[^"]*fnote[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');

	// === PHASE 2: Strip remaining HTML tags ===
	cleaned = cleaned.replace(/<[^>]+>/g, ' ');

	// === PHASE 3: Clean entities ===
	cleaned = cleaned.replace(/&nbsp;/g, ' ');
	cleaned = cleaned.replace(/&amp;/g, '&');
	cleaned = cleaned.replace(/&lt;/g, '<');
	cleaned = cleaned.replace(/&gt;/g, '>');
	cleaned = cleaned.replace(/&quot;/g, '"');
	cleaned = cleaned.replace(/&#0?39;/g, "'");
	cleaned = cleaned.replace(/&#\d+;/g, ''); // Remove any remaining numeric entities
	cleaned = cleaned.replace(/&[a-z]+;/gi, ' '); // Remove any remaining named entities

	// === PHASE 4: Remove scripture metadata ===
	cleaned = cleaned.replace(/Gospel\s+Reading\s*/gi, '');
	cleaned = cleaned.replace(/\bNRSV(AE|CE|UE)?\b/gi, '');
	cleaned = cleaned.replace(/return\s+(nd|overlib)\([^)]*\);?/gi, '');
	cleaned = cleaned.replace(/[*†‡§¶]/g, '');

	// === PHASE 5: Remove verse numbers (the critical part) ===

	// Remove scripture reference at start (e.g., "Matthew 5:1-12")
	cleaned = cleaned.replace(/^\s*(Matthew|Mark|Luke|John|Mt|Mk|Lk|Jn)\s+[\d:,\-–\s]+/i, '');

	// Remove leading verse numbers at start of text (e.g., "29 Then he told them...")
	cleaned = cleaned.replace(/^\s*\d+\s+/gm, '');

	// Remove verse numbers after sentence endings (e.g., "heaven. 30 Look at")
	cleaned = cleaned.replace(/([.!?;:]['"]?)\s*\d+\s+/g, '$1 ');

	// Remove verse numbers after closing quotes followed by punctuation
	cleaned = cleaned.replace(/(["']\s*[.!?])\s*\d+\s+/g, '$1 ');

	// Remove standalone numbers that look like verse numbers (1-3 digits surrounded by spaces)
	// But be careful not to remove numbers that are part of the text
	cleaned = cleaned.replace(/\s+\d{1,3}\s+(?=[A-Z])/g, ' '); // Number before capital letter

	// Remove numbers at the very beginning after cleanup
	cleaned = cleaned.replace(/^\d+\s+/, '');

	// === PHASE 6: Final whitespace cleanup ===
	cleaned = cleaned.replace(/\s+/g, ' ').trim();

	return cleaned;
}

/**
 * Detect numerals in text and return details
 */
function detectNumerals(text) {
	const issues = [];

	// Find all sequences of digits
	const matches = [...text.matchAll(/\d+/g)];

	for (const match of matches) {
		const index = match.index;
		const number = match[0];
		const context = text.substring(Math.max(0, index - 20), Math.min(text.length, index + number.length + 20));

		// Check if this looks like a verse number vs legitimate text number
		const beforeChar = index > 0 ? text[index - 1] : '';
		const afterChar = index + number.length < text.length ? text[index + number.length] : '';

		// Likely verse number patterns:
		// - At start of text
		// - After punctuation and space
		// - Before capital letter
		// - Standalone (surrounded by spaces)
		const likelyVerseNumber =
			index === 0 ||
			/[.!?;:]\s*$/.test(text.substring(0, index)) ||
			/^\s*[A-Z]/.test(text.substring(index + number.length)) ||
			(beforeChar === ' ' && afterChar === ' ');

		issues.push({
			number,
			index,
			context: `...${context}...`,
			likelyVerseNumber
		});
	}

	return issues;
}

/**
 * Format text for better visual display
 */
function formatForDisplay(text) {
	if (!text) return '';

	let formatted = text;

	// Add paragraph breaks at natural points
	// After multiple sentences (look for 2+ sentence endings)
	formatted = formatted.replace(/([.!?]["']?)\s+([A-Z])/g, '$1\n\n$2');

	// Format quotations - indent direct speech
	formatted = formatted.replace(/\n\n(["'][^"']+["'][.!?]?)/g, '\n\n  $1');

	// Add line break before "Jesus said" type phrases
	formatted = formatted.replace(/\s+(Jesus|He|She|They)\s+(said|answered|replied|asked)/g, '\n\n$1 $2');

	return formatted;
}

/**
 * Test a single scripture reference
 */
async function testReference(ref) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`Testing: ${ref}`);
	console.log('='.repeat(60));

	try {
		// Fetch from Oremus
		const rawHtml = await fetchFromOremus(ref);
		const extractedHtml = extractScriptureContent(rawHtml);

		console.log(`\n  Raw HTML length: ${rawHtml.length}`);
		console.log(`  Extracted HTML length: ${extractedHtml.length}`);

		// Test current cleaner
		const currentResult = cleanGospelTextCurrent(extractedHtml);
		const currentNumerals = detectNumerals(currentResult);

		console.log(`\n  CURRENT CLEANER:`);
		console.log(`  Text length: ${currentResult.length}`);
		console.log(`  Numerals found: ${currentNumerals.length}`);

		if (currentNumerals.length > 0) {
			console.log(`  Numeral locations:`);
			for (const issue of currentNumerals.slice(0, 5)) {
				const marker = issue.likelyVerseNumber ? '[VERSE?]' : '[TEXT?]';
				console.log(`    ${marker} "${issue.number}" in: ${issue.context}`);
			}
			if (currentNumerals.length > 5) {
				console.log(`    ... and ${currentNumerals.length - 5} more`);
			}
		}

		// Test improved cleaner
		const improvedResult = cleanGospelTextImproved(extractedHtml);
		const improvedNumerals = detectNumerals(improvedResult);

		console.log(`\n  IMPROVED CLEANER:`);
		console.log(`  Text length: ${improvedResult.length}`);
		console.log(`  Numerals found: ${improvedNumerals.length}`);

		if (improvedNumerals.length > 0) {
			console.log(`  Numeral locations:`);
			for (const issue of improvedNumerals.slice(0, 5)) {
				const marker = issue.likelyVerseNumber ? '[VERSE?]' : '[TEXT?]';
				console.log(`    ${marker} "${issue.number}" in: ${issue.context}`);
			}
		}

		// Show sample of cleaned text
		console.log(`\n  CLEANED TEXT PREVIEW (first 300 chars):`);
		console.log(`  "${improvedResult.substring(0, 300)}..."`);

		// Show formatted version
		const formatted = formatForDisplay(improvedResult);
		console.log(`\n  FORMATTED FOR DISPLAY:`);
		console.log(formatted.substring(0, 500));

		return {
			ref,
			success: true,
			currentNumerals: currentNumerals.length,
			improvedNumerals: improvedNumerals.length,
			currentText: currentResult,
			improvedText: improvedResult
		};
	} catch (error) {
		console.log(`  ERROR: ${error.message}`);
		return {
			ref,
			success: false,
			error: error.message
		};
	}
}

/**
 * Fetch references from DGR schedule database
 */
async function getRefsFromDatabase(limit = 10) {
	const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
	const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseKey) {
		console.error('Missing Supabase credentials in environment');
		return [];
	}

	const supabase = createClient(supabaseUrl, supabaseKey);

	const { data, error } = await supabase
		.from('dgr_schedule')
		.select('gospel_reference')
		.not('gospel_reference', 'is', null)
		.neq('gospel_reference', '')
		.order('date', { ascending: false })
		.limit(limit);

	if (error) {
		console.error('Database error:', error.message);
		return [];
	}

	return data.map(row => row.gospel_reference);
}

/**
 * Main function
 */
async function main() {
	const args = process.argv.slice(2);

	let refs = [];

	if (args.includes('--from-db')) {
		console.log('Fetching scripture references from DGR schedule...\n');
		refs = await getRefsFromDatabase(10);
		if (refs.length === 0) {
			console.log('No references found in database, using samples');
			refs = SAMPLE_REFS;
		}
	} else if (args.length > 0 && !args[0].startsWith('--')) {
		refs = [args.join(' ')];
	} else {
		refs = SAMPLE_REFS;
	}

	console.log(`Testing ${refs.length} scripture reference(s)...\n`);

	const results = [];
	for (const ref of refs) {
		const result = await testReference(ref);
		results.push(result);
		// Small delay to be nice to the API
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	// Summary
	console.log(`\n${'='.repeat(60)}`);
	console.log('SUMMARY');
	console.log('='.repeat(60));

	const successful = results.filter(r => r.success);
	const failed = results.filter(r => !r.success);

	console.log(`\nSuccessful: ${successful.length}/${results.length}`);

	if (successful.length > 0) {
		const currentTotal = successful.reduce((sum, r) => sum + r.currentNumerals, 0);
		const improvedTotal = successful.reduce((sum, r) => sum + r.improvedNumerals, 0);

		console.log(`\nCurrent cleaner - Total numerals found: ${currentTotal}`);
		console.log(`Improved cleaner - Total numerals found: ${improvedTotal}`);
		console.log(`Improvement: ${currentTotal - improvedTotal} fewer numerals`);

		if (improvedTotal > 0) {
			console.log(`\nReferences still containing numerals:`);
			for (const r of successful.filter(r => r.improvedNumerals > 0)) {
				console.log(`  - ${r.ref}: ${r.improvedNumerals} numerals`);
			}
		}
	}

	if (failed.length > 0) {
		console.log(`\nFailed references:`);
		for (const r of failed) {
			console.log(`  - ${r.ref}: ${r.error}`);
		}
	}
}

main().catch(console.error);
