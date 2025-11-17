<script>
	import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3 } from 'lucide-svelte';

	let {
		content = $bindable(''),
		placeholder = 'Start writing...',
		editorId = undefined,
		labelledBy = undefined
	} = $props();

	let editor = $state(null);
	let isEditing = $state(false);

	// Track current formatting state
	let formatState = $state({
		bold: false,
		italic: false,
		h1: false,
		h2: false,
		h3: false,
		ul: false,
		ol: false
	});

	const initEditor = () => {
		if (!editor) return;

		// If no content, add an empty paragraph to start
		if (!content || content.trim() === '') {
			editor.innerHTML = '<p><br></p>';
		} else {
			editor.innerHTML = content;
		}

		// Set default format to paragraph mode
		document.execCommand('defaultParagraphSeparator', false, 'p');

		updateFormatState();
	};

	const updateFormatState = () => {
		if (!editor) return;

		const selection = window.getSelection();
		if (selection.rangeCount === 0) return;

		// Check current formatting
		formatState = {
			bold: document.queryCommandState('bold'),
			italic: document.queryCommandState('italic'),
			h1: !!getParentElement('H1'),
			h2: !!getParentElement('H2'),
			h3: !!getParentElement('H3'),
			ul: !!getParentElement('UL'),
			ol: !!getParentElement('OL')
		};
	};

	const getParentElement = (tagName) => {
		const selection = window.getSelection();
		if (selection.rangeCount === 0) return null;

		let node = selection.anchorNode;
		while (node && node !== editor) {
			if (node.nodeType === Node.ELEMENT_NODE && node.tagName === tagName) {
				return node;
			}
			node = node.parentNode;
		}
		return null;
	};

	const execCommand = (command, value = null) => {
		document.execCommand(command, false, value);
		updateFormatState();
		updateContent();
	};

	const formatHeading = (level) => {
		const selection = window.getSelection();
		if (selection.rangeCount === 0) return;

		// Check if we're already in this heading level - if so, convert to paragraph
		const currentHeading = getParentElement(`H${level}`);
		if (currentHeading) {
			document.execCommand('formatBlock', false, 'P');
		} else {
			// Format as heading
			document.execCommand('formatBlock', false, `H${level}`);
		}

		// Apply styles directly to ensure they show up
		setTimeout(() => {
			// Apply paragraph styles to any new paragraphs
			const paragraphs = editor.querySelectorAll('p');
			paragraphs.forEach(p => applyParagraphStyles(p));

			// Apply heading styles
			const headings = editor.querySelectorAll(`h${level}`);
			headings.forEach(heading => {
				applyHeadingStyles(heading, level);
			});
			updateFormatState();
			updateContent();
		}, 0);
	};

	const applyParagraphStyles = (element) => {
		element.style.fontSize = '';
		element.style.fontWeight = '';
		element.style.lineHeight = '1.6';
		element.style.marginBottom = '1rem';
		element.style.color = '';
	};

	const applyHeadingStyles = (element, level) => {
		// Clear any existing styles
		element.style.fontSize = '';
		element.style.fontWeight = '';
		element.style.lineHeight = '';
		element.style.marginBottom = '';

		// Apply appropriate styles
		switch(level) {
			case 1:
				element.style.fontSize = '2rem';
				element.style.fontWeight = 'bold';
				element.style.lineHeight = '1.2';
				element.style.marginBottom = '1rem';
				element.style.color = '#1f2937';
				break;
			case 2:
				element.style.fontSize = '1.5rem';
				element.style.fontWeight = '600';
				element.style.lineHeight = '1.3';
				element.style.marginBottom = '0.75rem';
				element.style.color = '#374151';
				break;
			case 3:
				element.style.fontSize = '1.25rem';
				element.style.fontWeight = '500';
				element.style.lineHeight = '1.4';
				element.style.marginBottom = '0.5rem';
				element.style.color = '#374151';
				break;
		}
	};

	const insertList = (ordered = false) => {
		const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
		execCommand(command);

		// Apply proper list styling after creation
		setTimeout(() => {
			const lists = editor.querySelectorAll('ul, ol');
			lists.forEach(list => {
				applyListStyles(list);
			});
			updateFormatState();
		}, 0);
	};

	const applyListStyles = (listElement) => {
		// Apply consistent list styling
		listElement.style.paddingLeft = '1.5rem';
		listElement.style.marginBottom = '1rem';

		// Style list items
		const items = listElement.querySelectorAll('li');
		items.forEach(item => {
			item.style.marginBottom = '0.25rem';
			item.style.lineHeight = '1.5';
		});

		// Ensure proper list style type
		if (listElement.tagName === 'UL') {
			listElement.style.listStyleType = 'disc';
		} else if (listElement.tagName === 'OL') {
			listElement.style.listStyleType = 'decimal';
		}
	};

	const updateContent = () => {
		if (!editor) return;
		content = editor.innerHTML;
	};

	const handleKeyDown = (e) => {
		// Handle Enter key to ensure proper paragraph creation
		if (e.key === 'Enter') {
			// Let the browser handle it naturally, but ensure it creates paragraphs
			setTimeout(() => {
				// Check if we're in a div (browser sometimes creates divs instead of p)
				const selection = window.getSelection();
				if (selection.rangeCount > 0) {
					let node = selection.anchorNode;
					while (node && node !== editor) {
						if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'DIV') {
							// Convert div to paragraph
							const p = document.createElement('p');
							p.innerHTML = node.innerHTML;
							node.parentNode.replaceChild(p, node);
							applyParagraphStyles(p);

							// Move cursor to the new paragraph
							const range = document.createRange();
							range.setStart(p, 0);
							range.collapse(true);
							selection.removeAllRanges();
							selection.addRange(range);
							break;
						}
						node = node.parentNode;
					}
				}
				updateFormatState();
				updateContent();
			}, 0);
		}

		// Handle common shortcuts
		if (e.ctrlKey || e.metaKey) {
			switch (e.key) {
				case 'b':
					e.preventDefault();
					execCommand('bold');
					break;
				case 'i':
					e.preventDefault();
					execCommand('italic');
					break;
				case '1':
					if (e.altKey) {
						e.preventDefault();
						formatHeading(1);
					}
					break;
				case '2':
					if (e.altKey) {
						e.preventDefault();
						formatHeading(2);
					}
					break;
				case '3':
					if (e.altKey) {
						e.preventDefault();
						formatHeading(3);
					}
					break;
				case 'l':
					if (e.shiftKey) {
						e.preventDefault();
						insertList(false); // Ctrl+Shift+L for bullet list
					}
					break;
				case 'o':
					if (e.shiftKey) {
						e.preventDefault();
						insertList(true); // Ctrl+Shift+O for numbered list
					}
					break;
			}
		}
	};

	const handleSelectionChange = () => {
		if (isEditing) {
			updateFormatState();
		}
	};

	$effect(() => {
		document.addEventListener('selectionchange', handleSelectionChange);
		return () => document.removeEventListener('selectionchange', handleSelectionChange);
	});

	$effect(() => {
		if (editor && content !== editor.innerHTML) {
			initEditor();
		}
	});

	// Handle paste - clean up Word/formatting
	const handlePaste = (e) => {
		e.preventDefault();

		// Get clipboard data
		const clipboardData = e.clipboardData || window.clipboardData;
		const htmlData = clipboardData.getData('text/html');
		const textData = clipboardData.getData('text/plain');

		if (htmlData) {
			// Clean Word HTML
			const cleanedHtml = cleanWordHtml(htmlData);
			document.execCommand('insertHTML', false, cleanedHtml);
		} else if (textData) {
			// Plain text - insert as paragraphs
			const paragraphs = textData.split('\n\n').filter(p => p.trim());
			const html = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
			document.execCommand('insertHTML', false, html);
		}

		setTimeout(() => {
			updateContent();
			updateFormatState();
		}, 0);
	};

	// Clean Word/pasted HTML - keep ONLY h1-h3, p, ul, ol, li, strong, em
	const cleanWordHtml = (html) => {
		// STEP 1: Remove ALL HTML comments (including Word conditional comments)
		html = html.replace(/<!--[\s\S]*?-->/g, '');

		// STEP 2: Remove XML declarations and CDATA
		html = html.replace(/<\?xml[\s\S]*?\?>/g, '');
		html = html.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

		// STEP 3: Parse into DOM
		const temp = document.createElement('div');
		temp.innerHTML = html;

		// STEP 4: Remove Word-specific elements (meta, link, style, script, xml)
		temp.querySelectorAll('meta, link, style, script, xml').forEach(el => el.remove());

		// STEP 5: Remove ALL namespaced elements (w:*, o:*, v:*, m:*)
		Array.from(temp.querySelectorAll('*')).forEach(el => {
			if (el.tagName.includes(':')) {
				el.remove();
			}
		});

		// STEP 6: Process remaining elements - keep only allowed tags
		const allowedTags = ['P', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'B', 'I', 'BR'];

		Array.from(temp.querySelectorAll('*')).forEach(el => {
			// Remove ALL attributes (style, class, etc.) from every element
			while (el.attributes.length > 0) {
				el.removeAttribute(el.attributes[0].name);
			}

			// Handle disallowed tags
			if (!allowedTags.includes(el.tagName)) {
				if (el.tagName === 'SPAN') {
					// Unwrap spans (Word uses these heavily for formatting)
					el.replaceWith(...el.childNodes);
				} else if (el.tagName === 'DIV') {
					// Convert divs to paragraphs
					const p = document.createElement('p');
					p.innerHTML = el.innerHTML;
					el.replaceWith(p);
				} else {
					// Other disallowed tags - unwrap if inline, convert to p if block
					try {
						const display = window.getComputedStyle(el).display;
						if (display === 'block') {
							const p = document.createElement('p');
							p.innerHTML = el.innerHTML;
							el.replaceWith(p);
						} else {
							el.replaceWith(...el.childNodes);
						}
					} catch {
						// If getComputedStyle fails, just unwrap
						el.replaceWith(...el.childNodes);
					}
				}
				return;
			}

			// Convert B to STRONG, I to EM for consistency
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

		// STEP 7: Clean up empty paragraphs and excessive line breaks
		temp.querySelectorAll('p').forEach(p => {
			if (!p.textContent.trim()) {
				p.remove();
			}
		});

		// STEP 8: Remove consecutive BR tags (Word adds lots of these)
		let previousWasBr = false;
		Array.from(temp.querySelectorAll('br')).forEach(br => {
			if (previousWasBr) {
				br.remove();
			} else {
				previousWasBr = true;
			}
			// Reset on non-br
			if (br.nextSibling && br.nextSibling.nodeType !== 1) {
				previousWasBr = false;
			}
		});

		return temp.innerHTML;
	};

	// Apply formatting styles after any input
	const handleInput = () => {
		updateContent();

		// Reapply formatting styles if they got lost
		setTimeout(() => {
			// Convert any bare text nodes or divs to paragraphs
			const textNodes = [];
			const walker = document.createTreeWalker(
				editor,
				NodeFilter.SHOW_TEXT,
				null,
				false
			);

			let node;
			while (node = walker.nextNode()) {
				if (node.parentNode === editor && node.textContent.trim()) {
					textNodes.push(node);
				}
			}

			textNodes.forEach(textNode => {
				const p = document.createElement('p');
				textNode.parentNode.insertBefore(p, textNode);
				p.appendChild(textNode);
				applyParagraphStyles(p);
			});

			// Convert any divs to paragraphs
			const divs = editor.querySelectorAll('div');
			divs.forEach(div => {
				if (div.parentNode === editor) {
					const p = document.createElement('p');
					p.innerHTML = div.innerHTML;
					div.parentNode.replaceChild(p, div);
					applyParagraphStyles(p);
				}
			});

			// Reapply paragraph styles
			const paragraphs = editor.querySelectorAll('p');
			paragraphs.forEach(p => applyParagraphStyles(p));

			// Reapply heading styles
			const headings = editor.querySelectorAll('h1, h2, h3');
			headings.forEach(heading => {
				const level = parseInt(heading.tagName.charAt(1));
				applyHeadingStyles(heading, level);
			});

			// Reapply list styles
			const lists = editor.querySelectorAll('ul, ol');
			lists.forEach(list => {
				applyListStyles(list);
			});

			updateFormatState();
		}, 0);
	};
</script>

<div class="rich-text-editor border border-gray-300 rounded-lg overflow-hidden">
	<!-- Toolbar -->
	<div class="flex items-center gap-1 p-3 bg-gray-50 border-b border-gray-200">
		<!-- Headings -->
		<div class="flex border-r border-gray-300 pr-3 mr-3">
			<button
				type="button"
				onclick={() => formatHeading(1)}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.h1 ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Heading 1 (Alt+1)"
			>
				<Heading1 size="18" />
			</button>
			<button
				type="button"
				onclick={() => formatHeading(2)}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.h2 ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Heading 2 (Alt+2)"
			>
				<Heading2 size="18" />
			</button>
			<button
				type="button"
				onclick={() => formatHeading(3)}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.h3 ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Heading 3 (Alt+3)"
			>
				<Heading3 size="18" />
			</button>
		</div>

		<!-- Text formatting -->
		<div class="flex border-r border-gray-300 pr-3 mr-3">
			<button
				type="button"
				onclick={() => execCommand('bold')}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.bold ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Bold (Ctrl+B)"
			>
				<Bold size="16" />
			</button>
			<button
				type="button"
				onclick={() => execCommand('italic')}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.italic ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Italic (Ctrl+I)"
			>
				<Italic size="16" />
			</button>
		</div>

		<!-- Lists -->
		<div class="flex">
			<button
				type="button"
				onclick={() => insertList(false)}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.ul ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Bullet List (Ctrl+Shift+L)"
			>
				<List size="16" />
			</button>
			<button
				type="button"
				onclick={() => insertList(true)}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.ol ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Numbered List (Ctrl+Shift+O)"
			>
				<ListOrdered size="16" />
			</button>
		</div>
	</div>

	<!-- Editor -->
	<div
		bind:this={editor}
		contenteditable="true"
		id={editorId}
		aria-labelledby={labelledBy}
		role="textbox"
		aria-multiline="true"
		tabindex="0"
		class="p-4 min-h-80 max-h-96 overflow-y-auto focus:outline-none prose prose-sm max-w-none"
		style="focus:ring-color: #c59a6b;"
		onkeydown={handleKeyDown}
		oninput={handleInput}
		onpaste={handlePaste}
		onfocus={() => isEditing = true}
		onblur={() => isEditing = false}
		data-placeholder={placeholder}
	></div>
</div>

<style>
	.rich-text-editor [contenteditable]:empty:before {
		content: attr(data-placeholder);
		@apply text-gray-400 pointer-events-none italic;
	}

	.rich-text-editor :global([contenteditable] p) {
		@apply leading-relaxed mb-4 text-base;
	}

	/* Ensure lists display properly in contenteditable */
	.rich-text-editor :global([contenteditable] ul) {
		@apply list-disc pl-6 mb-4;
	}

	.rich-text-editor :global([contenteditable] ol) {
		@apply list-decimal pl-6 mb-4;
	}

	.rich-text-editor :global([contenteditable] li) {
		@apply list-item mb-1 leading-normal ml-0;
	}

	/* Ensure heading styles are preserved */
	.rich-text-editor :global([contenteditable] h1) {
		@apply text-3xl font-bold leading-tight mb-4 text-gray-800;
	}

	.rich-text-editor :global([contenteditable] h2) {
		@apply text-2xl font-semibold leading-snug mb-3 text-gray-700;
	}

	.rich-text-editor :global([contenteditable] h3) {
		@apply text-xl font-medium leading-snug mb-2 text-gray-700;
	}
</style>
