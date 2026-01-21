// DGR Utility functions
import bibleBooks from '$lib/data/bible-books.json';
import { formatDGRDate, formatReflectionText } from './dgr-common.js';

// Re-export common utilities
export { cleanGospelText, formatReflectionText, getInitialDGRFormData } from './dgr-common.js';

// Function to parse and expand Bible references
export function parseReadings(readingsStr) {
	if (!readingsStr) return [];

	// Split by semicolon or pipe to get individual readings
	const readings = readingsStr.split(/[;|]/).map(r => r.trim()).filter(r => r);

	// Track the previous book name for continuation references (e.g., "1 Samuel 18:6-9; 19:1-7")
	let previousBook = '';

	return readings.map(reading => {
		// Extract book abbreviation and verses
		const match = reading.match(/^((?:\d\s*)?[A-Za-z]+)\s*([\d:,\-–—\s]+)$/);

		// Check if this is just verses without a book (continuation of previous book)
		const versesOnlyMatch = reading.match(/^([\d:,\-–—\s]+)$/);

		if (versesOnlyMatch && previousBook) {
			// This is a continuation reference like "19:1-7" that should use the previous book
			return {
				original: reading,
				book: previousBook,
				verses: versesOnlyMatch[1].trim()
			};
		}

		if (!match) return { original: reading, book: reading, verses: '' };

		let [, bookAbbr, verses] = match;

		// Clean up book abbreviation (remove periods, spaces between numbers and letters)
		bookAbbr = bookAbbr.replace(/\./g, '').replace(/\s+/g, '').toLowerCase();

		// Look up full book name
		const fullName = bibleBooks[bookAbbr] || bookAbbr;

		// Store for potential continuation references
		previousBook = fullName;

		return {
			original: reading,
			book: fullName,
			verses: verses.trim()
		};
	});
}

// cleanGospelText is now imported from dgr-common.js

// New template-based DGR HTML generator
export async function generateDGRHTML(formData, options = {}) {
	const { templateKey = 'default', gospelFullText = '', gospelReference = '', promoTiles = [] } = options;

	// Format the date nicely
	const formattedDate = formatDGRDate(formData.date);

	// Prepare template data
	const templateData = {
		title: formData.title,
		date: formData.date,
		formattedDate: formattedDate,
		liturgicalDate: formData.liturgicalDate,
		readings: formData.readings,
		gospelQuote: formData.gospelQuote,
		reflectionText: formatReflectionText(formData.reflectionText),
		authorName: formData.authorName,
		gospelFullText: gospelFullText,
		gospelReference: gospelReference,
		promoTiles: promoTiles
	};

	// Call our template API
	const response = await fetch('/api/dgr-templates', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ templateKey, data: templateData })
	});

	if (!response.ok) {
		throw new Error('Failed to render template');
	}

	const result = await response.json();
	return result.html;
}

// formatReflectionText is now imported from dgr-common.js (used internally)