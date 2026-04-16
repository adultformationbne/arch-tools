import { marked } from 'marked';

// DOMPurify requires a real DOM — lazy-load it only in the browser.
// The top-level import crashes Node.js during SSR (no logs, instant 500).
let purify: ((html: string, config?: object) => string) | null = null;

if (typeof window !== 'undefined') {
	import('dompurify').then(({ default: DOMPurify }) => {
		purify = (html, config) => DOMPurify.sanitize(html, config) as string;
	});
}

const ALLOWED: object = {
	ALLOWED_TAGS: ['p', 'strong', 'em', 'b', 'i', 'br', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'blockquote'],
	ALLOWED_ATTR: ['href', 'target', 'rel']
};

/**
 * Render markdown text to sanitized HTML.
 * Safe to use with {@html} — DOMPurify only runs in the browser.
 * Returns plain text on server (SSR).
 */
export function renderMarkdown(text: string | null | undefined): string {
	if (!text) return '';
	if (typeof window === 'undefined' || !purify) return text;

	try {
		const html = marked.parse(text, { async: false }) as string;
		return purify(html, ALLOWED);
	} catch {
		return text;
	}
}
