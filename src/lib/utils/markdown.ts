import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Render markdown text to sanitized HTML.
 * Safe to use with {@html} — DOMPurify is applied when window is available.
 * Returns plain text on server (SSR) since DOMPurify requires the DOM.
 */
export function renderMarkdown(text: string | null | undefined): string {
	if (!text) return '';

	// SSR safety: DOMPurify requires window.document
	if (typeof window === 'undefined') {
		return text;
	}

	try {
		const html = marked.parse(text, { async: false }) as string;
		return DOMPurify.sanitize(html, {
			ALLOWED_TAGS: ['p', 'strong', 'em', 'b', 'i', 'br', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'],
			ALLOWED_ATTR: ['href', 'target', 'rel']
		});
	} catch {
		return text;
	}
}
