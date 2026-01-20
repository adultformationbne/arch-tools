<script>
	import Modal from './Modal.svelte';
	import { Save } from '$lib/icons';

	let {
		isOpen = false,
		module = null,
		courseId,
		courseSlug,
		onClose = () => {},
		onSave = () => {}
	} = $props();

	// Determine if we're editing or creating
	const isEditing = $derived(module !== null);

	// Form state
	let name = $state('');
	let description = $state('');
	let orderNumber = $state(1);
	let sessionCount = $state(8);
	let saving = $state(false);
	let error = $state('');

	// Populate form when modal opens with existing module data
	$effect(() => {
		if (isOpen && module) {
			name = module.name || '';
			description = module.description || '';
			orderNumber = module.order_number || 1;
			// Session count is read-only when editing
			sessionCount = module.sessions?.[0]?.count || 8;
		} else if (isOpen && !module) {
			// Reset form for new module
			name = '';
			description = '';
			orderNumber = 1;
			sessionCount = 8;
			error = '';
		}
	});

	async function handleSubmit() {
		// Validation
		if (!name.trim()) {
			error = 'Module name is required';
			return;
		}

		if (!courseId) {
			error = 'Course ID is missing';
			return;
		}

		saving = true;
		error = '';

		try {
			const payload = {
				action: isEditing ? 'update_module' : 'create_module',
				moduleId: module?.id,
				courseId: courseId,
				name: name.trim(),
				description: description.trim(),
				orderNumber: orderNumber
			};

			// Only include sessionCount when creating (not editing)
			if (!isEditing) {
				payload.sessionCount = sessionCount;
			}

			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to save module');
			}

			// Call parent callback with new/updated module
			onSave(result.data);

			// Close modal
			onClose();
		} catch (err) {
			console.error('Error saving module:', err);
			error = err.message || 'Failed to save module';
		} finally {
			saving = false;
		}
	}

	function handleClose() {
		if (!saving) {
			error = '';
			onClose();
		}
	}
</script>

<Modal {isOpen} onClose={handleClose} title={isEditing ? 'Edit Module' : 'Create Module'} size="md">
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
		<!-- Module Name -->
		<div>
			<label for="module-name" class="block text-sm font-semibold mb-2 text-gray-700">
				Module Name *
			</label>
			<input
				id="module-name"
				type="text"
				bind:value={name}
				placeholder="e.g., Foundations of Faith"
				required
				class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
			/>
		</div>

		<!-- Description -->
		<div>
			<label for="module-description" class="block text-sm font-semibold mb-2 text-gray-700">
				Description
			</label>
			<textarea
				id="module-description"
				bind:value={description}
				placeholder="Brief description of the module content and objectives..."
				rows="4"
				class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
			></textarea>
		</div>

		<!-- Order Number -->
		<div>
			<label for="module-order" class="block text-sm font-semibold mb-2 text-gray-700">
				Order Number
			</label>
			<input
				id="module-order"
				type="number"
				bind:value={orderNumber}
				min="1"
				required
				class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
			/>
			<p class="text-sm text-gray-500 mt-1">Display order in the course curriculum</p>
		</div>

		<!-- Session Count (only when creating) -->
		{#if !isEditing}
			<div>
				<label for="session-count" class="block text-sm font-semibold mb-2 text-gray-700">
					Number of Sessions *
				</label>
				<input
					id="session-count"
					type="number"
					bind:value={sessionCount}
					min="1"
					max="52"
					required
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
				/>
				<p class="text-sm text-gray-500 mt-1">
					Empty session placeholders will be created (typically 8 for ACCF modules)
				</p>
			</div>
		{/if}

		<!-- Error Message -->
		{#if error}
			<div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
				{error}
			</div>
		{/if}

		<!-- Actions -->
		<div class="flex justify-end gap-3 pt-4">
			<button
				type="button"
				onclick={handleClose}
				disabled={saving}
				class="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={saving}
				class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
			>
				<Save size={18} />
				{saving ? 'Saving...' : isEditing ? 'Update Module' : 'Create Module'}
			</button>
		</div>
	</form>
</Modal>
