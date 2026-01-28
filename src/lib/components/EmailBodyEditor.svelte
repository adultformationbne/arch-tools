<script>
	import { onMount, onDestroy } from 'svelte';
	import { Zap, SquareMousePointer, Braces, AlertCircle, Image, Loader2 } from '$lib/icons';
	import EmailPreviewFrame from './EmailPreviewFrame.svelte';
	import FallbackTextEditor from './FallbackTextEditor.svelte';
	import { createDropdown } from '$lib/utils/dropdown.js';
	import { toastError } from '$lib/utils/toast-helpers.js';

	// Dynamic import for TipTap - allows graceful fallback
	let TipTapEmailEditor = $state(null);
	let editorLoadError = $state(null);
	let editorLoading = $state(true);

	onMount(async () => {
		try {
			const module = await import('./TipTapEmailEditor.svelte');
			TipTapEmailEditor = module.default;
		} catch (err) {
			console.warn('TipTap editor failed to load:', err.message);
			editorLoadError = err;
		} finally {
			editorLoading = false;
		}
	});

	/**
	 * Shared email body editor with sidebar toolbar, branded preview frame, and variable picker.
	 * Used by both SendEmailView (edit mode) and EmailTemplateEditor.
	 */
	let {
		value = '',
		onchange = () => {},
		placeholder = 'Write your email message...',
		brandName = 'Course Name',
		logoUrl = null,
		accentDark = '#334642',
		footerText = "You're receiving this because you're enrolled in this course.",
		availableVariables = [],
		// Image upload context
		context = 'course', // 'course', 'dgr', 'platform'
		contextId = null, // course ID if context is 'course'
		// Backwards compatibility
		courseName = null
	} = $props();

	// Use courseName if provided (backwards compatibility)
	const displayName = $derived(courseName || brandName);

	// Editor references (exposed for parent components)
	let editorComponent = $state(null);
	let tiptapEditor = $state(null);
	let hasTextSelection = $state(false);

	// Variable picker dropdown
	let variableButtonEl = $state(null);
	let variableMenuEl = $state(null);
	let dropdown = $state(null);

	// Image upload
	let imageFileInput = $state(null);
	let isUploadingImage = $state(false);

	// Initialize dropdown when elements are ready
	$effect(() => {
		if (variableButtonEl && variableMenuEl && !dropdown) {
			dropdown = createDropdown(variableButtonEl, variableMenuEl, {
				placement: 'right-start',
				offset: 8
			});
		}
	});

	onDestroy(() => {
		if (dropdown) dropdown.destroy();
	});

	// Expose editor references
	export function getEditor() {
		return tiptapEditor;
	}

	export function getEditorComponent() {
		return editorComponent;
	}

	function handleInsertVariable(variableName) {
		if (!tiptapEditor) return;
		if (dropdown) dropdown.hide();
		tiptapEditor
			.chain()
			.focus()
			.insertContent([
				{
					type: 'variable',
					attrs: {
						id: variableName,
						label: variableName
					}
				},
				{
					type: 'text',
					text: ' '
				}
			])
			.run();
	}

	function triggerImageUpload() {
		imageFileInput?.click();
	}

	async function handleImageUpload(event) {
		const file = event.target.files?.[0];
		if (!file || !tiptapEditor) return;

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!allowedTypes.includes(file.type)) {
			toastError('Please select a JPEG, PNG, GIF, or WebP image');
			return;
		}

		// Validate file size (5MB max before processing)
		if (file.size > 5 * 1024 * 1024) {
			toastError('Image must be less than 5MB');
			return;
		}

		isUploadingImage = true;

		try {
			const formData = new FormData();
			formData.append('image', file);
			formData.append('context', context);
			if (contextId) {
				formData.append('context_id', contextId);
			}

			const response = await fetch('/api/emails/upload-image', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Failed to upload image');
			}

			const result = await response.json();

			// Insert the image into the editor
			tiptapEditor
				.chain()
				.focus()
				.setImage({
					src: result.url,
					alt: file.name,
					title: file.name
				})
				.run();
		} catch (err) {
			console.error('Image upload error:', err);
			toastError(err.message || 'Failed to upload image');
		} finally {
			isUploadingImage = false;
			// Reset file input
			if (imageFileInput) {
				imageFileInput.value = '';
			}
		}
	}
</script>

<div class="space-y-4">
	<!-- Editor with sidebar toolbar -->
	<div class="bg-gray-100 rounded-xl p-8 flex justify-center gap-4">
		<!-- Side Toolbar (only shown when TipTap is available) -->
		{#if TipTapEmailEditor && !editorLoadError}
		<div
			class="flex flex-col items-center gap-1 p-2 rounded-lg w-14 h-fit sticky top-8 transition-all duration-200 {hasTextSelection ? 'scale-105 shadow-xl bg-white border-2' : 'bg-gray-50 border border-gray-200'}"
			style={hasTextSelection ? `border-color: ${accentDark}` : ''}
		>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().toggleBold().run()}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Bold"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
			</button>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().toggleItalic().run()}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Italic"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4h-9M14 20H5M15 4L9 20"/></svg>
			</button>
			<div class="w-full h-px bg-gray-300 my-1"></div>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().setParagraph().run()}
				class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
				title="Paragraph"
			>
				P
			</button>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().toggleHeading({ level: 1 }).run()}
				class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
				title="Heading 1"
			>
				H1
			</button>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
				class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
				title="Heading 2"
			>
				H2
			</button>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().toggleHeading({ level: 3 }).run()}
				class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
				title="Heading 3"
			>
				H3
			</button>
			<div class="w-full h-px bg-gray-300 my-1"></div>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().toggleBulletList().run()}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Bullet List"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
			</button>
			<button
				type="button"
				onclick={() => tiptapEditor?.chain().focus().toggleOrderedList().run()}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Numbered List"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
			</button>
			<div class="w-full h-px bg-gray-300 my-1"></div>
			<button
				type="button"
				onclick={(e) => { if (hasTextSelection) editorComponent?.openLinkModal(e.currentTarget); }}
				disabled={!hasTextSelection}
				class="p-2 rounded transition-colors {hasTextSelection ? 'hover:bg-gray-200 text-gray-700' : 'text-gray-300 cursor-not-allowed opacity-50'}"
				title={hasTextSelection ? "Add Link" : "Select text to add link"}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
			</button>
			<button
				type="button"
				onclick={(e) => editorComponent?.openButtonModal(e.currentTarget)}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Insert Button"
			>
				<SquareMousePointer size={18} />
			</button>
			<button
				type="button"
				onclick={triggerImageUpload}
				disabled={isUploadingImage}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700 disabled:opacity-50"
				title="Insert Image"
			>
				{#if isUploadingImage}
					<Loader2 size={18} class="animate-spin" />
				{:else}
					<Image size={18} />
				{/if}
			</button>
			<div class="w-full h-px bg-gray-300 my-1"></div>
			<!-- Variable Picker Dropdown -->
			<button
				bind:this={variableButtonEl}
				type="button"
				onclick={() => dropdown?.toggle()}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Insert Variable"
			>
				<Braces size={18} />
			</button>
		</div>

		<!-- Variable Picker Menu (hidden, positioned by dropdown.js) -->
		<div
			bind:this={variableMenuEl}
			class="w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 max-h-80 overflow-y-auto hidden"
		>
			<div class="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
				Insert Variable
			</div>
			{#each availableVariables as variable}
				<button
					type="button"
					onclick={() => handleInsertVariable(variable.name)}
					class="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
				>
					{#if variable.dynamic}
						<Zap size={12} class="text-amber-500 flex-shrink-0" />
					{/if}
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium text-gray-900 font-mono">{`{{${variable.name}}}`}</div>
						<div class="text-xs text-gray-500 truncate">{variable.description}</div>
					</div>
				</button>
			{/each}
		</div>
		{/if}

		<!-- Email Preview Frame with Editor -->
		<EmailPreviewFrame
			brandName={displayName}
			{logoUrl}
			{accentDark}
			{footerText}
			withContainer={false}
			headerPadding="py-12 px-8"
		>
			{#if editorLoading}
				<div class="flex items-center justify-center py-12 text-gray-500">
					<div class="animate-spin w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full mr-2"></div>
					Loading editor...
				</div>
			{:else if TipTapEmailEditor && !editorLoadError}
				<svelte:component
					this={TipTapEmailEditor}
					bind:this={editorComponent}
					bind:editor={tiptapEditor}
					bind:hasSelection={hasTextSelection}
					{value}
					{onchange}
					{placeholder}
					{availableVariables}
					accentColor={accentDark}
					{context}
					{contextId}
					hideVariablePicker={true}
					showFixedToolbar={false}
					verticalToolbar={false}
				/>
			{:else}
				<!-- Fallback editor when TipTap fails -->
				<FallbackTextEditor
					{value}
					{onchange}
					{placeholder}
				/>
			{/if}
		</EmailPreviewFrame>
	</div>

	<!-- Variable Picker Pills -->
	<div class="p-4 bg-white border border-gray-300 rounded-lg">
		<p class="text-xs font-semibold text-gray-700 mb-3">
			Click to insert variable
			<span class="ml-2 text-gray-500 font-normal inline-flex items-center gap-1">
				<Zap size={12} class="text-amber-500" /> = Context-dependent (only populated in specific emails)
			</span>
		</p>

		<div class="flex flex-wrap gap-2">
			{#each availableVariables as variable}
				<button
					type="button"
					onclick={() => handleInsertVariable(variable.name)}
					class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:scale-105"
					class:variable-picker-pill={!variable.dynamic}
					class:variable-picker-pill-dynamic={variable.dynamic}
					title={variable.description}
				>
					{#if variable.dynamic}
						<Zap size={12} class="text-amber-500" />
					{/if}
					{variable.name}
				</button>
			{/each}
		</div>
	</div>
<!-- Hidden file input for image uploads -->
	<input
		type="file"
		accept="image/jpeg,image/png,image/gif,image/webp"
		bind:this={imageFileInput}
		onchange={handleImageUpload}
		class="hidden"
	/>
</div>

<style>
	/* Variable picker pills - always available */
	.variable-picker-pill {
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.variable-picker-pill:hover {
		background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
		color: #6b21a8;
		border-color: #a855f7;
	}

	/* Variable picker pills - context-dependent */
	.variable-picker-pill-dynamic {
		background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
		color: #78350f;
		border: 1px solid #fbbf24;
	}

	.variable-picker-pill-dynamic:hover {
		background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
		color: #78350f;
		border-color: #f59e0b;
	}
</style>
