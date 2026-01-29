<script>
	/**
	 * Fallback plain text editor when TipTap fails to load.
	 * Provides basic HTML editing via contenteditable.
	 */
	let {
		value = '',
		onchange = (html) => {},
		placeholder = 'Write your content...'
	} = $props();

	let editorElement = $state(null);
	let internalValue = $state('');

	// Initialize from prop
	$effect(() => {
		if (!internalValue && value) {
			internalValue = value;
		}
	});

	// Sync external value changes
	$effect(() => {
		if (value !== internalValue && editorElement) {
			internalValue = value;
			editorElement.innerHTML = value;
		}
	});

	function handleInput(e) {
		internalValue = e.target.innerHTML;
		onchange(internalValue);
	}

	function handlePaste(e) {
		e.preventDefault();
		const text = e.clipboardData.getData('text/plain');
		document.execCommand('insertText', false, text);
	}

	// Basic formatting commands
	export function toggleBold() {
		document.execCommand('bold', false, null);
		onchange(editorElement?.innerHTML || '');
	}

	export function toggleItalic() {
		document.execCommand('italic', false, null);
		onchange(editorElement?.innerHTML || '');
	}

	export function insertLink(url) {
		document.execCommand('createLink', false, url);
		onchange(editorElement?.innerHTML || '');
	}
</script>

<div class="fallback-editor-wrapper">
	<div class="fallback-notice">
		<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
		<span>Using basic editor (rich editor unavailable)</span>
	</div>

	<div
		bind:this={editorElement}
		contenteditable="true"
		class="fallback-editor"
		oninput={handleInput}
		onpaste={handlePaste}
		data-placeholder={placeholder}
	>
		{@html value}
	</div>
</div>

<style>
	.fallback-editor-wrapper {
		width: 100%;
	}

	.fallback-notice {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		background: #fef3c7;
		border: 1px solid #fbbf24;
		border-radius: 6px 6px 0 0;
		font-size: 12px;
		color: #92400e;
	}

	.fallback-editor {
		min-height: 200px;
		padding: 16px;
		border: 1px solid #d1d5db;
		border-top: none;
		border-radius: 0 0 6px 6px;
		background: white;
		outline: none;
		font-size: 14px;
		line-height: 1.6;
	}

	.fallback-editor:empty:before {
		content: attr(data-placeholder);
		color: #9ca3af;
		pointer-events: none;
	}

	.fallback-editor:focus {
		border-color: #6366f1;
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
	}
</style>
