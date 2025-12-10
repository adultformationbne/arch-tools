<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { X, Save, Eye, Mail, SquareMousePointer } from 'lucide-svelte';
	import TipTapEmailEditor from './TipTapEmailEditor.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';

	let {
		show = false,
		template = null,
		onClose = () => {},
		onSave = () => {}
	} = $props();

	let saving = $state(false);
	let subjectTemplate = $state('');
	let bodyTemplate = $state('');
	let showPreview = $state(false);
	let editor = $state(null);
	let editorComponent = $state(null);
	let hasTextSelection = $state(false);
	let showCloseConfirmation = $state(false);

	// Track original values for dirty checking
	let originalSubject = $state('');
	let originalBody = $state('');

	// Dirty state detection
	let isDirty = $derived(
		subjectTemplate !== originalSubject || bodyTemplate !== originalBody
	);

	// Sync template data when it changes
	$effect(() => {
		if (template) {
			subjectTemplate = template.subject_template || '';
			bodyTemplate = template.body_template || '';
			// Store originals for dirty checking
			originalSubject = template.subject_template || '';
			originalBody = template.body_template || '';
		}
	});

	// Handle close with dirty check
	function handleClose() {
		if (isDirty) {
			showCloseConfirmation = true;
		} else {
			onClose();
		}
	}

	function confirmClose() {
		showCloseConfirmation = false;
		onClose();
	}

	// Convert available_variables from DB format to TipTap format
	let availableVariables = $derived(
		(template?.available_variables || []).map(v => ({
			name: v.key,
			description: v.description,
			category: 'Variables'
		}))
	);

	// Preview with sample data
	let previewHtml = $derived(() => {
		if (!bodyTemplate) return '';

		const sampleData = {
			contributor_name: 'John Smith',
			contributor_email: 'john.smith@example.com',
			write_url: 'https://app.example.com/dgr/write/abc123'
		};

		let html = bodyTemplate;
		for (const [key, value] of Object.entries(sampleData)) {
			html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
		}
		return html;
	});

	let previewSubject = $derived(() => {
		if (!subjectTemplate) return '';

		const sampleData = {
			contributor_name: 'John Smith',
			due_date_text: 'tomorrow'
		};

		let subject = subjectTemplate;
		for (const [key, value] of Object.entries(sampleData)) {
			subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
		}
		return subject;
	});

	async function handleSave() {
		if (!template?.id) return;

		saving = true;
		try {
			const response = await fetch('/api/dgr/templates', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: template.id,
					subject_template: subjectTemplate,
					body_template: bodyTemplate
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Template Saved',
				message: 'Your changes have been saved',
				duration: 3000
			});

			onSave(data.template);
			onClose();
		} catch (error) {
			toast.error({
				title: 'Save Failed',
				message: error.message,
				duration: 4000
			});
		} finally {
			saving = false;
		}
	}

	function handleBodyChange(html) {
		bodyTemplate = html;
	}
</script>

{#if show && template}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
		onkeydown={(e) => { if (e.key === 'Escape') handleClose(); }}
		role="dialog"
		aria-modal="true"
		tabindex="0"
	>
		<div class="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
						<Mail class="h-5 w-5 text-purple-600" />
					</div>
					<div>
						<h2 class="text-lg font-semibold text-gray-900">{template.name}</h2>
						<p class="text-sm text-gray-500">{template.description}</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={() => showPreview = !showPreview}
						class="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						<Eye class="h-4 w-4" />
						{showPreview ? 'Edit' : 'Preview'}
					</button>
					<button
						onclick={handleClose}
						class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
					>
						<X class="h-5 w-5" />
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto">
				{#if showPreview}
					<!-- Preview Mode -->
					<div class="p-6">
						<div class="mb-4">
							<label class="mb-1 block text-sm font-medium text-gray-500">Subject Preview</label>
							<div class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900">
								{previewSubject()}
							</div>
						</div>
						<div>
							<label class="mb-1 block text-sm font-medium text-gray-500">Body Preview</label>
							<div class="prose max-w-none rounded-lg border border-gray-200 bg-white p-6">
								{@html previewHtml()}
							</div>
						</div>
					</div>
				{:else}
					<!-- Edit Mode -->
					<div class="space-y-6 p-6">
						<!-- Subject Line -->
						<div>
							<label for="subject" class="mb-1 block text-sm font-medium text-gray-700">
								Subject Line
							</label>
							<input
								id="subject"
								type="text"
								bind:value={subjectTemplate}
								class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none"
								placeholder="Email subject..."
							/>
							<p class="mt-1 text-xs text-gray-500">
								Use {'{{variable_name}}'} to insert dynamic content
							</p>
						</div>

						<!-- Body Editor with Sticky Sidebar Toolbar -->
						<div>
							<label class="mb-1 block text-sm font-medium text-gray-700">
								Email Body
							</label>
							<div class="bg-gray-100 rounded-xl p-6 flex justify-center gap-4">
								<!-- Sticky Side Toolbar -->
								<div
									class="flex flex-col items-center gap-1 p-2 rounded-lg w-14 h-fit sticky top-4 transition-all duration-200 {hasTextSelection ? 'scale-105 shadow-xl bg-white border-2 border-purple-500' : 'bg-gray-50 border border-gray-200'}"
								>
									<button
										type="button"
										onclick={() => editor?.chain().focus().toggleBold().run()}
										class="p-2 rounded transition-colors {editor?.isActive('bold') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'}"
										title="Bold"
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
									</button>
									<button
										type="button"
										onclick={() => editor?.chain().focus().toggleItalic().run()}
										class="p-2 rounded transition-colors {editor?.isActive('italic') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'}"
										title="Italic"
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4h-9M14 20H5M15 4L9 20"/></svg>
									</button>
									<div class="w-full h-px bg-gray-300 my-1"></div>
									<button
										type="button"
										onclick={() => editor?.chain().focus().setParagraph().run()}
										class="px-2 py-2 rounded transition-colors text-xs font-semibold {editor?.isActive('paragraph') && !editor?.isActive('heading') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'}"
										title="Paragraph"
									>
										P
									</button>
									<button
										type="button"
										onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
										class="px-2 py-2 rounded transition-colors text-xs font-semibold {editor?.isActive('heading', { level: 1 }) ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'}"
										title="Heading 1"
									>
										H1
									</button>
									<button
										type="button"
										onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
										class="px-2 py-2 rounded transition-colors text-xs font-semibold {editor?.isActive('heading', { level: 2 }) ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'}"
										title="Heading 2"
									>
										H2
									</button>
									<div class="w-full h-px bg-gray-300 my-1"></div>
									<button
										type="button"
										onclick={() => editor?.chain().focus().toggleBulletList().run()}
										class="p-2 rounded transition-colors {editor?.isActive('bulletList') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'}"
										title="Bullet List"
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
									</button>
									<button
										type="button"
										onclick={() => editor?.chain().focus().toggleOrderedList().run()}
										class="p-2 rounded transition-colors {editor?.isActive('orderedList') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'}"
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

								<!-- Editor Area -->
								<div class="flex-1 max-w-2xl bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
									<TipTapEmailEditor
										bind:this={editorComponent}
										bind:editor
										bind:hasSelection={hasTextSelection}
										value={bodyTemplate}
										onchange={handleBodyChange}
										{availableVariables}
										showFixedToolbar={false}
										hideVariablePicker={true}
										placeholder="Write your email content..."
									/>
								</div>
							</div>
						</div>

						<!-- Available Variables Reference -->
						<div class="rounded-lg bg-gray-50 p-4">
							<h4 class="mb-2 text-sm font-medium text-gray-700">Available Variables</h4>
							<div class="flex flex-wrap gap-2">
								{#each template.available_variables || [] as variable}
									<div class="rounded bg-white px-2 py-1 text-xs shadow-sm">
										<code class="font-mono text-purple-600">{`{{${variable.key}}}`}</code>
										<span class="ml-1 text-gray-500">- {variable.description}</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between border-t border-gray-200 px-6 py-4">
				<div>
					{#if isDirty}
						<span class="text-sm text-amber-600 font-medium">● Unsaved changes</span>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					<button
						onclick={handleClose}
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						onclick={handleSave}
						disabled={saving}
						class="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
					>
						<Save class="h-4 w-4" />
						{saving ? 'Saving...' : 'Save Template'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<ConfirmationModal
	show={showCloseConfirmation}
	title="Discard changes?"
	confirmText="Discard"
	cancelText="Keep Editing"
	onConfirm={confirmClose}
	onCancel={() => showCloseConfirmation = false}
>
	<p>You have unsaved changes that will be lost if you close this editor.</p>
</ConfirmationModal>
