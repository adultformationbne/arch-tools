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

	// === Handle processed HTML (with classes from parseScripture) ===
	// Remove scripture headings with class
	cleaned = cleaned.replace(/<h[1-6][^>]*class="scripture-heading"[^>]*>.*?<\/h[1-6]>/gi, '');
	// Remove verse numbers with spans
	cleaned = cleaned.replace(/<span[^>]*class="verse-num[^"]*"[^>]*>.*?<\/span>/gi, '');
	// Remove verse numbers with sup tags (with class)
	cleaned = cleaned.replace(/<sup[^>]*class="verse-num[^"]*"[^>]*>.*?<\/sup>/gi, '');
	// Remove footnotes with class
	cleaned = cleaned.replace(/<sup[^>]*class="footnote"[^>]*>.*?<\/sup>/gi, '');

	// === Handle raw oremus HTML (no classes) ===
	// Remove all headings (h1-h6)
	cleaned = cleaned.replace(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi, '');
	// Remove all sup tags (verse numbers)
	cleaned = cleaned.replace(/<sup[^>]*>.*?<\/sup>/gi, '');
	// Remove footnote anchor tags with onmouseover (oremus format)
	cleaned = cleaned.replace(/<a[^>]*onmouseover[^>]*>.*?<\/a>/gi, '');
	// Remove footnote markers like * or †
	cleaned = cleaned.replace(/[*†‡§]/g, '');
	// Remove "Gospel Reading" or similar headers that might be plain text
	cleaned = cleaned.replace(/Gospel\s+Reading\s*/gi, '');
	// Remove version tags like "NRSV" or "NRSVAE"
	cleaned = cleaned.replace(/\bNRSV(AE|CE|UE)?\b/gi, '');
	// Remove scripture references at start (e.g., "Mt 18:12-14")
	cleaned = cleaned.replace(/^(Mt|Mk|Lk|Jn|Matthew|Mark|Luke|John)\s+[\d:,\-–\s]+/i, '');

	// === Clean up remaining HTML ===
	// Remove remaining HTML tags but preserve content
	cleaned = cleaned.replace(/<[^>]+>/g, ' ');
	// Clean up HTML entities
	cleaned = cleaned.replace(/&nbsp;/g, ' ');
	cleaned = cleaned.replace(/&amp;/g, '&');
	cleaned = cleaned.replace(/&lt;/g, '<');
	cleaned = cleaned.replace(/&gt;/g, '>');
	cleaned = cleaned.replace(/&quot;/g, '"');
	cleaned = cleaned.replace(/&#039;/g, "'");
	// Remove JavaScript remnants from footnotes
	cleaned = cleaned.replace(/return\s+(nd|overlib)\(\);?/gi, '');
	cleaned = cleaned.replace(/["']\);?\s*["']?/g, '');
	// Remove stray angle brackets from cleaned tags
	cleaned = cleaned.replace(/\s*>\s*/g, ' ');

	// === Final cleanup ===
	// Remove inline verse numbers (e.g., "astray? 13 And" -> "astray? And")
	cleaned = cleaned.replace(/([.?!])\s*\d+\s+/g, '$1 ');
	// Remove leading verse numbers (e.g., "12 What do you think" -> "What do you think")
	cleaned = cleaned.replace(/^\s*\d+\s+/gm, '');
	// Remove any remaining onmouseover/onmouseout attributes that leaked through
	cleaned = cleaned.replace(/onmouse(over|out)=["'][^"']*["']/gi, '');
	// Clean up empty paragraphs
	cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');
	// Clean up extra whitespace
	cleaned = cleaned.replace(/\s+/g, ' ').trim();

	return cleaned;
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