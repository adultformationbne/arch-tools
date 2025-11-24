/**
 * Email Preview Generator (Client-Side)
 *
 * ARCHITECTURE NOTE:
 * - This is a SIMPLE client-side preview for the template editor only
 * - Production emails use MJML compilation (src/lib/email/compiler.js) for:
 *   - Full Outlook compatibility (VML buttons)
 *   - Responsive design
 *   - Email client compatibility
 * - Use "Send Test Email" to see the exact MJML-compiled output
 *
 * This approach is used by most simple email tools - a basic editor preview
 * with server-side compilation for production. Full block editors (like Mailchimp)
 * are much more complex and take weeks to build.
 */

/**
 * Generate a simple preview HTML for the email template editor
 *
 * This preview is NOT pixel-perfect to the final email. It's a comfortable
 * editing experience. The real email preview comes from sending a test email.
 *
 * @param {Object} options
 * @param {string} options.bodyContent - HTML content from the editor
 * @param {string} options.courseName - Course name for header
 * @param {string} [options.logoUrl] - Optional logo URL for header
 * @param {Object} options.colors - Course color palette
 * @param {string} [options.previewText] - Optional email preview text (unused in simple preview)
 * @returns {string} Simple HTML preview for editor (NOT production-ready)
 */
export function generateEmailPreview({ bodyContent, courseName, logoUrl, colors }) {
	// Not used in simple preview - just here for API compatibility
	return bodyContent || '<p style="color: #999; font-style: italic;">Start typing...</p>';
}

/**
 * Default export
 */
export default generateEmailPreview;
