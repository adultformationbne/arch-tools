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
 * @param {string} html - Raw gospel HTML
 * @returns {string} Cleaned HTML
 */
export function cleanGospelText(html) {
	if (!html) return '';

	let cleaned = html;

	// Remove scripture headings
	cleaned = cleaned.replace(/<h[1-6][^>]*class="scripture-heading"[^>]*>.*?<\/h[1-6]>/gi, '');

	// Remove verse numbers with spans
	cleaned = cleaned.replace(/<span[^>]*class="verse-num[^"]*"[^>]*>.*?<\/span>/gi, '');

	// Remove verse numbers with sup tags
	cleaned = cleaned.replace(/<sup[^>]*class="verse-num[^"]*"[^>]*>.*?<\/sup>/gi, '');

	// Remove footnotes
	cleaned = cleaned.replace(/<sup[^>]*class="footnote"[^>]*>.*?<\/sup>/gi, '');

	// Clean up empty paragraphs
	cleaned = cleaned.replace(/<p[^>]*>\s*<\/p>/gi, '');

	// Clean up extra whitespace
	cleaned = cleaned.replace(/\s+/g, ' ').trim();

	return cleaned;
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