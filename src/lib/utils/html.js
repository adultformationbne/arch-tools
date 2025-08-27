// HTML entity decoding utilities

/**
 * Decode common HTML entities to their proper characters
 * @param {string} text - Text containing HTML entities
 * @returns {string} - Decoded text
 */
export function decodeHtmlEntities(text) {
	if (!text || typeof text !== 'string') return text;

	// Debug logging
	if (text.includes('&#x2010;')) {
		console.log('decodeHtmlEntities - Input:', text);
	}

	const result = text
		// Common numeric entities (hex)
		.replace(/&#x2010;/g, '‐') // non-breaking hyphen
		.replace(/&#x2013;/g, '–') // en dash
		.replace(/&#x2014;/g, '—') // em dash
		.replace(/&#x00A0;/g, ' ') // non-breaking space
		.replace(/&#x0026;/g, '&') // ampersand
		// Common numeric entities (decimal)
		.replace(/&#8208;/g, '‐') // hyphen
		.replace(/&#8211;/g, '–') // en dash
		.replace(/&#8212;/g, '—') // em dash
		.replace(/&#8216;/g, '\u2018') // left single quote
		.replace(/&#8217;/g, '\u2019') // right single quote
		.replace(/&#8220;/g, '"') // left double quote
		.replace(/&#8221;/g, '"') // right double quote
		.replace(/&#8230;/g, '…') // ellipsis
		// Common named entities
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, ' ')
		// Special characters
		.replace(/&mdash;/g, '—')
		.replace(/&ndash;/g, '–')
		.replace(/&hellip;/g, '…')
		.replace(/&lsquo;/g, '\u2018')
		.replace(/&rsquo;/g, '\u2019')
		.replace(/&ldquo;/g, '\u201c')
		.replace(/&rdquo;/g, '\u201d');

	// Debug logging
	if (text.includes('&#x2010;')) {
		console.log('decodeHtmlEntities - Output:', result);
	}

	return result;
}

// Test the function immediately
const testInput = 'Matthew 23:23&#x2010;26';
const testOutput = decodeHtmlEntities(testInput);
console.log('HTML Entities Test:');
console.log('Input:', testInput);
console.log('Output:', testOutput);
console.log('Contains entity?', testOutput.includes('&#x2010;'));
