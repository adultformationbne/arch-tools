<script>
	import { X } from 'lucide-svelte';
	import { toast } from '$lib/stores/toast.svelte.js';
	import { DAY_NAMES, getOrdinalSuffix } from '$lib/utils/dgr-helpers';

	let {
		show = false,
		contributor = null,
		onSave = async () => {},
		onClose = () => {}
	} = $props();

	let isSaving = $state(false);

	let editForm = $state({
		name: '',
		email: '',
		title: '',
		notes: '',
		schedule_pattern: null,
		pattern_value: null,
		active: true
	});

	// Sync form when contributor changes
	$effect(() => {
		if (contributor) {
			const pattern = contributor.schedule_pattern;
			editForm = {
				name: contributor.name || '',
				email: contributor.email || '',
				title: contributor.title || '',
				notes: contributor.notes || '',
				schedule_pattern: pattern?.type || null,
				pattern_value: pattern?.value ?? (pattern?.values?.[0] ?? null),
				active: contributor.active ?? true
			};
		}
	});

	async function handleSave() {
		if (!contributor || !editForm.name.trim() || !editForm.email.trim()) {
			toast.error({ title: 'Required Fields', message: 'Name and email are required', duration: 3000 });
			return;
		}

		isSaving = true;
		try {
			// Build schedule_pattern JSON
			let schedule_pattern = null;
			if (editForm.schedule_pattern === 'day_of_month' && editForm.pattern_value !== null) {
				schedule_pattern = { type: 'day_of_month', value: parseInt(editForm.pattern_value) };
			} else if (editForm.schedule_pattern === 'day_of_week' && editForm.pattern_value !== null) {
				schedule_pattern = { type: 'day_of_week', value: parseInt(editForm.pattern_value) };
			}

			await onSave(contributor.id, {
				name: editForm.name.trim(),
				email: editForm.email.trim().toLowerCase(),
				title: editForm.title.trim() || null,
				notes: editForm.notes.trim() || null,
				schedule_pattern,
				active: editForm.active
			});

			toast.success({ title: 'Saved', message: 'Contributor updated successfully', duration: 2000 });
			onClose();
		} catch (error) {
			toast.error({ title: 'Error', message: error.message || 'Failed to update contributor', duration: 3000 });
		} finally {
			isSaving = false;
		}
	}

	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) onClose();
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') onClose();
	}
</script>

{#if show && contributor}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		tabindex="0"
	>
		<div class="w-full max-w-lg rounded-xl bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
				<h2 class="text-lg font-semibold text-gray-900">Edit Contributor</h2>
				<button onclick={onClose} class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-4 p-6">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div class="md:col-span-2">
						<label for="edit-name" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
						<input
							id="edit-name"
							type="text"
							bind:value={editForm.name}
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="edit-title" class="mb-1 block text-sm font-medium text-gray-700">Title</label>
						<select
							id="edit-title"
							bind:value={editForm.title}
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						>
							<option value="">None</option>
							<option value="Fr">Fr</option>
							<option value="Sr">Sr</option>
							<option value="Br">Br</option>
							<option value="Deacon">Deacon</option>
						</select>
					</div>
				</div>

				<div>
					<label for="edit-email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
					<input
						id="edit-email"
						type="email"
						bind:value={editForm.email}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<label for="edit-pattern" class="mb-1 block text-sm font-medium text-gray-700">Schedule Pattern</label>
					<div class="grid grid-cols-2 gap-4">
						<select
							id="edit-pattern"
							bind:value={editForm.schedule_pattern}
							onchange={() => { editForm.pattern_value = null; }}
							class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						>
							<option value={null}>Manual assignment only</option>
							<option value="day_of_month">Day of Month</option>
							<option value="day_of_week">Day of Week</option>
						</select>

						{#if editForm.schedule_pattern === 'day_of_month'}
							<select
								bind:value={editForm.pattern_value}
								class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value={null}>Select day...</option>
								{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
									<option value={day}>{day}{getOrdinalSuffix(day)}</option>
								{/each}
							</select>
						{:else if editForm.schedule_pattern === 'day_of_week'}
							<select
								bind:value={editForm.pattern_value}
								class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value={null}>Select day...</option>
								{#each DAY_NAMES as day, index}
									<option value={index}>{day}</option>
								{/each}
							</select>
						{/if}
					</div>
				</div>

				<div>
					<label for="edit-notes" class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
					<textarea
						id="edit-notes"
						bind:value={editForm.notes}
						rows="2"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					></textarea>
				</div>

				<div class="flex items-center gap-2">
					<input
						id="edit-active"
						type="checkbox"
						bind:checked={editForm.active}
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<label for="edit-active" class="text-sm text-gray-700">Active</label>
				</div>
			</div>

			<div class="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
				<button
					onclick={onClose}
					class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={isSaving}
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{isSaving ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</div>
	</div>
{/if}
