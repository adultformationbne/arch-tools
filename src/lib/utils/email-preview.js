/**
 * Email Preview Generator
 *
 * REFACTORED to use MJML templates - No more manual CSS syncing!
 * This is now a simple wrapper around the MJML compiler.
 */

import { generateEmailFromMjml } from '$lib/email/compiler.js';

/**
 * Generate preview HTML for an email template
 *
 * **SINGLE SOURCE OF TRUTH** - All emails (editor preview, test, production)
 * use this function to ensure consistent rendering.
 *
 * Now powered by MJML - automatically generates Outlook-compatible HTML
 * with responsive design and proper email client support.
 *
 * @param {Object} options
 * @param {string} options.bodyContent - HTML content from the editor
 * @param {string} options.courseName - Course name for header
 * @param {string} [options.logoUrl] - Optional logo URL for header
 * @param {Object} options.colors - Course color palette
 * @param {string} options.colors.accentDark - Dark accent color
 * @param {string} options.colors.accentLight - Light accent color
 * @param {string} options.colors.accentDarkest - Darkest accent color
 * @param {string} [options.previewText] - Optional email preview text
 * @returns {string} Complete HTML email
 */
export function generateEmailPreview({ bodyContent, courseName, logoUrl, colors, previewText }) {
	return generateEmailFromMjml({
		bodyContent: bodyContent || '<p style="color: #999; font-style: italic;">Start typing to see preview...</p>',
		courseName,
		logoUrl,
		colors: {
			accentDark: colors.accentDark || '#334642',
			accentLight: colors.accentLight || '#eae2d9',
			accentDarkest: colors.accentDarkest || '#1e2322'
		},
		previewText: previewText || `Email from ${courseName}`
	});
}

/**
 * Default export
 */
export default generateEmailPreview;
