/**
 * WordPress-Safe HTML Generator
 * Prevents wpautop from breaking HTML layouts
 */

/**
 * Minify HTML - Remove all unnecessary whitespace
 * This prevents WordPress from adding <br> and <p> tags
 */
export function minifyHTML(html) {
  return html
    .replace(/<!--(?!\s*wp:)[\s\S]*?-->/g, '') // Remove HTML comments (but keep WordPress-specific ones)
    .replace(/\r\n/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/>\s+</g, '><') // Remove whitespace between tags
    .trim()
    .replace(/\s\s+/g, ' ') // Collapse multiple spaces into one
    .replace(/\s*(<br\s*\/?>\s*)+/g, '<br>'); // Normalize br tags
}
