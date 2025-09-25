/**
 * WordPress-Safe HTML Generator
 * Prevents wpautop from breaking HTML layouts
 */

/**
 * Method 1: Minify HTML - Remove all unnecessary whitespace
 * This prevents WordPress from adding <br> and <p> tags
 * IMPORTANT: This is the reverse of beautification - use after beautifying for editor
 */
export function minifyHTML(html) {
  return html
    // Remove HTML comments (but keep WordPress-specific ones)
    .replace(/<!--(?!\s*wp:)[\s\S]*?-->/g, '')
    // Remove line breaks and carriage returns
    .replace(/\r\n/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    // Remove whitespace between tags
    .replace(/>\s+</g, '><')
    // Remove whitespace at start and end
    .trim()
    // Collapse multiple spaces into one (preserve single spaces in text)
    .replace(/\s\s+/g, ' ')
    // Clean up spaces around inline elements
    .replace(/\s*(<br\s*\/?>\s*)+/g, '<br>'); // Normalize br tags
}

/**
 * Method 2: Wrap in raw HTML blocks that WordPress ignores
 */
export function wrapInRawHTML(html) {
  // WordPress doesn't process content within these HTML5 tags
  return `<div class="dgr-raw-content" data-no-wpautop="true">${html}</div>`;
}

/**
 * Method 3: Use WordPress shortcode wrapper (if shortcodes are enabled)
 */
export function wrapInShortcode(html) {
  // Escape the HTML for use in shortcode
  const escaped = html.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
  return `[raw]${escaped}[/raw]`;
}

/**
 * Method 4: Add inline styles that counteract wpautop effects
 */
export function addProtectiveStyles(html) {
  // Add styles to all block elements to prevent wpautop issues
  return html
    .replace(/<div/g, '<div style="margin:0;padding:inherit;"')
    .replace(/<p/g, '<p style="margin:0;padding:inherit;"')
    .replace(/<br\s*\/?>/g, ''); // Remove any existing br tags
}

/**
 * Method 5: Use pre-formatted block (most reliable but requires specific styling)
 */
export function wrapInPreformatted(html) {
  return `<div class="dgr-content" style="white-space:normal;font-family:inherit;font-size:inherit;">${html}</div>`;
}

/**
 * Method 6: JavaScript-based solution (renders after page load)
 */
export function generateJavaScriptRenderer(html) {
  const escaped = html
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');

  return `
<div id="dgr-content-${Date.now()}" class="dgr-placeholder"></div>
<script type="text/javascript">
(function() {
  var container = document.getElementById('dgr-content-${Date.now()}');
  if (container) {
    container.innerHTML = "${escaped}";
  }
})();
</script>`;
}

/**
 * Main function: Process HTML for WordPress compatibility
 * Uses multiple techniques for maximum compatibility
 */
export function makeWordPressSafe(html, options = {}) {
  const {
    method = 'minify', // 'minify', 'raw', 'shortcode', 'javascript', 'combined'
    preserveFormatting = false,
    removeComments = true,
    addWrapper = true
  } = options;

  let processed = html;

  // Always remove HTML comments unless specified otherwise
  if (removeComments) {
    processed = processed.replace(/<!--[\s\S]*?-->/g, '');
  }

  switch (method) {
    case 'minify':
      // Most compatible - removes all whitespace
      processed = minifyHTML(processed);
      if (addWrapper) {
        // Add a wrapper div with class for custom styling if needed
        processed = `<div class="dgr-content-wrapper">${processed}</div>`;
      }
      break;

    case 'raw':
      // Wrap in raw HTML container
      processed = wrapInRawHTML(minifyHTML(processed));
      break;

    case 'shortcode':
      // Use WordPress shortcode (requires [raw] shortcode to be registered)
      processed = wrapInShortcode(minifyHTML(processed));
      break;

    case 'javascript':
      // Render via JavaScript (most reliable but requires JS)
      processed = generateJavaScriptRenderer(minifyHTML(processed));
      break;

    case 'combined':
      // Use multiple techniques for maximum safety
      processed = minifyHTML(processed);
      // Add protective class and data attribute
      processed = `<div class="dgr-content" data-wpautop-skip="true">${processed}</div>`;
      break;

    default:
      // Just minify by default
      processed = minifyHTML(processed);
  }

  return processed;
}

/**
 * Process template for WordPress
 * This should be called on the final HTML before sending to WordPress
 */
export function processForWordPress(html) {
  // Use the most compatible method: minification
  // This removes all line breaks and extra spaces that WordPress might convert
  return makeWordPressSafe(html, {
    method: 'minify',
    removeComments: true,
    addWrapper: true
  });
}

/**
 * Add WordPress disable wpautop meta tag
 * Add this to the post meta or custom fields
 */
export function getDisableWpautopMeta() {
  return {
    '_wpautop': 'false',
    'disable_wpautop': 'true',
    'wpautop_skip': 'true'
  };
}

/**
 * CSS to add to WordPress to fix common wpautop issues
 */
export function getFixCSS() {
  return `
/* Fix WordPress wpautop issues for DGR content */
.dgr-content-wrapper br { display: none !important; }
.dgr-content-wrapper p:empty { display: none !important; }
.dgr-content-wrapper > p:first-child { margin-top: 0 !important; }
.dgr-content-wrapper > p:last-child { margin-bottom: 0 !important; }
.dgr-content br { display: none !important; }
.dgr-raw-content br { display: none !important; }

/* Ensure proper spacing without wpautop interference */
.dgr-content-wrapper div,
.dgr-content-wrapper p {
  margin: 0;
  padding: 0;
}

/* Preserve intended spacing */
.dgr-content-wrapper .spaced {
  margin-bottom: 1em;
}
`;
}