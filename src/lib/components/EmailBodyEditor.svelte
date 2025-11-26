<script>
	import { Zap, SquareMousePointer } from 'lucide-svelte';
	import TipTapEmailEditor from './TipTapEmailEditor.svelte';
	import EmailPreviewFrame from './EmailPreviewFrame.svelte';

	/**
	 * Shared email body editor with sidebar toolbar, branded preview frame, and variable picker.
	 * Used by both SendEmailView (edit mode) and EmailTemplateEditor.
	 */
	let {
		value = '',
		onchange = () => {},
		placeholder = 'Write your email message...',
		courseName = 'Course Name',
		logoUrl = null,
		accentDark = '#334642',
		availableVariables = []
	} = $props();

	// Editor references (exposed for parent components)
	let editorComponent = $state(null);
	let tiptapEditor = $state(null);
	let hasTextSelection = $state(false);

	// Expose editor references
	export function getEditor() {
		return tiptapEditor;
	}

	export function getEditorComponent() {
		return editorComponent;
	}

	function handleInsertVariable(variableName) {
		if (!tiptapEditor) return;
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
</script>

<div class="space-y-4">
	<!-- Editor with sidebar toolbar -->
	<div class="bg-gray-100 rounded-xl p-8 flex justify-center gap-4">
		<!-- Side Toolbar -->
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
				onclick={(e) => editorComponent?.openLinkModal(e.currentTarget)}
				class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
				title="Add Link"
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
		</div>

		<!-- Email Preview Frame with Editor -->
		<EmailPreviewFrame
			{courseName}
			logoUrl={logoUrl}
			accentDark={accentDark}
			withContainer={false}
			headerPadding="py-12 px-8"
		>
			<TipTapEmailEditor
				bind:this={editorComponent}
				bind:editor={tiptapEditor}
				bind:hasSelection={hasTextSelection}
				{value}
				{onchange}
				{placeholder}
				{availableVariables}
				hideVariablePicker={true}
				showFixedToolbar={false}
				verticalToolbar={false}
			/>
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
