import beautify from 'js-beautify';

/**
 * Format HTML using js-beautify with consistent settings
 * @param {string} html - The HTML string to format
 * @returns {Promise<string>} - Formatted HTML
 */
export async function formatHtml(html) {
  try {
    // Use js-beautify for HTML formatting
    const formatted = beautify.html(html, {
      indent_size: 2,
      indent_char: ' ',
      max_preserve_newlines: 2,
      preserve_newlines: true,
      keep_array_indentation: false,
      break_chained_methods: false,
      indent_scripts: 'normal',
      brace_style: 'collapse',
      space_before_conditional: true,
      unescape_strings: false,
      jslint_happy: false,
      end_with_newline: true,
      wrap_line_length: 80,
      indent_inner_html: true,
      comma_first: false,
      e4x: false,
      indent_empty_lines: false,
      wrap_attributes: 'auto',
      wrap_attributes_indent_size: 2,
      unformatted: ['script'], // Don't format script tag contents
      content_unformatted: [], // Format all content
      extra_liners: ['head', 'body', '/html']
    });

    return formatted;
  } catch (error) {
    console.warn('HTML formatting failed:', error);
    return html; // Return original if formatting fails
  }
}

/**
 * Validate HTML syntax
 * @param {string} html - HTML to validate
 * @returns {boolean} - Whether HTML is valid
 */
export function validateHtml(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Check for parser errors
    const errors = doc.querySelectorAll('parsererror');
    return errors.length === 0;
  } catch (error) {
    return false;
  }
}