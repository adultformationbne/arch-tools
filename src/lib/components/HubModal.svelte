<script>
	import Modal from './Modal.svelte';
	import { Save } from '$lib/icons';

	let {
		isOpen = false,
		hub = null,
		courseId,
		courseSlug,
		onClose = () => {},
		onSave = () => {}
	} = $props();

	const isEditing = $derived(hub !== null);

	// Form state
	let name = $state('');
	let location = $state('');
	let saving = $state(false);
	let error = $state('');

	// Populate form when modal opens
	$effect(() => {
		if (isOpen && hub) {
			name = hub.name || '';
			location = hub.location || '';
		} else if (isOpen && !hub) {
			name = '';
			location = '';
			error = '';
		}
	});

	async function handleSubmit() {
		if (!name.trim()) {
			error = 'Hub name is required';
			return;
		}

		if (!courseId) {
			error = 'Course ID is missing';
			return;
		}

		saving = true;
		error = '';

		try {
			const response = await fetch('/admin/courses/' + courseSlug + '/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: isEditing ? 'update_hub' : 'create_hub',
					hubId: hub?.id,
					courseId: courseId,
					name: name.trim(),
					location: location.trim()
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to save hub');
			}

			onSave(result.data);
			onClose();
		} catch (err) {
			console.error('Error saving hub:', err);
			error = err.message || 'Failed to save hub';
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

<Modal {isOpen} onClose={handleClose} title={isEditing ? 'Edit Hub' : 'Create Hub'} size="md">
	<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
		<!-- Hub Name -->
		<div>
			<label for="hub-name" class="block text-sm font-semibold mb-2 text-gray-700">
				Hub Name *
			</label>
			<input
				id="hub-name"
				type="text"
				bind:value={name}
				placeholder="e.g., St. Mary's Parish"
				required
				class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
			/>
		</div>

		<!-- Location -->
		<div>
			<label for="hub-location" class="block text-sm font-semibold mb-2 text-gray-700">
				Location
			</label>
			<input
				id="hub-location"
				type="text"
				bind:value={location}
				placeholder="e.g., 123 Main St, City, State"
				class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
			/>
			<p class="text-sm text-gray-500 mt-1">Physical address or meeting location</p>
		</div>

		<!-- Info about coordinators -->
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
			<strong>Note:</strong> Coordinators can be assigned after creating the hub. Expand any hub row and click "Add" to assign coordinators.
		</div>

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
				{saving ? 'Saving...' : isEditing ? 'Update Hub' : 'Create Hub'}
			</button>
		</div>
	</form>
</Modal>
