/**
 * Styled button for emails.
 * Pure string generation — safe to import from both client and server code.
 *
 * Outputs HTML that serves double duty:
 * 1. Renders as a styled button in browser previews ({@html} in Svelte)
 * 2. Gets converted to <mj-button> by convertToMjmlComponents() in compiler.js
 *    via the data-type="email-button" pattern
 */

export interface EmailButtonOptions {
	borderRadius?: number;
}

export function createEmailButton(
	text: string,
	url: string,
	backgroundColor = '#334642',
	options: EmailButtonOptions = {}
): string {
	const { borderRadius = 6 } = options;

	// This HTML pattern is recognized by convertToMjmlComponents() in compiler.js
	// which converts it to <mj-button> during MJML compilation.
	// The inline styles make it look right in browser previews too.
	return `<div data-type="email-button" data-text="${text}" data-href="${url}"><a href="${url}" class="email-button" style="background-color:${backgroundColor};border-radius:${borderRadius}px;color:#ffffff;display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;line-height:1;text-align:center;text-decoration:none;padding:14px 32px;margin:16px 0;">${text}</a></div>`;
}
