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
		class="p-4 min-h-80 max-h-96 overflow-y-auto focus:outline-none prose prose-sm max-w-none"
		style="focus:ring-color: #c59a6b;"
		onkeydown={handleKeyDown}
		oninput={handleInput}
		onfocus={() => isEditing = true}
		onblur={() => isEditing = false}
		data-placeholder={placeholder}
	></div>
</div>

<style>
	@reference "../../app.css";
	.rich-text-editor [contenteditable]:empty:before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
		font-style: italic;
	}

	.rich-text-editor .prose p {
		@apply mb-3 leading-relaxed;
	}

	.rich-text-editor [contenteditable] p {
		line-height: 1.6 !important;
		margin-bottom: 1rem !important;
		font-size: 1rem !important;
	}

	.rich-text-editor .prose ul {
		@apply list-disc pl-6 mb-3;
		list-style-type: disc !important;
	}

	.rich-text-editor .prose ol {
		@apply list-decimal pl-6 mb-3;
		list-style-type: decimal !important;
	}

	.rich-text-editor .prose li {
		@apply mb-1;
		display: list-item !important;
		margin-left: 0 !important;
	}

	/* Ensure lists display properly in contenteditable */
	.rich-text-editor [contenteditable] ul {
		list-style-type: disc !important;
		padding-left: 1.5rem !important;
		margin-bottom: 1rem !important;
	}

	.rich-text-editor [contenteditable] ol {
		list-style-type: decimal !important;
		padding-left: 1.5rem !important;
		margin-bottom: 1rem !important;
	}

	.rich-text-editor [contenteditable] li {
		display: list-item !important;
		margin-bottom: 0.25rem !important;
		line-height: 1.5 !important;
		margin-left: 0 !important;
	}

	.rich-text-editor .prose strong {
		@apply font-bold;
	}

	.rich-text-editor .prose em {
		@apply italic;
	}

	/* Ensure heading styles are preserved */
	.rich-text-editor [contenteditable] h1 {
		font-size: 2rem !important;
		font-weight: bold !important;
		line-height: 1.2 !important;
		margin-bottom: 1rem !important;
		color: #1f2937 !important;
	}

	.rich-text-editor [contenteditable] h2 {
		font-size: 1.5rem !important;
		font-weight: 600 !important;
		line-height: 1.3 !important;
		margin-bottom: 0.75rem !important;
		color: #374151 !important;
	}

	.rich-text-editor [contenteditable] h3 {
		font-size: 1.25rem !important;
		font-weight: 500 !important;
		line-height: 1.4 !important;
		margin-bottom: 0.5rem !important;
		color: #374151 !important;
	}
</style>
