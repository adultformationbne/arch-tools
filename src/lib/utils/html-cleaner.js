/**
 * Smart HTML Cleaner for Rich Text Paste
 * Handles: Microsoft Word, Google Docs, Apple Pages
 *
 * Analyzes font sizes in pasted content and converts them to semantic HTML:
 * - Most common font size → <p>
 * - Larger sizes → <h1>, <h2>, <h3> based on relative size
 * - Smaller sizes → <p> (or <small> if significantly smaller)
 */

/**
 * Detect the source of pasted HTML
 */
export function detectSource(html) {
	if (/mso-|MsoNormal|xmlns:w=|xmlns:o=|<o:p>/i.test(html)) {
		return 'word';
	}
	if (/docs-internal-guid|id="docs-|google-docs/i.test(html)) {
		return 'google-docs';
	}
	if (/Apple-|class="s[0-9]+"|webkit-/i.test(html)) {
		return 'pages';
	}
	return 'unknown';
}

/**
 * Check if element has bold styling (inline or computed)
 */
function isBold(el) {
	const style = el.getAttribute('style') || '';
	return /font-weight:\s*(bold|700|800|900)/i.test(style);
}

/**
 * Check if element has italic styling
 */
function isItalic(el) {
	const style = el.getAttribute('style') || '';
	return /font-style:\s*italic/i.test(style);
}

/**
 * Convert inline bold/italic styles to semantic tags
 * Google Docs and Pages use inline styles instead of <strong>/<em>
 */
function convertInlineStylesToTags(container) {
	// Process spans with font-weight: bold → wrap content in <strong>
	Array.from(container.querySelectorAll('span, p, div')).forEach(el => {
		const hasBold = isBold(el);
		const hasItalic = isItalic(el);

		if (hasBold || hasItalic) {
			// Only wrap if this element itself has the style (not inherited)
			const text = el.textContent.trim();
			if (text && el.children.length === 0) {
				// Leaf node with text - wrap appropriately
				let content = document.createTextNode(text);

				if (hasItalic) {
					const em = document.createElement('em');
					em.appendChild(content);
					content = em;
				}

				if (hasBold) {
					const strong = document.createElement('strong');
					strong.appendChild(content);
					content = strong;
				}

				// Replace element's content
				el.innerHTML = '';
				el.appendChild(content);
			}
		}
	});
}

/**
 * Extract font size from a style string (handles pt, px, em, rem)
 * Supports both font-size: and font: shorthand
 * Returns size normalized to points
 */
export function extractFontSize(styleStr) {
	if (!styleStr) return null;

	// Try font-size: first
	let match = styleStr.match(/font-size:\s*([\d.]+)(pt|px|em|rem)/i);

	// Try font: shorthand (e.g., "font: 15.0px 'Helvetica Neue'")
	if (!match) {
		match = styleStr.match(/font:\s*([\d.]+)(pt|px)/i);
	}

	if (!match) return null;

	const size = parseFloat(match[1]);
	const unit = match[2].toLowerCase();

	// Normalize to points
	switch (unit) {
		case 'pt': return size;
		case 'px': return size * 0.75; // 1px ≈ 0.75pt
		case 'em': return size * 12;   // Assume 1em = 12pt base
		case 'rem': return size * 12;
		default: return size;
	}
}

/**
 * Parse CSS from <style> blocks and build a class-to-size map
 * For Pages which uses classes like p.p1 { font: 15.0px ... }
 */
function parseStyleBlock(html) {
	const classToSize = new Map();

	// Extract all <style> content
	const styleMatches = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);

	for (const styleMatch of styleMatches) {
		const css = styleMatch[1];

		// Match class rules like: p.p1 { font: 15.0px ... } or .myClass { font-size: 14pt }
		const ruleMatches = css.matchAll(/([.a-z0-9_-]+)\s*\{([^}]+)\}/gi);

		for (const ruleMatch of ruleMatches) {
			const selector = ruleMatch[1];
			const rules = ruleMatch[2];

			const size = extractFontSize(rules);
			if (size !== null) {
				// Extract class name from selector (e.g., "p.p1" -> "p1", ".myClass" -> "myClass")
				const classMatch = selector.match(/\.([a-z0-9_-]+)/i);
				if (classMatch) {
					classToSize.set(classMatch[1], size);
				}
			}
		}
	}

	return classToSize;
}

/**
 * Analyze font sizes in HTML and build a frequency map
 * Returns { sizes: Map<size, count>, mostCommon: number, sorted: number[] }
 */
export function analyzeFontSizes(html) {
	const temp = document.createElement('div');
	temp.innerHTML = html;

	const sizeMap = new Map();

	// First: Parse <style> blocks (for Pages)
	const classToSize = parseStyleBlock(html);

	// Check all elements - look for inline styles OR class-based sizes
	temp.querySelectorAll('*').forEach(el => {
		if (!el.textContent.trim()) return;

		let size = null;

		// Try inline style first
		const style = el.getAttribute('style') || '';
		size = extractFontSize(style);

		// Try class-based size (for Pages)
		if (size === null && el.className) {
			const classes = el.className.split(/\s+/);
			for (const cls of classes) {
				if (classToSize.has(cls)) {
					size = classToSize.get(cls);
					break;
				}
			}
		}

		if (size !== null) {
			const textLength = el.textContent.trim().length;
			const currentCount = sizeMap.get(size) || 0;
			sizeMap.set(size, currentCount + textLength);
		}
	});

	// If no sizes found at all, use default
	const defaultSize = 12;
	if (sizeMap.size === 0) {
		sizeMap.set(defaultSize, 1);
	}

	// Find most common (by weighted text length)
	let mostCommon = defaultSize;
	let maxCount = 0;
	sizeMap.forEach((count, size) => {
		if (count > maxCount) {
			maxCount = count;
			mostCommon = size;
		}
	});

	// Get sorted unique sizes (descending)
	const sorted = Array.from(sizeMap.keys()).sort((a, b) => b - a);

	return { sizes: sizeMap, mostCommon, sorted, classToSize };
}

/**
 * Build a mapping from font sizes to HTML tags
 * Based on the most common size being <p>
 */
export function buildTagMapping(analysis) {
	const { mostCommon, sorted } = analysis;
	const mapping = new Map();

	// Sizes larger than mostCommon become headings
	const largerSizes = sorted.filter(s => s > mostCommon);

	// Assign h1, h2, h3 to the largest sizes (up to 3 levels)
	// h1 = largest, h2 = second largest, h3 = third largest
	largerSizes.forEach((size, index) => {
		if (index === 0) mapping.set(size, 'h1');
		else if (index === 1) mapping.set(size, 'h2');
		else if (index === 2) mapping.set(size, 'h3');
		else mapping.set(size, 'h3'); // Cap at h3 for smaller large sizes
	});

	// Most common and smaller = paragraph
	sorted.filter(s => s <= mostCommon).forEach(size => {
		mapping.set(size, 'p');
	});

	return mapping;
}

/**
 * Clean pasted HTML with smart font-size to heading conversion
 * Handles: Microsoft Word, Google Docs, Apple Pages
 * Returns ONLY semantic HTML with NO inline styles
 */
export function cleanWordHtml(html, options = {}) {
	const { debug = false } = options;

	const source = detectSource(html);
	if (debug) console.log(`🧹 Smart HTML Cleaner starting... (detected: ${source})`);

	// STEP 1: Remove app-specific garbage (comments, XML, etc.)
	html = html
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<\?xml[\s\S]*?\?>/g, '')
		.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

	// Word-specific cleanup
	if (source === 'word') {
		html = html
			.replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
			.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '')
			.replace(/mso-[^;:"']+:[^;:"']+;?/gi, '')
			.replace(/class="[^"]*Mso[^"]*"/gi, '');
	}

	// Google Docs-specific cleanup
	if (source === 'google-docs') {
		html = html
			.replace(/id="docs-internal-guid-[^"]*"/gi, '')
			.replace(/dir="ltr"/gi, '')
			.replace(/role="presentation"/gi, '');
	}

	// Apple Pages-specific cleanup
	if (source === 'pages') {
		html = html
			.replace(/class="[^"]*Apple-[^"]*"/gi, '')
			.replace(/-webkit-[^;:"']+:[^;:"']+;?/gi, '');
	}

	// STEP 2: Analyze font sizes
	const analysis = analyzeFontSizes(html);
	const tagMapping = buildTagMapping(analysis);

	if (debug) {
		console.log('📊 Font size analysis:', {
			mostCommon: analysis.mostCommon + 'pt',
			allSizes: analysis.sorted.map(s => s + 'pt'),
			mapping: Object.fromEntries(
				Array.from(tagMapping.entries()).map(([size, tag]) => [size + 'pt', tag])
			),
			classToSize: analysis.classToSize?.size > 0
				? Object.fromEntries(Array.from(analysis.classToSize.entries()).map(([cls, size]) => [cls, size + 'pt']))
				: '(none - using inline styles)'
		});
	}

	// STEP 3: Parse into DOM
	const temp = document.createElement('div');
	temp.innerHTML = html;

	// STEP 4: Remove Word-specific elements
	temp.querySelectorAll('meta, link, style, script, xml, title').forEach(el => el.remove());

	// Remove ALL namespaced elements aggressively
	Array.from(temp.querySelectorAll('*')).forEach(el => {
		if (el.tagName.includes(':')) el.remove();
	});

	// STEP 5: Convert inline bold/italic styles to <strong>/<em> tags
	// (Google Docs and Pages use inline styles instead of semantic tags)
	convertInlineStylesToTags(temp);

	// STEP 6: Convert font sizes to semantic heading tags
	// IMPORTANT: Only convert elements that don't contain block-level children
	const blockTags = ['P', 'DIV', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'TABLE'];

	// Get class-to-size map for Pages support
	const { classToSize } = analysis;

	// Find elements with style OR class-based sizes
	const elementsToCheck = Array.from(temp.querySelectorAll('[style], [class]'));
	elementsToCheck.sort((a, b) => getDepth(b) - getDepth(a));

	elementsToCheck.forEach(el => {
		let size = null;

		// Try inline style first
		const style = el.getAttribute('style') || '';
		size = extractFontSize(style);

		// Try class-based size (for Pages)
		if (size === null && el.className && classToSize) {
			const classes = (el.className || '').split(/\s+/);
			for (const cls of classes) {
				if (classToSize.has(cls)) {
					size = classToSize.get(cls);
					break;
				}
			}
		}

		if (size !== null) {
			const targetTag = tagMapping.get(size) || findClosestMapping(size, tagMapping);

			// Check if element contains block-level children - if so, don't convert to heading
			const hasBlockChildren = Array.from(el.children).some(child =>
				blockTags.includes(child.tagName)
			);

			if (hasBlockChildren) {
				if (debug) {
					console.log(`⚠️ Skipping ${size}pt - contains block children`);
				}
				return; // Skip - can't make this a heading
			}

			if (targetTag && targetTag !== 'p' && el.textContent.trim()) {
				if (debug) {
					console.log(`📏 ${size}pt → <${targetTag}>: "${el.textContent.trim().substring(0, 40)}..."`);
				}

				const newEl = document.createElement(targetTag);
				newEl.textContent = el.textContent.trim();

				// Only replace parent paragraph if it ONLY contains this element
				// (don't lose other content in mixed paragraphs)
				if (el.parentElement?.tagName === 'P') {
					const parentText = el.parentElement.textContent.trim();
					const elText = el.textContent.trim();
					if (parentText === elText) {
						// Parent only contains this element - safe to replace
						el.parentElement.replaceWith(newEl);
					} else {
						// Parent has other content - just replace the element
						el.replaceWith(newEl);
					}
				} else {
					el.replaceWith(newEl);
				}
			}
		}
	});

	// STEP 6: Aggressively unwrap ALL spans (run multiple passes)
	for (let pass = 0; pass < 3; pass++) {
		Array.from(temp.querySelectorAll('span, font')).forEach(el => {
			el.replaceWith(...el.childNodes);
		});
	}

	// STEP 7: Strip ALL attributes from ALL elements
	Array.from(temp.querySelectorAll('*')).forEach(el => {
		while (el.attributes.length > 0) {
			el.removeAttribute(el.attributes[0].name);
		}
	});

	// STEP 8: Clean disallowed tags
	const allowedTags = ['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'BR'];

	Array.from(temp.querySelectorAll('*')).forEach(el => {
		if (!allowedTags.includes(el.tagName)) {
			if (el.tagName === 'DIV') {
				const p = document.createElement('p');
				p.innerHTML = el.innerHTML;
				el.replaceWith(p);
			} else {
				el.replaceWith(...el.childNodes);
			}
			return;
		}

		// Normalize B→STRONG, I→EM
		if (el.tagName === 'B') {
			const strong = document.createElement('strong');
			strong.innerHTML = el.innerHTML;
			el.replaceWith(strong);
		} else if (el.tagName === 'I') {
			const em = document.createElement('em');
			em.innerHTML = el.innerHTML;
			el.replaceWith(em);
		}
	});

	// STEP 9: Remove empty elements (including empty strong/em)
	for (let pass = 0; pass < 2; pass++) {
		temp.querySelectorAll('p, h1, h2, h3, li, strong, em, b, i').forEach(el => {
			if (!el.textContent.trim()) el.remove();
		});
	}

	// STEP 10: Merge consecutive lists
	mergeConsecutiveLists(temp);

	// STEP 11: Fix invalid nesting - block elements can't be inside headings or inline elements

	// First: Unwrap any headings that contain block elements (invalid HTML)
	Array.from(temp.querySelectorAll('h1, h2, h3')).forEach(heading => {
		const hasBlockChildren = heading.querySelector('p, ul, ol, li, div, blockquote, table');
		if (hasBlockChildren) {
			heading.replaceWith(...heading.childNodes);
		}
	});

	// Unwrap strong/em/b/i tags that contain block elements (invalid HTML)
	Array.from(temp.querySelectorAll('strong, em, b, i')).forEach(inline => {
		const hasBlockChildren = inline.querySelector('p, ul, ol, li, div, h1, h2, h3, blockquote, table, br');
		if (hasBlockChildren) {
			inline.replaceWith(...inline.childNodes);
		}
	});

	// Move headings out of strong/em tags
	Array.from(temp.querySelectorAll('strong h1, strong h2, strong h3, em h1, em h2, em h3, b h1, b h2, b h3, i h1, i h2, i h3')).forEach(heading => {
		const parent = heading.parentElement;
		if (parent) {
			parent.parentElement?.insertBefore(heading, parent);
			if (!parent.textContent.trim()) parent.remove();
		}
	});

	// Simplify list items: remove <p> inside <li> (redundant)
	Array.from(temp.querySelectorAll('li > p:only-child')).forEach(p => {
		p.replaceWith(...p.childNodes);
	});

	// Fix headings inside paragraphs - invalid HTML
	Array.from(temp.querySelectorAll('p')).forEach(p => {
		const headings = p.querySelectorAll('h1, h2, h3');
		if (headings.length > 0) {
			// Split paragraph around headings
			const fragment = document.createDocumentFragment();
			let currentP = null;

			Array.from(p.childNodes).forEach(node => {
				if (node.nodeType === Node.ELEMENT_NODE && ['H1', 'H2', 'H3'].includes(node.tagName)) {
					// Close current paragraph, add heading
					if (currentP && currentP.textContent.trim()) {
						fragment.appendChild(currentP);
					}
					fragment.appendChild(node.cloneNode(true));
					currentP = null;
				} else {
					// Add to current paragraph
					if (!currentP) {
						currentP = document.createElement('p');
					}
					currentP.appendChild(node.cloneNode(true));
				}
			});

			if (currentP && currentP.textContent.trim()) {
				fragment.appendChild(currentP);
			}

			p.replaceWith(fragment);
		}
	});

	// STEP 12: Final cleanup - normalize whitespace
	let result = temp.innerHTML
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/>\s+</g, '><')
		// Empty elements
		.replace(/<p><\/p>/g, '')
		.replace(/<strong><\/strong>/g, '')
		.replace(/<em><\/em>/g, '')
		.replace(/<p><strong><\/strong><\/p>/g, '')       // Empty strong in p
		.replace(/<p><em><\/em><\/p>/g, '')               // Empty em in p
		.replace(/<p><strong><br><\/strong><\/p>/g, '')   // Strong with just br in p
		.replace(/<p><em><br><\/em><\/p>/g, '')           // Em with just br in p
		// Line breaks
		.replace(/<br\s*\/?>\s*(<br\s*\/?>)+/g, '<br>')   // Collapse multiple <br>
		.replace(/<p><br><\/p>/g, '')                     // Remove empty paragraphs with just <br>
		.replace(/<p><br>/g, '<p>')                       // Remove leading <br> in paragraphs
		.replace(/<h([123])><br>/g, '<h$1>')              // Remove leading <br> in headings
		.replace(/<br><\/p>/g, '</p>')                    // Remove trailing <br> in paragraphs
		.replace(/<br><\/h([123])>/g, '</h$1>')           // Remove trailing <br> in headings
		.replace(/<h([123])><\/h\1>/g, '')                // Remove empty headings
		.replace(/<\/h([123])><br><h/g, '</h$1><h')       // Remove <br> between headings
		.replace(/<\/h([123])><br><p/g, '</h$1><p')       // Remove <br> between heading and p
		.replace(/<\/p><br><p/g, '</p><p')                // Remove <br> between paragraphs
		.replace(/<\/p><br><ul/g, '</p><ul')              // Remove <br> before lists
		.replace(/<\/p><br><ol/g, '</p><ol')
		.replace(/<\/ul><br>/g, '</ul>')                  // Remove <br> after lists
		.replace(/<\/ol><br>/g, '</ol>')
		.trim();

	if (debug) {
		console.log('✅ Cleaned HTML:', result.substring(0, 300) + (result.length > 300 ? '...' : ''));
		console.log('📉 Size reduction:', html.length, '→', result.length, `(${Math.round((1 - result.length/html.length) * 100)}% smaller)`);
	}

	return result;
}

/**
 * Get DOM depth of an element
 */
function getDepth(el) {
	let depth = 0;
	let node = el;
	while (node.parentElement) {
		depth++;
		node = node.parentElement;
	}
	return depth;
}

/**
 * Find closest size in mapping
 */
function findClosestMapping(size, mapping) {
	let closest = null;
	let minDiff = Infinity;

	mapping.forEach((tag, mappedSize) => {
		const diff = Math.abs(size - mappedSize);
		if (diff < minDiff) {
			minDiff = diff;
			closest = tag;
		}
	});

	// Only use closest if within 1pt
	return minDiff <= 1 ? closest : 'p';
}

/**
 * Merge consecutive UL or OL lists into single lists
 */
function mergeConsecutiveLists(container) {
	const lists = container.querySelectorAll('ul, ol');

	lists.forEach(list => {
		let nextSibling = list.nextElementSibling;

		while (nextSibling && nextSibling.tagName === list.tagName) {
			// Move all children to current list
			while (nextSibling.firstChild) {
				list.appendChild(nextSibling.firstChild);
			}
			const toRemove = nextSibling;
			nextSibling = nextSibling.nextElementSibling;
			toRemove.remove();
		}
	});
}

