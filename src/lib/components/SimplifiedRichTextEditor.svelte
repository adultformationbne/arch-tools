<script>
	import { Bold, Italic, Underline, List, ListOrdered, Heading2 } from 'lucide-svelte';
	import { cleanWordHtml } from '$lib/utils/html-cleaner.js';

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
		underline: false,
		heading: false,
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
			underline: document.queryCommandState('underline'),
			heading: !!getParentElement('H2'),
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

	const toggleHeading = () => {
		const selection = window.getSelection();
		if (selection.rangeCount === 0) return;

		// Check if we're already in a heading - if so, convert to paragraph
		const currentHeading = getParentElement('H2');
		if (currentHeading) {
			document.execCommand('formatBlock', false, 'P');
		} else {
			// Format as heading
			document.execCommand('formatBlock', false, 'H2');
		}

		// Apply styles directly to ensure they show up
		setTimeout(() => {
			// Apply paragraph styles to any new paragraphs
			const paragraphs = editor.querySelectorAll('p');
			paragraphs.forEach(p => applyParagraphStyles(p));

			// Apply heading styles
			const headings = editor.querySelectorAll('h2');
			headings.forEach(heading => {
				applyHeadingStyles(heading);
			});
			updateFormatState();
			updateContent();
		}, 0);
	};

	// NO inline styles - CSS handles all styling
	const applyParagraphStyles = (element) => {
		// Clear any Word garbage styles
		element.removeAttribute('style');
	};

	const applyHeadingStyles = (element) => {
		// Clear any Word garbage styles - CSS handles styling
		element.removeAttribute('style');
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
		// Clear any Word garbage styles - CSS handles styling
		listElement.removeAttribute('style');
		listElement.querySelectorAll('li').forEach(item => {
			item.removeAttribute('style');
		});
	};

	const updateContent = () => {
		if (!editor) return;
		// Strip any inline styles before saving - store clean semantic HTML only
		const temp = document.createElement('div');
		temp.innerHTML = editor.innerHTML;

		// Remove all inline styles
		temp.querySelectorAll('*').forEach(el => el.removeAttribute('style'));

		// Fix invalid nesting: headings containing block elements
		temp.querySelectorAll('h2').forEach(heading => {
			const hasBlockChildren = heading.querySelector('p, ul, ol, li, div, blockquote, table');
			if (hasBlockChildren) {
				// Unwrap the heading - it's invalid
				heading.replaceWith(...heading.childNodes);
			}
		});

		content = temp.innerHTML
			.replace(/<p><\/p>/g, '')
			.replace(/<p><br><\/p>/g, '')
			.replace(/<strong><\/strong>/g, '')
			.replace(/<em><\/em>/g, '')
			.replace(/<h2><\/h2>/g, '')      // Empty headings
			.replace(/<h2><br><\/h2>/g, ''); // Headings with just br
	};

	const handleKeyDown = (e) => {
		// Handle Enter key to ensure proper paragraph creation
		if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
			// Check if we're in a list item and it's empty - if so, exit the list
			const listItem = getParentElement('LI');
			if (listItem) {
				const isEmpty = !listItem.textContent.trim() &&
					(!listItem.innerHTML || listItem.innerHTML === '<br>' || listItem.innerHTML === '');

				if (isEmpty) {
					e.preventDefault();
					e.stopPropagation();

					// Find the parent list (UL or OL)
					const list = listItem.closest('ul, ol');
					if (list) {
						// Create a new paragraph after the list
						const p = document.createElement('p');
						p.innerHTML = '<br>';

						// Remove the empty list item
						listItem.remove();

						// If the list is now empty, remove it too
						if (!list.querySelector('li')) {
							list.parentNode.insertBefore(p, list);
							list.remove();
						} else {
							// Insert paragraph after the list
							list.parentNode.insertBefore(p, list.nextSibling);
						}

						// Move cursor to the new paragraph
						const selection = window.getSelection();
						const range = document.createRange();
						range.setStart(p, 0);
						range.collapse(true);
						selection.removeAllRanges();
						selection.addRange(range);

						updateFormatState();
						updateContent();
					}
					return;
				}
			}

			// Stop propagation to prevent parent handlers from interfering
			e.stopPropagation();
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
				case 'u':
					e.preventDefault();
					execCommand('underline');
					break;
				case 'h':
					if (e.altKey) {
						e.preventDefault();
						toggleHeading();
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

	// Handle paste - clean up Word/formatting using smart cleaner
	const handlePaste = (e) => {
		e.preventDefault();

		const clipboardData = e.clipboardData || window.clipboardData;
		const htmlData = clipboardData.getData('text/html');
		const textData = clipboardData.getData('text/plain');

		if (htmlData) {
			console.log('═'.repeat(60));
			console.log('📋 RAW PASTE HTML (first 2000 chars):');
			console.log('═'.repeat(60));
			console.log(htmlData.substring(0, 2000));
			console.log('═'.repeat(60));

			// Use smart cleaner with debug logging
			const cleanedHtml = cleanWordHtml(htmlData, { debug: true });

			console.log('═'.repeat(60));
			console.log('✨ CLEANED HTML:');
			console.log('═'.repeat(60));
			console.log(cleanedHtml);
			console.log('═'.repeat(60));

			document.execCommand('insertHTML', false, cleanedHtml);
		} else if (textData) {
			// Plain text - insert as paragraphs
			console.log('📝 Plain text paste');
			const paragraphs = textData.split('\n\n').filter(p => p.trim());
			const html = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
			document.execCommand('insertHTML', false, html);
		}

		setTimeout(() => {
			updateContent();
			updateFormatState();
		}, 0);
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
			const headings = editor.querySelectorAll('h2');
			headings.forEach(heading => {
				applyHeadingStyles(heading);
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

<div class="rich-text-editor rounded-lg shadow-sm border border-gray-200 bg-white">
	<!-- Toolbar - sticky below page header -->
	<div class="editor-toolbar flex items-center gap-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm sticky top-[70px] z-20">
		<!-- Heading -->
		<div class="flex border-r border-gray-300 pr-3 mr-3">
			<button
				type="button"
				onclick={toggleHeading}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.heading ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Heading (Ctrl+Alt+H)"
			>
				<Heading2 size="18" />
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
			<button
				type="button"
				onclick={() => execCommand('underline')}
				class="p-2 rounded hover:bg-gray-200 transition-colors {formatState.underline ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}"
				title="Underline (Ctrl+U)"
			>
				<Underline size="16" />
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
		class="editor-area"
		onkeydown={handleKeyDown}
		oninput={handleInput}
		onpaste={handlePaste}
		onfocus={() => isEditing = true}
		onblur={() => isEditing = false}
		data-placeholder={placeholder}
	></div>
</div>

<style>
	/* Editor area - generous padding */
	.editor-area {
		padding: 2rem 3.5rem;
		min-height: 350px;
		outline: none;
		background: white;
	}

	/* Placeholder */
	.editor-area:empty:before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
		font-style: italic;
	}

	/* Typography */
	.rich-text-editor :global(.editor-area h2) {
		font-size: 1.25rem !important;
		font-weight: 600 !important;
		line-height: 1.35 !important;
		margin-bottom: 0.5rem !important;
		margin-top: 1rem !important;
		color: #1f2937 !important;
	}

	.rich-text-editor :global(.editor-area h2:first-child) {
		margin-top: 0 !important;
	}

	.rich-text-editor :global(.editor-area p) {
		font-size: 1rem !important;
		line-height: 1.7 !important;
		margin-bottom: 0.75rem !important;
		color: #374151 !important;
	}

	.rich-text-editor :global(.editor-area ul),
	.rich-text-editor :global(.editor-area ol) {
		padding-left: 1.75rem !important;
		margin-bottom: 0.75rem !important;
		font-size: 1rem !important;
		color: #374151 !important;
	}

	.rich-text-editor :global(.editor-area ul) {
		list-style-type: disc !important;
	}

	.rich-text-editor :global(.editor-area ol) {
		list-style-type: decimal !important;
	}

	.rich-text-editor :global(.editor-area li) {
		margin-bottom: 0.35rem !important;
		line-height: 1.6 !important;
		font-size: 1rem !important;
	}

	.rich-text-editor :global(.editor-area strong),
	.rich-text-editor :global(.editor-area b) {
		font-weight: 700 !important;
	}

	.rich-text-editor :global(.editor-area em),
	.rich-text-editor :global(.editor-area i) {
		font-style: italic !important;
	}

	.rich-text-editor :global(.editor-area u) {
		text-decoration: underline !important;
	}
</style>
