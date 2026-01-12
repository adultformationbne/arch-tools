// Common DGR utilities to eliminate DRY violations

/**
 * Format date for display in DGR format
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date like "Monday, 15 September 2025"
 */
export function formatDGRDate(date) {
	const dateObj = date instanceof Date ? date : new Date(date);
	return dateObj.toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Format reflection text into HTML paragraphs
 * @param {string} text - Raw text to format
 * @returns {string} HTML formatted text
 */
export function formatReflectionText(text) {
	if (!text) return '';

	return text
		.split('\n\n')
		.filter(p => p.trim())
		.map(paragraph => {
			const content = paragraph.trim().replace(/\n/g, '<br>');
			return content ? `<p style="margin:0 0 18px 0;">${content}</p>` : '';
		})
		.filter(p => p)
		.join('');
}

/**
 * Get initial form data structure
 * @returns {Object} Empty form data
 */
export function getInitialDGRFormData() {
	const today = new Date().toISOString().split('T')[0];
	return {
		date: today,
		title: '',
		liturgicalDate: '',
		readings: '',
		gospelQuote: '',
		reflectionText: '',
		authorName: ''
	};
}

/**
 * Clean gospel text by removing scripture headings, verse numbers, and footnotes
 * Works with both processed HTML (with classes) and raw oremus HTML
 * @param {string} html - Raw gospel HTML
 * @returns {string} Cleaned plain text
 */
export function cleanGospelText(html) {
	if (!html) return '';

	let cleaned = html;

	// === PHASE 1: Remove HTML elements that contain verse numbers ===

	// Remove HTML comments and their remnants
	cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
	cleaned = cleaned.replace(/-->/g, '');

	// Remove all sup tags (verse numbers, footnotes)
	cleaned = cleaned.replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '');

	// Remove span tags with verse-related classes (oremus uses various class patterns)
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*vnum[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*verse[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*cc[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*vv[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');
	cleaned = cleaned.replace(/<span[^>]*class="[^"]*ww[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '');

	// Remove headings (h1-h6)
	cleaned = cleaned.replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, '');

	// Remove footnote anchors
	cleaned = cleaned.replace(/<a[^>]*onmouseover[^>]*>[\s\S]*?<\/a>/gi, '');
	cleaned = cleaned.replace(/<a[^>]*class="[^"]*fnote[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '');

	// === PHASE 2: Strip remaining HTML tags ===
	cleaned = cleaned.replace(/<[^>]+>/g, ' ');

	// === PHASE 3: Decode HTML entities ===
	// Curly quotes (Windows-1252 encoded)
	cleaned = cleaned.replace(/&#145;/g, '\u2018'); // Left single quote
	cleaned = cleaned.replace(/&#146;/g, '\u2019'); // Right single quote (apostrophe)
	cleaned = cleaned.replace(/&#147;/g, '\u201C'); // Left double quote
	cleaned = cleaned.replace(/&#148;/g, '\u201D'); // Right double quote
	cleaned = cleaned.replace(/&#151;/g, '\u2014'); // Em dash
	// Standard entities
	cleaned = cleaned.replace(/&nbsp;/g, ' ');
	cleaned = cleaned.replace(/&amp;/g, '&');
	cleaned = cleaned.replace(/&lt;/g, '<');
	cleaned = cleaned.replace(/&gt;/g, '>');
	cleaned = cleaned.replace(/&quot;/g, '"');
	cleaned = cleaned.replace(/&#0?39;/g, "'");
	cleaned = cleaned.replace(/&lsquo;/g, '\u2018');
	cleaned = cleaned.replace(/&rsquo;/g, '\u2019');
	cleaned = cleaned.replace(/&ldquo;/g, '\u201C');
	cleaned = cleaned.replace(/&rdquo;/g, '\u201D');
	cleaned = cleaned.replace(/&mdash;/g, '\u2014');
	cleaned = cleaned.replace(/&ndash;/g, '\u2013');
	// Remove any remaining numeric entities
	cleaned = cleaned.replace(/&#\d+;/g, '');

	// === PHASE 4: Remove scripture metadata ===
	cleaned = cleaned.replace(/Gospel\s+Reading\s*/gi, '');
	cleaned = cleaned.replace(/\bNRSV(AE|CE|UE)?\b/gi, '');
	cleaned = cleaned.replace(/return\s+(nd|overlib)\([^)]*\);?/gi, '');
	cleaned = cleaned.replace(/[*†‡§¶]/g, '');

	// === PHASE 5: Remove verse numbers ===
	// Remove scripture reference at start (e.g., "Matthew 5:1-12")
	cleaned = cleaned.replace(/^\s*(Matthew|Mark|Luke|John|Mt|Mk|Lk|Jn)\s+[\d:,\-–\s]+/i, '');
	// Remove leading verse numbers at start of text (e.g., "29 Then he told them...")
	cleaned = cleaned.replace(/^\s*\d+\s+/gm, '');
	// Remove verse numbers after sentence endings (e.g., "heaven. 30 Look at")
	cleaned = cleaned.replace(/([.!?;:]['"]?)\s*\d+\s+/g, '$1 ');
	// Remove verse numbers after closing quotes followed by punctuation
	cleaned = cleaned.replace(/(["']\s*[.!?])\s*\d+\s+/g, '$1 ');
	// Remove standalone numbers before capital letters (likely verse numbers)
	cleaned = cleaned.replace(/\s+\d{1,3}\s+(?=[A-Z])/g, ' ');
	// Remove numbers at the very beginning after cleanup
	cleaned = cleaned.replace(/^\d+\s+/, '');

	// === PHASE 6: Final whitespace cleanup ===
	cleaned = cleaned.replace(/\s+/g, ' ').trim();

	return cleaned;
}

/**
 * Format gospel text for better visual display
 * Returns the cleaned text - formatting options can be applied separately
 * @param {string} text - Cleaned plain text
 * @param {Object} options - Formatting options
 * @param {boolean} options.addLineBreaks - Add line breaks after sentences (default: false)
 * @returns {string} Formatted text
 */
export function formatGospelForDisplay(text, options = {}) {
	if (!text) return '';

	let formatted = text;

	if (options.addLineBreaks) {
		// Add line breaks after sentences - use sparingly
		formatted = formatted.replace(/([.!?]["']?)\s+/g, '$1\n\n');
		formatted = formatted.replace(/\n{3,}/g, '\n\n');
	}

	return formatted.trim();
}

/**
 * Format gospel text as HTML for email/display
 * @param {string} text - Cleaned plain text
 * @param {Object} options - Formatting options
 * @param {string} options.wrapper - Wrapper element ('p', 'div', 'span', 'none')
 * @param {string} options.style - Inline CSS style
 * @returns {string} HTML formatted text
 */
export function formatGospelAsHtml(text, options = {}) {
	if (!text) return '';

	const { wrapper = 'p', style = 'line-height: 1.7;' } = options;

	if (wrapper === 'none') {
		return text;
	}

	return `<${wrapper} style="${style}">${text}</${wrapper}>`;
}

/**
 * Expand abbreviated gospel references to full names
 * @param {string} ref - Gospel reference (e.g., "Mt 18:12-14")
 * @returns {string} Expanded reference (e.g., "Matthew 18:12-14")
 */
export function expandGospelReference(ref) {
	if (!ref) return '';
	return ref
		.replace(/^Mt\s+/i, 'Matthew ')
		.replace(/^Mk\s+/i, 'Mark ')
		.replace(/^Lk\s+/i, 'Luke ')
		.replace(/^Jn\s+/i, 'John ');
}

/**
 * Escape HTML for safe rendering
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
	if (!text) return '';
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}