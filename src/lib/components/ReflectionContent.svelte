<script>
	/**
	 * ReflectionContent - Displays formatted reflection HTML content
	 *
	 * Two modes:
	 * - compact (default): Headings rendered as bold text, good for previews/smaller displays
	 * - full: Headings rendered as actual headings, good for modals/full view
	 */
	let {
		content = '',
		mode = 'compact', // 'compact' | 'full'
		maxLength = 0, // 0 = no truncation
		class: className = ''
	} = $props();

	// Safely truncate HTML without breaking tags
	const truncateHtml = (html, max) => {
		if (!max || !html) return html;

		// Create a temporary element to parse HTML
		const temp = document.createElement('div');
		temp.innerHTML = html;

		// Get text content length
		const textContent = temp.textContent || temp.innerText || '';
		if (textContent.length <= max) return html;

		// Need to truncate - walk through and collect nodes up to limit
		let charCount = 0;
		const truncateNode = (node) => {
			if (charCount >= max) {
				node.remove();
				return;
			}

			if (node.nodeType === Node.TEXT_NODE) {
				const remaining = max - charCount;
				if (node.textContent.length > remaining) {
					node.textContent = node.textContent.substring(0, remaining) + '...';
					charCount = max;
				} else {
					charCount += node.textContent.length;
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				// Process children
				const children = Array.from(node.childNodes);
				for (const child of children) {
					truncateNode(child);
				}
			}
		};

		const children = Array.from(temp.childNodes);
		for (const child of children) {
			truncateNode(child);
		}

		return temp.innerHTML;
	};

	// Process content - convert headings to bold in compact mode
	const processContent = (html, displayMode) => {
		if (!html) return '';

		if (displayMode === 'compact') {
			// Convert h1, h2, h3 to strong (bold paragraph)
			return html
				.replace(/<h[123][^>]*>/gi, '<p><strong>')
				.replace(/<\/h[123]>/gi, '</strong></p>');
		}

		// Full mode - normalize all headings to h2 for consistency
		return html
			.replace(/<h1([^>]*)>/gi, '<h2$1>')
			.replace(/<\/h1>/gi, '</h2>')
			.replace(/<h3([^>]*)>/gi, '<h2$1>')
			.replace(/<\/h3>/gi, '</h2>');
	};

	let displayContent = $derived.by(() => {
		let processed = processContent(content, mode);
		if (maxLength > 0 && typeof document !== 'undefined') {
			processed = truncateHtml(processed, maxLength);
		}
		return processed;
	});
</script>

<div class="reflection-content {mode} {className}">
	{@html displayContent}
</div>

<style>
	/* Base styles for reflection content */
	.reflection-content {
		line-height: 1.7;
		color: #374151;
	}

	/* Paragraphs */
	.reflection-content :global(p) {
		margin-bottom: 0.75rem;
	}

	.reflection-content :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Bold */
	.reflection-content :global(strong),
	.reflection-content :global(b) {
		font-weight: 700;
	}

	/* Italic */
	.reflection-content :global(em),
	.reflection-content :global(i) {
		font-style: italic;
	}

	/* Underline */
	.reflection-content :global(u) {
		text-decoration: underline;
	}

	/* Lists */
	.reflection-content :global(ul),
	.reflection-content :global(ol) {
		padding-left: 1.5rem;
		margin-bottom: 0.75rem;
	}

	.reflection-content :global(ul) {
		list-style-type: disc;
	}

	.reflection-content :global(ol) {
		list-style-type: decimal;
	}

	.reflection-content :global(li) {
		margin-bottom: 0.25rem;
	}

	.reflection-content :global(li:last-child) {
		margin-bottom: 0;
	}

	/* Compact mode - headings are converted to bold, inherit text size */
	.reflection-content.compact :global(p strong) {
		display: block;
		margin-top: 0.5rem;
	}

	/* Full mode - actual heading styles */
	.reflection-content.full :global(h2) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
		color: #1f2937;
	}

	.reflection-content.full :global(h2:first-child) {
		margin-top: 0;
	}
</style>
