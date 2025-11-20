/**
 * MJML Email Compiler
 *
 * Compiles MJML templates to production-ready HTML emails.
 * Handles variable substitution and Outlook compatibility automatically.
 */

import mjml2html from 'mjml';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load MJML template from file
 * @param {string} templateName - Template filename (e.g., 'course-email')
 * @returns {string} MJML template content
 */
export function loadMjmlTemplate(templateName) {
	const templatePath = join(__dirname, 'templates', `${templateName}.mjml`);
	return readFileSync(templatePath, 'utf-8');
}

/**
 * Replace variables in template
 * @param {string} template - MJML template string
 * @param {Object} variables - Key-value pairs for variable substitution
 * @returns {string} Template with variables replaced
 */
export function replaceVariables(template, variables) {
	let result = template;

	// Replace all {{variable}} syntax
	Object.keys(variables).forEach((key) => {
		const value = variables[key] || '';
		const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
		result = result.replace(regex, value);
	});

	// Handle conditional blocks {{#if variable}}...{{/if}}
	// Simple implementation - if variable is truthy, show content
	result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, varName, content) => {
		return variables[varName] ? content : '';
	});

	return result;
}

/**
 * Compile MJML to HTML
 * @param {string} mjmlString - MJML template string
 * @param {Object} options - MJML compilation options
 * @returns {Object} { html, errors }
 */
export function compileMjml(mjmlString, options = {}) {
	const defaultOptions = {
		minify: false, // Set to true for production
		validationLevel: 'soft',
		keepComments: false,
		...options
	};

	try {
		const result = mjml2html(mjmlString, defaultOptions);

		if (result.errors && result.errors.length > 0) {
			console.warn('MJML Compilation Warnings:', result.errors);
		}

		return {
			html: result.html,
			errors: result.errors || []
		};
	} catch (error) {
		console.error('MJML Compilation Error:', error);
		throw new Error(`Failed to compile MJML: ${error.message}`);
	}
}

/**
 * Convert TipTap HTML elements to MJML components
 * @param {string} html - HTML content from TipTap
 * @param {string} accentDark - Accent color for buttons
 * @returns {string} HTML with MJML-compatible elements
 */
function convertToMjmlComponents(html, accentDark) {
	if (!html) return '';

	let result = html;

	// Convert email buttons to MJML buttons
	// Match: <div data-type="email-button" data-text="..." data-href="..."><a href="..." class="email-button">...</a></div>
	result = result.replace(
		/<div[^>]*data-type="email-button"[^>]*data-text="([^"]*)"[^>]*data-href="([^"]*)"[^>]*>[\s\S]*?<\/div>/g,
		(match, text, href) => {
			return `</mj-text><mj-button href="${href}" background-color="${accentDark}" color="#ffffff" border-radius="6px" font-size="16px" font-weight="600" padding="12px 32px">${text}</mj-button><mj-text>`;
		}
	);

	// Convert email dividers to MJML dividers
	// Match: <hr data-type="email-divider" class="email-divider" />
	result = result.replace(
		/<hr[^>]*data-type="email-divider"[^>]*\/?>/g,
		'</mj-text><mj-divider border-width="2px" border-color="#eae2d9" /><mj-text>'
	);

	return result;
}

/**
 * Generate email HTML from MJML template
 *
 * @param {Object} options
 * @param {string} options.bodyContent - HTML content for email body
 * @param {string} options.courseName - Course name
 * @param {string} [options.logoUrl] - Optional logo URL
 * @param {Object} options.colors - Course colors
 * @param {string} options.colors.accentDark - Dark accent color
 * @param {string} options.colors.accentLight - Light accent color
 * @param {string} options.colors.accentDarkest - Darkest accent color
 * @param {string} [options.previewText] - Email preview text
 * @param {string} [options.templateName='course-email'] - MJML template to use
 * @returns {string} Complete HTML email
 */
export function generateEmailFromMjml({
	bodyContent,
	courseName,
	logoUrl = null,
	colors,
	previewText = '',
	templateName = 'course-email'
}) {
	// Load MJML template
	const mjmlTemplate = loadMjmlTemplate(templateName);

	// Convert TipTap HTML elements to MJML components
	const processedBodyContent = convertToMjmlComponents(
		bodyContent || '',
		colors.accentDark || '#334642'
	);

	// Prepare variables for substitution
	const variables = {
		courseName: escapeHtml(courseName),
		logoUrl: logoUrl || '',
		bodyContent: processedBodyContent, // Already HTML, don't escape
		previewText: escapeHtml(previewText),
		accentDark: colors.accentDark || '#334642',
		accentLight: colors.accentLight || '#eae2d9',
		accentDarkest: colors.accentDarkest || '#1e2322'
	};

	// Replace variables in template
	const mjmlWithVariables = replaceVariables(mjmlTemplate, variables);

	// Compile MJML to HTML
	const { html, errors } = compileMjml(mjmlWithVariables);

	if (errors.length > 0) {
		console.warn('Email compilation had warnings:', errors);
	}

	return html;
}

/**
 * Escape HTML to prevent XSS (for text content, not HTML)
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
	if (!text) return '';

	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Default export - Main email generation function
 */
export default generateEmailFromMjml;
