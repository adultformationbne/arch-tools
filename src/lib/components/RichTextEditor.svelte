<script>
	import { Bold, Italic, Quote, BookOpen, Type, Undo, Redo } from 'lucide-svelte';
	
	let { value = '', placeholder = '', onInput = () => {}, class: className = '' } = $props();
	
	let editor = $state(null);
	let isActive = $state({
		bold: false,
		italic: false,
		scripture: false,
		quote: false
	});
	
	// Custom formatting commands
	const formats = {
		bold: { tag: 'strong', class: 'font-bold' },
		italic: { tag: 'em', class: 'italic' },
		scripture: { tag: 'span', class: 'text-teal-700 font-medium bg-teal-50 px-1 rounded' },
		quote: { tag: 'span', class: 'text-blue-700 italic bg-blue-50 px-1 rounded' }
	};
	
	function execCommand(command, value = null) {
		document.execCommand(command, false, value);
		updateActiveStates();
		handleInput();
	}
	
	function toggleFormat(formatName) {
		const format = formats[formatName];
		
		if (isActive[formatName]) {
			// Remove formatting
			execCommand('removeFormat');
		} else {
			// Apply custom formatting
			const selection = window.getSelection();
			if (selection.rangeCount > 0) {
				const range = selection.getRangeAt(0);
				const selectedText = range.toString();
				
				if (selectedText) {
					const span = document.createElement(format.tag);
					span.className = format.class;
					span.setAttribute('data-format', formatName);
					
					try {
						range.deleteContents();
						span.appendChild(document.createTextNode(selectedText));
						range.insertNode(span);
						
						// Clear selection and place cursor after the span
						selection.removeAllRanges();
						const newRange = document.createRange();
						newRange.setStartAfter(span);
						newRange.collapse(true);
						selection.addRange(newRange);
					} catch (e) {
						console.warn('Formatting failed:', e);
					}
				}
			}
		}
		
		updateActiveStates();
		handleInput();
	}
	
	function updateActiveStates() {
		const selection = window.getSelection();
		if (selection.rangeCount === 0) return;
		
		const range = selection.getRangeAt(0);
		let node = range.commonAncestorContainer;
		
		// Reset states
		Object.keys(isActive).forEach(key => isActive[key] = false);
		
		// Check if we're inside formatted elements
		while (node && node !== editor) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				const formatType = node.getAttribute('data-format');
				if (formatType && isActive.hasOwnProperty(formatType)) {
					isActive[formatType] = true;
				}
				
				// Check for standard formatting
				if (node.tagName === 'STRONG' || node.tagName === 'B') {
					isActive.bold = true;
				}
				if (node.tagName === 'EM' || node.tagName === 'I') {
					isActive.italic = true;
				}
			}
			node = node.parentNode;
		}
	}
	
	function handleInput() {
		if (editor) {
			const content = editor.innerHTML;
			onInput(content);
		}
	}
	
	function handleKeyDown(e) {
		// Handle shortcuts
		if (e.ctrlKey || e.metaKey) {
			switch (e.key) {
				case 'b':
					e.preventDefault();
					toggleFormat('bold');
					break;
				case 'i':
					e.preventDefault();
					toggleFormat('italic');
					break;
				case 'q':
					e.preventDefault();
					toggleFormat('quote');
					break;
				case 's':
					e.preventDefault();
					toggleFormat('scripture');
					break;
				case 'z':
					e.preventDefault();
					execCommand('undo');
					break;
				case 'y':
					e.preventDefault();
					execCommand('redo');
					break;
			}
		}
	}
	
	function handleSelectionChange() {
		updateActiveStates();
	}
	
	// Set initial content
	$effect(() => {
		if (editor && value && editor.innerHTML !== value) {
			editor.innerHTML = value;
		}
	});
	
	// Listen for selection changes
	$effect(() => {
		if (typeof document !== 'undefined') {
			document.addEventListener('selectionchange', handleSelectionChange);
			return () => {
				document.removeEventListener('selectionchange', handleSelectionChange);
			};
		}
	});
</script>

<div class="rich-text-container">
	<!-- Formatting Toolbar -->
	<div class="flex items-center gap-1 p-2 border border-gray-300 border-b-0 rounded-t-lg bg-gray-50">
		<button
			type="button"
			onclick={() => toggleFormat('bold')}
			class="p-1.5 rounded hover:bg-gray-200 transition-colors {isActive.bold ? 'bg-blue-200 text-blue-700' : 'text-gray-600'}"
			title="Bold (Ctrl+B)"
		>
			<Bold class="w-4 h-4" />
		</button>
		
		<button
			type="button"
			onclick={() => toggleFormat('italic')}
			class="p-1.5 rounded hover:bg-gray-200 transition-colors {isActive.italic ? 'bg-blue-200 text-blue-700' : 'text-gray-600'}"
			title="Italic (Ctrl+I)"
		>
			<Italic class="w-4 h-4" />
		</button>
		
		<div class="w-px h-6 bg-gray-300 mx-1"></div>
		
		<button
			type="button"
			onclick={() => toggleFormat('scripture')}
			class="p-1.5 rounded hover:bg-gray-200 transition-colors {isActive.scripture ? 'bg-teal-200 text-teal-700' : 'text-gray-600'}"
			title="Scripture (Ctrl+S)"
		>
			<BookOpen class="w-4 h-4" />
		</button>
		
		<button
			type="button"
			onclick={() => toggleFormat('quote')}
			class="p-1.5 rounded hover:bg-gray-200 transition-colors {isActive.quote ? 'bg-blue-200 text-blue-700' : 'text-gray-600'}"
			title="Quote (Ctrl+Q)"
		>
			<Quote class="w-4 h-4" />
		</button>
		
		<div class="w-px h-6 bg-gray-300 mx-1"></div>
		
		<button
			type="button"
			onclick={() => execCommand('undo')}
			class="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600"
			title="Undo (Ctrl+Z)"
		>
			<Undo class="w-4 h-4" />
		</button>
		
		<button
			type="button"
			onclick={() => execCommand('redo')}
			class="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-600"
			title="Redo (Ctrl+Y)"
		>
			<Redo class="w-4 h-4" />
		</button>
		
		<div class="flex-1"></div>
		
		<div class="text-xs text-gray-500">
			Ctrl+B/I/S/Q for formatting
		</div>
	</div>
	
	<!-- Editor -->
	<div
		bind:this={editor}
		contenteditable="true"
		class="min-h-[120px] p-3 border border-gray-300 rounded-b-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none {className}"
		oninput={handleInput}
		onkeydown={handleKeyDown}
		data-placeholder={placeholder}
	></div>
</div>

<style>
	[contenteditable]:empty:before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
	}
	
	/* Custom formatting styles */
	:global(.rich-text-container [data-format="scripture"]) {
		@apply text-teal-700 font-medium bg-teal-50 px-1 rounded;
	}
	
	:global(.rich-text-container [data-format="quote"]) {
		@apply text-blue-700 italic bg-blue-50 px-1 rounded;
	}
	
	:global(.rich-text-container strong),
	:global(.rich-text-container b) {
		@apply font-bold;
	}
	
	:global(.rich-text-container em),
	:global(.rich-text-container i) {
		@apply italic;
	}
</style>