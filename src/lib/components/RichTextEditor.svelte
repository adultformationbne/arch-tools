<script>
	import {
		Bold,
		Italic,
		Quote,
		BookOpen,
		Type,
		Undo,
		Redo,
		List,
		ListOrdered,
		AlignLeft,
		AlignCenter,
		AlignRight,
		Heading1,
		Heading2,
		Heading3,
		Hash,
		Pilcrow,
		Save,
		RotateCcw,
		AlertCircle,
		Check
	} from 'lucide-svelte';

	let {
		value = '',
		placeholder = 'Start typing...',
		onInput = () => {},
		onSave = null,
		class: className = '',
		saveStatus = 'saved',
		autosave = true,
		showToolbar = true,
		allowedTags = ['paragraph', 'h1', 'h2', 'h3', 'ul', 'ol', 'blockquote', 'callout'],
		currentTag = 'paragraph'
	} = $props();

	let editor = $state(null);
	let wordCount = $state(0);
	let charCount = $state(0);
	let isActive = $state({
		bold: false,
		italic: false,
		scripture: false,
		quote: false,
		underline: false
	});

	// Enhanced formatting options
	const formats = {
		bold: { tag: 'strong', class: 'font-bold', shortcut: 'Ctrl+B' },
		italic: { tag: 'em', class: 'italic', shortcut: 'Ctrl+I' },
		underline: { tag: 'u', class: 'underline', shortcut: 'Ctrl+U' },
		scripture: {
			tag: 'span',
			class: 'text-teal-700 font-medium bg-teal-50 px-1 rounded border border-teal-200',
			shortcut: 'Ctrl+Shift+S'
		},
		quote: {
			tag: 'span',
			class: 'text-blue-700 italic bg-blue-50 px-1 rounded border border-blue-200',
			shortcut: 'Ctrl+Shift+Q'
		}
	};

	// Block-level tag options
	const tagOptions = {
		paragraph: { label: 'Paragraph', icon: Pilcrow, class: 'text-gray-700 leading-relaxed' },
		h1: { label: 'Heading 1', icon: Heading1, class: 'text-3xl font-bold text-gray-900 mb-4' },
		h2: { label: 'Heading 2', icon: Heading2, class: 'text-2xl font-semibold text-gray-800 mb-3' },
		h3: { label: 'Heading 3', icon: Heading3, class: 'text-xl font-medium text-gray-800 mb-2' },
		chapter: {
			label: 'Chapter',
			icon: Hash,
			class: 'text-2xl font-bold text-indigo-900 mb-4 border-b-2 border-indigo-200 pb-2'
		},
		ul: { label: 'Bullet List', icon: List, class: 'list-disc list-inside space-y-1' },
		ol: { label: 'Numbered List', icon: ListOrdered, class: 'list-decimal list-inside space-y-1' },
		blockquote: {
			label: 'Quote Block',
			icon: Quote,
			class: 'border-l-4 border-blue-300 bg-blue-50 pl-4 py-2 italic'
		},
		callout: {
			label: 'Callout',
			icon: AlertCircle,
			class: 'bg-yellow-50 border border-yellow-200 rounded-lg p-4'
		},
		prayer: {
			label: 'Prayer',
			icon: BookOpen,
			class: 'bg-green-50 border border-green-200 rounded-lg p-4 italic text-green-800'
		},
		scripture: {
			label: 'Scripture',
			icon: BookOpen,
			class: 'bg-teal-50 border border-teal-200 rounded-lg p-4 font-medium text-teal-800'
		}
	};

	// Basic content wrapping for block-level changes
	function wrapContentInTag(content, tag) {
		// For now, just return the content as-is to avoid loops
		// Block-level wrapping will be handled server-side
		return content;
	}

	// Enhanced command execution
	function execCommand(command, value = null) {
		if (!editor) return;

		editor.focus();

		try {
			if (command === 'formatBlock') {
				// Handle block-level formatting
				document.execCommand('formatBlock', false, value);
			} else {
				document.execCommand(command, false, value);
			}
		} catch (e) {
			console.warn('Command execution failed:', command, e);
		}

		updateActiveStates();
		handleInput();
	}

	// Enhanced format toggling
	function toggleFormat(formatName) {
		if (!editor) return;

		const format = formats[formatName];
		const selection = window.getSelection();

		if (!selection.rangeCount) return;

		editor.focus();

		if (isActive[formatName]) {
			// Remove formatting - find and unwrap the element
			removeFormatting(formatName);
		} else {
			// Apply formatting
			applyFormatting(formatName, format);
		}

		updateActiveStates();
		handleInput();
	}

	function applyFormatting(formatName, format) {
		const selection = window.getSelection();
		const range = selection.getRangeAt(0);
		const selectedText = range.toString();

		if (!selectedText) return;

		try {
			const element = document.createElement(format.tag);
			element.className = format.class;
			element.setAttribute('data-format', formatName);

			// Handle different content types
			if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
				element.appendChild(document.createTextNode(selectedText));
				range.deleteContents();
				range.insertNode(element);
			} else {
				// More complex selection handling
				const contents = range.extractContents();
				element.appendChild(contents);
				range.insertNode(element);
			}

			// Clear selection and position cursor
			selection.removeAllRanges();
			const newRange = document.createRange();
			newRange.setStartAfter(element);
			newRange.collapse(true);
			selection.addRange(newRange);
		} catch (e) {
			console.warn('Formatting failed:', e);
		}
	}

	function removeFormatting(formatName) {
		const selection = window.getSelection();
		let node = selection.anchorNode;

		// Find the formatted element
		while (node && node !== editor) {
			if (node.nodeType === Node.ELEMENT_NODE && node.getAttribute('data-format') === formatName) {
				// Unwrap the element
				const parent = node.parentNode;
				while (node.firstChild) {
					parent.insertBefore(node.firstChild, node);
				}
				parent.removeChild(node);
				break;
			}
			node = node.parentNode;
		}
	}

	// Block-level tag changes
	function changeTag(newTag) {
		if (newTag === currentTag) return; // Prevent unnecessary updates

		currentTag = newTag;

		if (editor && editor.innerHTML) {
			// Re-wrap content in new tag
			const currentContent = editor.textContent || '';
			if (currentContent.trim()) {
				isUpdatingFromProps = true;
				editor.innerHTML = wrapContentInTag(currentContent, newTag);
				handleInput();
				isUpdatingFromProps = false;
			}
		}

		// Apply tag-specific formatting to editor
		if (editor) {
			const tagClass = tagOptions[newTag]?.class || '';
			editor.className = `editor-content min-h-[120px] p-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${tagClass} ${className}`;
		}
	}

	// State management
	function updateActiveStates() {
		const selection = window.getSelection();
		if (!selection.rangeCount || !editor) return;

		// Reset states
		Object.keys(isActive).forEach((key) => (isActive[key] = false));

		// Check current formatting
		let node = selection.anchorNode;
		while (node && node !== editor) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const formatType = node.getAttribute('data-format');
				if (formatType && isActive.hasOwnProperty(formatType)) {
					isActive[formatType] = true;
				}

				// Check standard formatting
				const tagName = node.tagName?.toLowerCase();
				if (tagName === 'strong' || tagName === 'b') isActive.bold = true;
				if (tagName === 'em' || tagName === 'i') isActive.italic = true;
				if (tagName === 'u') isActive.underline = true;
			}
			node = node.parentNode;
		}
	}

	// Enhanced input handling
	function handleInput() {
		if (!editor) return;

		const content = editor.innerHTML || '';

		// Update word/character counts
		const plainText = editor.textContent || '';
		wordCount = plainText
			.trim()
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
		charCount = plainText.length;

		// Trigger callback
		onInput(content);

		// Auto-save if enabled
		if (autosave && onSave) {
			debounce(() => onSave(content), 2000)();
		}
	}

	// Enhanced keyboard shortcuts
	function handleKeyDown(e) {
		const isCtrl = e.ctrlKey || e.metaKey;
		const isShift = e.shiftKey;

		if (isCtrl) {
			switch (e.key.toLowerCase()) {
				case 'b':
					e.preventDefault();
					toggleFormat('bold');
					break;
				case 'i':
					e.preventDefault();
					toggleFormat('italic');
					break;
				case 'u':
					e.preventDefault();
					toggleFormat('underline');
					break;
				case 's':
					e.preventDefault();
					if (isShift) {
						toggleFormat('scripture');
					} else if (onSave) {
						onSave(editor.innerHTML);
					}
					break;
				case 'q':
					e.preventDefault();
					if (isShift) {
						toggleFormat('quote');
					}
					break;
				case 'z':
					e.preventDefault();
					execCommand('undo');
					break;
				case 'y':
					e.preventDefault();
					execCommand('redo');
					break;
				case 'enter':
					if (isShift) {
						e.preventDefault();
						document.execCommand('insertLineBreak');
					}
					break;
			}
		}

		// Handle special keys for lists
		if (e.key === 'Tab' && (currentTag === 'ul' || currentTag === 'ol')) {
			e.preventDefault();
			if (e.shiftKey) {
				execCommand('outdent');
			} else {
				execCommand('indent');
			}
		}
	}

	// Debounce utility
	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func.apply(this, args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	// Lifecycle management
	let isUpdatingFromProps = false;

	$effect(() => {
		if (editor && value && editor.innerHTML !== value && !isUpdatingFromProps) {
			isUpdatingFromProps = true;
			editor.innerHTML = value;
			updateActiveStates();
			isUpdatingFromProps = false;
		}
	});

	$effect(() => {
		if (typeof document !== 'undefined') {
			const handleSelectionChange = () => updateActiveStates();
			document.addEventListener('selectionchange', handleSelectionChange);
			return () => document.removeEventListener('selectionchange', handleSelectionChange);
		}
	});

	// Initialize editor with current tag class (only on mount)
	let hasInitialized = false;

	$effect(() => {
		if (editor && !hasInitialized) {
			hasInitialized = true;
			const tagClass = tagOptions[currentTag]?.class || '';
			editor.className = `editor-content min-h-[120px] p-3 border border-gray-300 ${showToolbar ? 'rounded-b-lg' : 'rounded-lg'} focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none ${tagClass} ${className}`;
		}
	});
</script>

<div class="rich-text-editor-container">
	{#if showToolbar}
		<!-- Enhanced Toolbar -->
		<div
			class="flex items-center justify-between rounded-t-lg border border-b-0 border-gray-300 bg-gray-50 p-3"
		>
			<!-- Left side - Text formatting -->
			<div class="flex items-center gap-1">
				<!-- Block type selector -->
				<select
					bind:value={currentTag}
					onchange={() => changeTag(currentTag)}
					class="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-purple-500"
				>
					{#each Object.entries(tagOptions) as [tag, config]}
						{#if allowedTags.includes(tag)}
							<option value={tag}>{config.label}</option>
						{/if}
					{/each}
				</select>

				<div class="mx-2 h-6 w-px bg-gray-300"></div>

				<!-- Inline formatting -->
				<button
					type="button"
					onclick={() => toggleFormat('bold')}
					class="rounded p-1.5 transition-colors hover:bg-gray-200 {isActive.bold
						? 'bg-blue-200 text-blue-700'
						: 'text-gray-600'}"
					title={formats.bold.shortcut}
				>
					<Bold class="h-4 w-4" />
				</button>

				<button
					type="button"
					onclick={() => toggleFormat('italic')}
					class="rounded p-1.5 transition-colors hover:bg-gray-200 {isActive.italic
						? 'bg-blue-200 text-blue-700'
						: 'text-gray-600'}"
					title={formats.italic.shortcut}
				>
					<Italic class="h-4 w-4" />
				</button>

				<button
					type="button"
					onclick={() => toggleFormat('underline')}
					class="rounded p-1.5 transition-colors hover:bg-gray-200 {isActive.underline
						? 'bg-blue-200 text-blue-700'
						: 'text-gray-600'}"
					title={formats.underline.shortcut}
				>
					<Type class="h-4 w-4" />
				</button>

				<div class="mx-1 h-6 w-px bg-gray-300"></div>

				<!-- Semantic formatting -->
				<button
					type="button"
					onclick={() => toggleFormat('scripture')}
					class="rounded p-1.5 transition-colors hover:bg-gray-200 {isActive.scripture
						? 'bg-teal-200 text-teal-700'
						: 'text-gray-600'}"
					title={formats.scripture.shortcut}
				>
					<BookOpen class="h-4 w-4" />
				</button>

				<button
					type="button"
					onclick={() => toggleFormat('quote')}
					class="rounded p-1.5 transition-colors hover:bg-gray-200 {isActive.quote
						? 'bg-blue-200 text-blue-700'
						: 'text-gray-600'}"
					title={formats.quote.shortcut}
				>
					<Quote class="h-4 w-4" />
				</button>

				<div class="mx-1 h-6 w-px bg-gray-300"></div>

				<!-- History -->
				<button
					type="button"
					onclick={() => execCommand('undo')}
					class="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-200"
					title="Undo (Ctrl+Z)"
				>
					<Undo class="h-4 w-4" />
				</button>

				<button
					type="button"
					onclick={() => execCommand('redo')}
					class="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-200"
					title="Redo (Ctrl+Y)"
				>
					<Redo class="h-4 w-4" />
				</button>
			</div>

			<!-- Right side - Status and actions -->
			<div class="flex items-center gap-4 text-sm text-gray-500">
				<div class="flex gap-4">
					<span>{wordCount} words</span>
					<span>{charCount} chars</span>
				</div>

				{#if onSave}
					<div class="flex items-center gap-2">
						{#if saveStatus === 'saving'}
							<RotateCcw class="h-4 w-4 animate-spin text-blue-600" />
							<span class="text-blue-600">Saving...</span>
						{:else if saveStatus === 'saved'}
							<Check class="h-4 w-4 text-green-600" />
							<span class="text-green-600">Saved</span>
						{:else if saveStatus === 'error'}
							<AlertCircle class="h-4 w-4 text-red-600" />
							<span class="text-red-600">Error</span>
						{/if}

						<button
							type="button"
							onclick={() => onSave(editor.innerHTML)}
							class="rounded p-1.5 text-gray-600 transition-colors hover:bg-gray-200"
							title="Save (Ctrl+S)"
						>
							<Save class="h-4 w-4" />
						</button>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Editor Content -->
	<div
		bind:this={editor}
		contenteditable="true"
		oninput={handleInput}
		onkeydown={handleKeyDown}
		data-placeholder={placeholder}
		role="textbox"
		aria-label="Rich text editor"
		tabindex="0"
		class="editor-content min-h-[300px] max-h-[600px] overflow-y-auto border border-gray-300 p-4 text-base leading-relaxed {showToolbar
			? 'rounded-b-lg'
			: 'rounded-lg'} outline-none focus:border-transparent focus:ring-2"
		style="focus:ring-color: #c59a6b;"
	></div>

	<!-- Help text -->
	{#if showToolbar}
		<div class="mt-2 flex justify-between text-xs text-gray-500">
			<div>
				<kbd class="rounded border border-gray-300 bg-gray-100 px-1 py-0.5">Ctrl+B</kbd> Bold,
				<kbd class="rounded border border-gray-300 bg-gray-100 px-1 py-0.5">Ctrl+I</kbd> Italic,
				<kbd class="rounded border border-gray-300 bg-gray-100 px-1 py-0.5">Ctrl+Shift+S</kbd>
				Scripture,
				<kbd class="rounded border border-gray-300 bg-gray-100 px-1 py-0.5">Ctrl+Shift+Q</kbd> Quote
			</div>
			<div>
				{#if currentTag === 'ul' || currentTag === 'ol'}
					<kbd class="rounded border border-gray-300 bg-gray-100 px-1 py-0.5">Tab</kbd> Indent,
					<kbd class="rounded border border-gray-300 bg-gray-100 px-1 py-0.5">Shift+Tab</kbd> Outdent
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.editor-content:empty:before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
		font-style: italic;
	}

	/* Formatting styles that match our system */
	:global(.editor-content [data-format='scripture']) {
		@apply rounded border border-teal-200 bg-teal-50 px-1 font-medium text-teal-700;
	}

	:global(.editor-content [data-format='quote']) {
		@apply rounded border border-blue-200 bg-blue-50 px-1 text-blue-700 italic;
	}

	:global(.editor-content strong),
	:global(.editor-content b) {
		@apply font-bold;
	}

	:global(.editor-content em),
	:global(.editor-content i) {
		@apply italic;
	}

	:global(.editor-content u) {
		@apply underline;
	}

	/* Block-level styling */
	:global(.editor-content h1) {
		@apply mb-4 text-3xl font-bold text-gray-900 leading-tight;
		font-size: 2rem !important;
		line-height: 1.2 !important;
	}

	:global(.editor-content h2) {
		@apply mb-3 text-2xl font-semibold text-gray-800 leading-tight;
		font-size: 1.5rem !important;
		line-height: 1.3 !important;
	}

	:global(.editor-content h3) {
		@apply mb-2 text-xl font-medium text-gray-800 leading-tight;
		font-size: 1.25rem !important;
		line-height: 1.4 !important;
	}

	:global(.editor-content ul) {
		@apply list-inside list-disc space-y-1;
	}

	:global(.editor-content ol) {
		@apply list-inside list-decimal space-y-1;
	}

	:global(.editor-content blockquote) {
		@apply border-l-4 border-blue-300 bg-blue-50 py-2 pl-4 italic;
	}

	:global(.editor-content p) {
		@apply leading-relaxed text-gray-700 mb-3;
		min-height: 1.5em;
	}

	:global(.editor-content p:empty) {
		@apply mb-3;
		min-height: 1.5em;
	}
</style>
