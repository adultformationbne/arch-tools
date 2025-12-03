<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { X, Save, Eye, Mail } from 'lucide-svelte';
	import TipTapEmailEditor from './TipTapEmailEditor.svelte';

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

	// Sync template data when it changes
	$effect(() => {
		if (template) {
			subjectTemplate = template.subject_template || '';
			bodyTemplate = template.body_template || '';
		}
	});

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
		onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}
		onkeydown={(e) => { if (e.key === 'Escape') onClose(); }}
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
						onclick={onClose}
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

						<!-- Body Editor -->
						<div>
							<label class="mb-1 block text-sm font-medium text-gray-700">
								Email Body
							</label>
							<div class="overflow-hidden rounded-lg border border-gray-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200">
								<TipTapEmailEditor
									value={bodyTemplate}
									onchange={handleBodyChange}
									{availableVariables}
									showFixedToolbar={true}
									placeholder="Write your email content..."
									bind:editor
								/>
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
			<div class="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
				<button
					onclick={onClose}
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
{/if}
