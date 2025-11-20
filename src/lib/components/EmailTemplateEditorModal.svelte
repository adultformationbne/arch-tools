<script>
	import { X, Plus, Info, Sparkles } from 'lucide-svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { apiPost, apiPut, apiGet } from '$lib/utils/api-handler.js';
	import { toastError } from '$lib/utils/toast-helpers.js';

	let { show = false, template = null, course, courseSlug, onClose, onSave } = $props();

	const isEditing = $derived(template !== null);
	const isSystem = $derived(template?.category === 'system');

	// Form state
	let formData = $state({
		template_key: '',
		name: '',
		description: '',
		subject_template: '',
		body_template: '',
		available_variables: []
	});

	// Available variables from API
	let variables = $state([]);
	let loadingVariables = $state(false);

	// Reset form when template changes
	$effect(() => {
		if (show) {
			if (template) {
				// Edit mode
				formData = {
					template_key: template.template_key || '',
					name: template.name || '',
					description: template.description || '',
					subject_template: template.subject_template || '',
					body_template: template.body_template || '',
					available_variables: template.available_variables || []
				};
			} else {
				// Create mode
				formData = {
					template_key: '',
					name: '',
					description: '',
					subject_template: '',
					body_template: '',
					available_variables: []
				};
			}

			// Load variables if not loaded
			if (variables.length === 0) {
				loadVariables();
			}
		}
	});

	async function loadVariables() {
		loadingVariables = true;
		try {
			const result = await apiGet(`/api/courses/${courseSlug}/email-variables`);
			if (result && result.variables) {
				variables = result.variables.all || [];
			}
		} catch (error) {
			console.error('Failed to load variables:', error);
		} finally {
			loadingVariables = false;
		}
	}

	function insertVariable(variableName) {
		// Insert at cursor position in body_template
		const textarea = document.getElementById('body_template');
		if (textarea) {
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const text = formData.body_template;
			const before = text.substring(0, start);
			const after = text.substring(end);

			formData.body_template = before + `{{${variableName}}}` + after;

			// Set cursor after inserted variable
			setTimeout(() => {
				textarea.selectionStart = textarea.selectionEnd = start + variableName.length + 4;
				textarea.focus();
			}, 0);

			// Add to available_variables if not already there
			if (!formData.available_variables.includes(variableName)) {
				formData.available_variables = [...formData.available_variables, variableName];
			}
		}
	}

	function insertVariableInSubject(variableName) {
		// Insert at cursor position in subject_template
		const input = document.getElementById('subject_template');
		if (input) {
			const start = input.selectionStart;
			const end = input.selectionEnd;
			const text = formData.subject_template;
			const before = text.substring(0, start);
			const after = text.substring(end);

			formData.subject_template = before + `{{${variableName}}}` + after;

			// Set cursor after inserted variable
			setTimeout(() => {
				input.selectionStart = input.selectionEnd = start + variableName.length + 4;
				input.focus();
			}, 0);

			// Add to available_variables if not already there
			if (!formData.available_variables.includes(variableName)) {
				formData.available_variables = [...formData.available_variables, variableName];
			}
		}
	}

	let saving = $state(false);

	async function handleSave() {
		// Validation
		if (!formData.name?.trim()) {
			toastError('Template name is required', 'Validation Error');
			return;
		}

		if (!formData.subject_template?.trim()) {
			toastError('Subject template is required', 'Validation Error');
			return;
		}

		if (!formData.body_template?.trim()) {
			toastError('Body template is required', 'Validation Error');
			return;
		}

		if (!isEditing && !formData.template_key?.trim()) {
			toastError('Template key is required', 'Validation Error');
			return;
		}

		saving = true;

		try {
			if (isEditing) {
				// Update existing template
				await apiPut(`/api/courses/${courseSlug}/emails`, {
					template_id: template.id,
					name: formData.name,
					description: formData.description,
					subject_template: formData.subject_template,
					body_template: formData.body_template,
					available_variables: formData.available_variables
				}, {
					successMessage: 'Template updated successfully'
				});
			} else {
				// Create new template
				await apiPost(`/api/courses/${courseSlug}/emails`, {
					template_key: formData.template_key,
					name: formData.name,
					description: formData.description,
					subject_template: formData.subject_template,
					body_template: formData.body_template,
					available_variables: formData.available_variables
				}, {
					successMessage: 'Template created successfully'
				});
			}

			onSave();
		} catch (error) {
			// Error already shown by api helper
			console.error('Save failed:', error);
		} finally {
			saving = false;
		}
	}

	// Group variables by category for display
	const variablesByCategory = $derived(() => {
		const grouped = {};
		variables.forEach(v => {
			if (!grouped[v.category]) {
				grouped[v.category] = [];
			}
			grouped[v.category].push(v);
		});
		return grouped;
	});
</script>

<Modal {show} onClose={onClose} title={isEditing ? 'Edit Template' : 'Create Template'} size="xl">
	<div class="space-y-6">
		<!-- Template Key (only for new templates) -->
		{#if !isEditing}
			<div>
				<label for="template_key" class="block text-sm font-medium text-gray-700 mb-1">
					Template Key <span class="text-red-500">*</span>
				</label>
				<input
					id="template_key"
					type="text"
					bind:value={formData.template_key}
					placeholder="e.g., session_date_change"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
					style="focus:ring-color: var(--course-accent-dark);"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Unique identifier (lowercase, underscores only)
				</p>
			</div>
		{/if}

		<!-- Template Name -->
		<div>
			<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
				Name <span class="text-red-500">*</span>
			</label>
			<input
				id="name"
				type="text"
				bind:value={formData.name}
				placeholder="e.g., Session Date Change Notification"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
				style="focus:ring-color: var(--course-accent-dark);"
			/>
		</div>

		<!-- Description -->
		<div>
			<label for="description" class="block text-sm font-medium text-gray-700 mb-1">
				Description
			</label>
			<textarea
				id="description"
				bind:value={formData.description}
				placeholder="When and why this template should be used..."
				rows="2"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
				style="focus:ring-color: var(--course-accent-dark);"
			></textarea>
		</div>

		<!-- Subject Template -->
		<div>
			<div class="flex items-center justify-between mb-1">
				<label for="subject_template" class="block text-sm font-medium text-gray-700">
					Subject <span class="text-red-500">*</span>
				</label>
				<button
					type="button"
					onclick={() => { /* Show variable picker for subject */ }}
					class="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100"
					style="color: var(--course-accent-dark);"
				>
					<Sparkles size={12} />
					Insert Variable
				</button>
			</div>
			<input
				id="subject_template"
				type="text"
				bind:value={formData.subject_template}
				placeholder="e.g., Session {{sessionNumber}} Materials Ready"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
				style="focus:ring-color: var(--course-accent-dark);"
			/>
			<p class="text-xs text-gray-500 mt-1">
				Use &#123;&#123;variableName&#125;&#125; for dynamic content
			</p>
		</div>

		<!-- Body Template -->
		<div>
			<label for="body_template" class="block text-sm font-medium text-gray-700 mb-1">
				Body <span class="text-red-500">*</span>
			</label>
			<textarea
				id="body_template"
				bind:value={formData.body_template}
				placeholder="Hi {{firstName}},&#10;&#10;Great news! ..."
				rows="10"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-y font-mono text-sm"
				style="focus:ring-color: var(--course-accent-dark);"
			></textarea>
			<p class="text-xs text-gray-500 mt-1">
				Use &#123;&#123;variableName&#125;&#125; for personalization
			</p>
		</div>

		<!-- Variable Helper -->
		{#if variables.length > 0}
			<div class="border rounded-lg p-4 bg-gray-50">
				<div class="flex items-center gap-2 mb-3">
					<Info size={16} class="text-gray-600" />
					<h4 class="text-sm font-semibold text-gray-900">Available Variables</h4>
				</div>

				<div class="space-y-3">
					{#each Object.entries(variablesByCategory()) as [category, vars]}
						<div>
							<div class="text-xs font-medium text-gray-500 uppercase mb-2">{category}</div>
							<div class="flex flex-wrap gap-2">
								{#each vars as variable}
									<button
										type="button"
										onclick={() => insertVariable(variable.name)}
										class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-white border border-gray-200 hover:border-gray-300 transition-colors"
										title={variable.description}
									>
										<Plus size={12} />
										{variable.name}
									</button>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<p class="text-xs text-gray-600 mt-3">
					Click a variable to insert it at your cursor position
				</p>
			</div>
		{/if}
	</div>

	<!-- Modal Footer -->
	{#snippet footer()}
		<div class="flex items-center justify-end gap-3">
			<button
				type="button"
				onclick={onClose}
				disabled={saving}
				class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={saving}
				class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
				style="background-color: var(--course-accent-dark);"
			>
				{saving ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
			</button>
		</div>
	{/snippet}
</Modal>
