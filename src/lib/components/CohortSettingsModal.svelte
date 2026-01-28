<script>
	import { X, Trash2, AlertTriangle, CheckCircle } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { getCohortStatusFromObject } from '$lib/utils/cohort-status';
	import ConfirmationModal from './ConfirmationModal.svelte';

	let {
		show = false,
		cohort = null,
		courseSlug = '',
		onClose = () => {},
		onUpdate = () => {},
		onDelete = () => {}
	} = $props();

	// Form state
	let name = $state('');
	let startDate = $state('');
	let endDate = $state('');
	let saving = $state(false);
	let deleting = $state(false);
	let completing = $state(false);
	let showDeleteConfirm = $state(false);
	let showCompleteConfirm = $state(false);

	// Computed status based on session progress
	const statusInfo = $derived(cohort ? getCohortStatusFromObject(cohort) : null);

	// Check if cohort is on or past final session (can be marked complete)
	const totalSessions = $derived(cohort?.total_sessions || cohort?.module?.total_sessions || 8);
	const canMarkComplete = $derived(
		cohort && statusInfo?.status === 'active' && cohort.current_session >= totalSessions
	);

	// Reset form when modal opens
	$effect(() => {
		if (show && cohort) {
			name = cohort.name || '';
			startDate = cohort.start_date || '';
			endDate = cohort.end_date || '';
		}
	});

	async function handleSave() {
		if (!name.trim()) {
			toastError('Cohort name is required');
			return;
		}

		saving = true;
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_cohort',
					cohortId: cohort.id,
					name: name.trim(),
					startDate: startDate || null,
					endDate: endDate || null
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to update cohort');
			}

			toastSuccess('Cohort updated successfully');
			onUpdate();
			onClose();
		} catch (err) {
			console.error('Error updating cohort:', err);
			toastError(err.message || 'Failed to update cohort');
		} finally {
			saving = false;
		}
	}

	async function handleMarkComplete() {
		showCompleteConfirm = false;
		completing = true;

		try {
			// Advance session past total to trigger 'completed' status
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_cohort',
					cohortId: cohort.id,
					currentSession: totalSessions + 1
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to mark cohort complete');
			}

			toastSuccess('Cohort marked as complete');
			onUpdate();
			onClose();
		} catch (err) {
			console.error('Error marking cohort complete:', err);
			toastError(err.message || 'Failed to mark cohort complete');
		} finally {
			completing = false;
		}
	}

	async function handleDelete() {
		showDeleteConfirm = false;
		deleting = true;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_cohort',
					cohortId: cohort.id
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to delete cohort');
			}

			toastSuccess('Cohort deleted successfully');
			onDelete();
			onClose();
		} catch (err) {
			console.error('Error deleting cohort:', err);
			toastError(err.message || 'Failed to delete cohort');
		} finally {
			deleting = false;
		}
	}

	function handleClose() {
		if (!saving && !deleting && !completing) {
			onClose();
		}
	}
</script>

{#if show && cohort}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-gray-200">
				<h2 class="text-lg font-bold text-gray-900">Cohort Settings</h2>
				<button
					onclick={handleClose}
					class="p-1 text-gray-400 hover:text-gray-600 rounded"
					disabled={saving || deleting}
				>
					<X size={20} />
				</button>
			</div>

			<!-- Form -->
			<div class="p-4 space-y-4">
				<!-- Name -->
				<div>
					<label for="cohort-name" class="block text-sm font-medium text-gray-700 mb-1">
						Cohort Name
					</label>
					<input
						id="cohort-name"
						type="text"
						bind:value={name}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						placeholder="e.g., Feb 2025 - Foundations"
					/>
				</div>

				<!-- Dates -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">
							Start Date
						</label>
						<input
							id="start-date"
							type="date"
							bind:value={startDate}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
					<div>
						<label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">
							End Date
						</label>
						<input
							id="end-date"
							type="date"
							bind:value={endDate}
							class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						/>
					</div>
				</div>
				<p class="text-xs text-gray-500 -mt-2">
					Dates are for display only. Cohort progression is controlled by advancing sessions.
				</p>

				<!-- Status & Session Info (read-only, computed from session progress) -->
				<div class="bg-gray-50 rounded-lg p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Status</span>
						{#if statusInfo}
							<span
								class="px-2 py-0.5 rounded text-xs font-semibold"
								style="background-color: {statusInfo.color}20; color: {statusInfo.color};"
							>
								{statusInfo.label}
							</span>
						{/if}
					</div>
					<div class="text-sm text-gray-600">
						<span class="font-medium">Session:</span>
						{cohort.current_session} / {totalSessions}
					</div>
					<div class="text-sm text-gray-600">
						<span class="font-medium">Module:</span>
						{cohort.module?.name || 'Unknown'}
					</div>
					{#if canMarkComplete}
						<button
							onclick={() => showCompleteConfirm = true}
							class="w-full mt-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
							disabled={saving || deleting || completing}
						>
							<CheckCircle size={16} />
							Mark as Complete
						</button>
					{:else}
						<p class="text-xs text-gray-500 pt-1 border-t border-gray-200">
							Status updates automatically: Scheduled (session 0) → Active (in progress) → Completed (mark complete on final session)
						</p>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
				<button
					onclick={() => showDeleteConfirm = true}
					class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
					disabled={saving || deleting}
				>
					<Trash2 size={16} />
					Delete Cohort
				</button>

				<div class="flex gap-3">
					<button
						onclick={handleClose}
						class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
						disabled={saving || deleting}
					>
						Cancel
					</button>
					<button
						onclick={handleSave}
						class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
						disabled={saving || deleting}
					>
						{saving ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Mark Complete Confirmation -->
<ConfirmationModal
	show={showCompleteConfirm}
	title="Mark Cohort Complete"
	confirmText={completing ? 'Completing...' : 'Mark Complete'}
	cancelText="Cancel"
	onConfirm={handleMarkComplete}
	onCancel={() => showCompleteConfirm = false}
>
	<div class="flex items-start gap-3">
		<div class="p-2 bg-blue-100 rounded-full">
			<CheckCircle size={20} class="text-blue-600" />
		</div>
		<div>
			<p class="text-gray-900 font-medium">Mark "{cohort?.name}" as complete?</p>
			<p class="text-sm text-gray-600 mt-1">
				This will mark the cohort as completed. The cohort has finished all {totalSessions} sessions.
			</p>
		</div>
	</div>
</ConfirmationModal>

<!-- Delete Confirmation -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Delete Cohort"
	confirmText={deleting ? 'Deleting...' : 'Delete'}
	cancelText="Cancel"
	onConfirm={handleDelete}
	onCancel={() => showDeleteConfirm = false}
>
	<div class="flex items-start gap-3">
		<div class="p-2 bg-red-100 rounded-full">
			<AlertTriangle size={20} class="text-red-600" />
		</div>
		<div>
			<p class="text-gray-900 font-medium">Are you sure you want to delete "{cohort?.name}"?</p>
			<p class="text-sm text-gray-600 mt-1">
				This will permanently delete the cohort and all its enrollments. This action cannot be undone.
				Consider archiving instead if you want to keep the data.
			</p>
		</div>
	</div>
</ConfirmationModal>
