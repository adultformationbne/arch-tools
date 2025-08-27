import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Create a JSDOM window for server-side DOMPurify
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Configure allowed HTML tags and attributes for rich text content
const HTML_CONFIG = {
	ALLOWED_TAGS: [
		'p',
		'br',
		'strong',
		'b',
		'em',
		'i',
		'span',
		'ul',
		'ol',
		'li',
		'blockquote',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6'
	],
	ALLOWED_ATTR: ['class', 'data-format'],
	ALLOWED_URI_REGEXP:
		/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
};

/**
 * Sanitize HTML content while preserving rich text formatting
 */
export function sanitizeHtmlContent(content) {
	if (!content || typeof content !== 'string') {
		return '';
	}

	return purify.sanitize(content, {
		ALLOWED_TAGS: HTML_CONFIG.ALLOWED_TAGS,
		ALLOWED_ATTR: HTML_CONFIG.ALLOWED_ATTR,
		ALLOWED_URI_REGEXP: HTML_CONFIG.ALLOWED_URI_REGEXP,
		KEEP_CONTENT: true,
		RETURN_DOM: false,
		RETURN_DOM_FRAGMENT: false
	});
}

/**
 * Extract plain text from HTML content for search indexing
 */
export function extractPlainText(htmlContent) {
	if (!htmlContent || typeof htmlContent !== 'string') {
		return '';
	}

	// Create a DOM element and extract text content
	const dom = new JSDOM(htmlContent);
	const textContent = dom.window.document.body.textContent || '';

	// Clean up whitespace
	return textContent.trim().replace(/\s+/g, ' ');
}

/**
 * Validate that HTML content only contains allowed formatting
 */
export function validateHtmlContent(content) {
	const sanitized = sanitizeHtmlContent(content);
	const errors = [];

	// Basic validation - you can extend this
	if (content !== sanitized) {
		errors.push('Content contains disallowed HTML tags or attributes');
	}

	if (sanitized.length === 0 && content.length > 0) {
		errors.push('Content was completely sanitized - likely contained only invalid HTML');
	}

	return {
		isValid: errors.length === 0,
		errors,
		sanitized
	};
}

/**
 * Process block content before saving to database
 */
export function processBlockContent(rawContent) {
	// Sanitize the HTML
	const sanitized = sanitizeHtmlContent(rawContent);

	// Extract plain text for search
	const plainText = extractPlainText(sanitized);

	// Calculate content metrics
	const metrics = {
		html_length: sanitized.length,
		plain_length: plainText.length,
		word_count: plainText.split(/\s+/).filter((word) => word.length > 0).length,
		has_formatting: sanitized !== plainText,
		format_types: extractFormatTypes(sanitized)
	};

	return {
		html_content: sanitized,
		plain_content: plainText,
		metrics
	};
}

/**
 * Extract formatting types used in the content
 */
function extractFormatTypes(htmlContent) {
	const formats = new Set();

	// Check for standard formatting
	if (htmlContent.includes('<strong>') || htmlContent.includes('<b>')) {
		formats.add('bold');
	}
	if (htmlContent.includes('<em>') || htmlContent.includes('<i>')) {
		formats.add('italic');
	}

	// Check for custom formatting
	const formatMatches = htmlContent.match(/data-format="([^"]+)"/g) || [];
	formatMatches.forEach((match) => {
		const format = match.match(/data-format="([^"]+)"/)[1];
		formats.add(format);
	});

	return Array.from(formats);
}

/**
 * Convert legacy plain text to HTML (if needed for migration)
 */
export function plainTextToHtml(plainText) {
	if (!plainText || typeof plainText !== 'string') {
		return '';
	}

	// Check if content already contains HTML
	if (plainText.includes('<') && plainText.includes('>')) {
		return sanitizeHtmlContent(plainText);
	}

	// Convert plain text to HTML
	return plainText
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/\n\n/g, '</p><p>')
		.replace(/\n/g, '<br>')
		.replace(/^(.*)$/, '<p>$1</p>');
}
