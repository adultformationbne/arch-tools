<script>
	import { X, Trash2, AlertTriangle, CheckCircle, Archive, RotateCcw } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { getCohortStatusFromObject, getTotalSessions } from '$lib/utils/cohort-status';
	import ConfirmationModal from './ConfirmationModal.svelte';

	let {
		show = false,
		cohort = null,
		courseSlug = '',
		courseFeatures = {},
		onClose = () => {},
		onUpdate = () => {},
		onDelete = () => {},
		onArchive = () => {}
	} = $props();

	// Form state
	let name = $state('');
	let startDate = $state('');
	let endDate = $state('');

	// Enrollment settings state
	let enrollmentType = $state('');
	let isFree = $state(true);
	let priceCents = $state('');
	let currency = $state('AUD');
	let enrollmentOpensAt = $state('');
	let enrollmentClosesAt = $state('');
	let maxEnrollments = $state('');
	let saving = $state(false);
	let deleting = $state(false);
	let completing = $state(false);
	let archiving = $state(false);
	let unarchiving = $state(false);
	let showDeleteConfirm = $state(false);
	let showCompleteConfirm = $state(false);
	let showArchiveConfirm = $state(false);
	let deleteConfirmName = $state('');

	// Check if this cohort is archived
	const isArchived = $derived(cohort?.status === 'archived');

	// Computed status based on session progress
	const statusInfo = $derived(cohort ? getCohortStatusFromObject(cohort) : null);

	// Check if cohort is on or past final session (can be marked complete)
	const totalSessions = $derived(cohort ? getTotalSessions(cohort) : 0);
	const canMarkComplete = $derived(
		cohort && !isArchived && statusInfo?.status === 'active' && cohort.current_session >= totalSessions
	);

	// Delete confirmation requires typing the cohort name
	const deleteNameMatches = $derived(
		deleteConfirmName.trim().toLowerCase() === (cohort?.name || '').trim().toLowerCase()
	);

	// Reset form when modal opens
	$effect(() => {
		if (show && cohort) {
			name = cohort.name || '';
			startDate = cohort.start_date || '';
			endDate = cohort.end_date || '';
			deleteConfirmName = '';

			// Enrollment settings
			enrollmentType = cohort.enrollment_type || '';
			isFree = cohort.is_free ?? true;
			priceCents = cohort.price_cents ? (cohort.price_cents / 100).toFixed(2) : '';
			currency = cohort.currency || 'AUD';
			enrollmentOpensAt = cohort.enrollment_opens_at ? cohort.enrollment_opens_at.slice(0, 16) : '';
			enrollmentClosesAt = cohort.enrollment_closes_at ? cohort.enrollment_closes_at.slice(0, 16) : '';
			maxEnrollments = cohort.max_enrollments ? String(cohort.max_enrollments) : '';
		}
	});

	let savingEnrollment = $state(false);

	async function handleSaveEnrollment() {
		savingEnrollment = true;
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_cohort_enrollment',
					cohortId: cohort.id,
					enrollmentType: enrollmentType || null,
					isFree,
					priceCents: !isFree && priceCents ? Math.round(parseFloat(priceCents) * 100) : null,
					currency,
					enrollmentOpensAt: enrollmentOpensAt || null,
					enrollmentClosesAt: enrollmentClosesAt || null,
					maxEnrollments: maxEnrollments ? parseInt(maxEnrollments) : null
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to update enrollment settings');
			}

			toastSuccess('Enrollment settings updated');
			onUpdate();
		} catch (err) {
			console.error('Error updating enrollment settings:', err);
			toastError(err.message || 'Failed to update enrollment settings');
		} finally {
			savingEnrollment = false;
		}
	}

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

	async function handleArchive() {
		showArchiveConfirm = false;
		archiving = true;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'archive_cohort',
					cohortId: cohort.id
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to archive cohort');
			}

			toastSuccess('Cohort archived successfully');
			onArchive();
			onClose();
		} catch (err) {
			console.error('Error archiving cohort:', err);
			toastError(err.message || 'Failed to archive cohort');
		} finally {
			archiving = false;
		}
	}

	async function handleUnarchive() {
		unarchiving = true;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'unarchive_cohort',
					cohortId: cohort.id
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to restore cohort');
			}

			toastSuccess('Cohort restored successfully');
			onArchive();
			onClose();
		} catch (err) {
			console.error('Error restoring cohort:', err);
			toastError(err.message || 'Failed to restore cohort');
		} finally {
			unarchiving = false;
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

			toastSuccess('Cohort permanently deleted');
			onDelete();
			onClose();
		} catch (err) {
			console.error('Error deleting cohort:', err);
			toastError(err.message || 'Failed to delete cohort');
		} finally {
			deleting = false;
			deleteConfirmName = '';
		}
	}

	const isBusy = $derived(saving || deleting || completing || archiving || unarchiving);

	function handleClose() {
		if (!isBusy) {
			onClose();
		}
	}
</script>

{#if show && cohort}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="presentation"
		tabindex="-1"
	>
		<div
			class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-4 border-b border-gray-200">
				<div class="flex items-center gap-2">
					<h2 class="text-lg font-bold text-gray-900">Cohort Settings</h2>
					{#if isArchived}
						<span class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">Archived</span>
					{/if}
				</div>
				<button
					onclick={handleClose}
					class="p-1 text-gray-400 hover:text-gray-600 rounded"
					disabled={isBusy}
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
						disabled={isArchived}
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
							disabled={isArchived}
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
							disabled={isArchived}
						/>
					</div>
				</div>
				{#if !isArchived}
					<p class="text-xs text-gray-500 -mt-2">
						Dates are for display only. Cohort progression is controlled by advancing sessions.
					</p>
				{/if}

				<!-- Status & Session Info (read-only, computed from session progress) -->
				<div class="bg-gray-50 rounded-lg p-3 space-y-2">
					<div class="flex items-center justify-between">
						<span class="text-sm font-medium text-gray-700">Status</span>
						{#if isArchived}
							<span class="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
								Archived
							</span>
						{:else if statusInfo}
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
							disabled={isBusy}
						>
							<CheckCircle size={16} />
							Mark as Complete
						</button>
					{:else if !isArchived}
						<p class="text-xs text-gray-500 pt-1 border-t border-gray-200">
							Status updates automatically: Scheduled (session 0) → Active (in progress) → Completed (mark complete on final session)
						</p>
					{/if}
				</div>

				<!-- Enrollment Settings Section -->
				{#if courseFeatures.enrollmentEnabled && !isArchived}
					<div class="border-t border-gray-200 pt-4">
						<h3 class="text-sm font-semibold text-gray-900 mb-3">Enrollment Settings</h3>

						<!-- Enrollment Type -->
						<div class="mb-3">
							<label for="enrollment-type" class="block text-sm font-medium text-gray-700 mb-1">
								Enrollment Type
							</label>
							<select
								id="enrollment-type"
								bind:value={enrollmentType}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							>
								<option value="">Use course default</option>
								<option value="auto_approve">Auto-approve</option>
								<option value="approval_required">Require approval</option>
							</select>
							<p class="text-xs text-gray-500 mt-1">Controls whether participants need admin approval</p>
						</div>

						<!-- Pricing (only when acceptPayments enabled) -->
						{#if courseFeatures.acceptPayments}
							<div class="mb-3">
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={isFree}
										class="w-4 h-4 rounded border-gray-300"
									/>
									<span class="text-sm font-medium text-gray-700">Free enrollment</span>
								</label>
							</div>

							{#if !isFree}
								<div class="grid grid-cols-2 gap-3 mb-3">
									<div>
										<label for="cohort-price" class="block text-sm font-medium text-gray-700 mb-1">
											Price
										</label>
										<div class="relative">
											<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
											<input
												id="cohort-price"
												type="number"
												bind:value={priceCents}
												step="0.01"
												min="0"
												placeholder="0.00"
												class="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
											/>
										</div>
									</div>
									<div>
										<label for="cohort-currency" class="block text-sm font-medium text-gray-700 mb-1">
											Currency
										</label>
										<select
											id="cohort-currency"
											bind:value={currency}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										>
											<option value="AUD">AUD</option>
											<option value="USD">USD</option>
											<option value="NZD">NZD</option>
										</select>
									</div>
								</div>
							{/if}
						{/if}

						<!-- Enrollment Window -->
						<div class="grid grid-cols-2 gap-3 mb-3">
							<div>
								<label for="enrollment-opens" class="block text-sm font-medium text-gray-700 mb-1">
									Opens at
								</label>
								<input
									id="enrollment-opens"
									type="datetime-local"
									bind:value={enrollmentOpensAt}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
							<div>
								<label for="enrollment-closes" class="block text-sm font-medium text-gray-700 mb-1">
									Closes at
								</label>
								<input
									id="enrollment-closes"
									type="datetime-local"
									bind:value={enrollmentClosesAt}
									class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
								/>
							</div>
						</div>
						<p class="text-xs text-gray-500 mb-3">Leave empty for no enrollment window restrictions</p>

						<!-- Max Enrollments -->
						<div class="mb-3">
							<label for="max-enrollments" class="block text-sm font-medium text-gray-700 mb-1">
								Max Enrollments
							</label>
							<input
								id="max-enrollments"
								type="number"
								bind:value={maxEnrollments}
								min="1"
								placeholder="Unlimited"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							/>
							<p class="text-xs text-gray-500 mt-1">Cohort-level cap. Leave empty for unlimited.</p>
						</div>

						<button
							onclick={handleSaveEnrollment}
							class="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
							disabled={isBusy || savingEnrollment}
						>
							{savingEnrollment ? 'Saving...' : 'Save Enrollment Settings'}
						</button>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
				{#if isArchived}
					<!-- Archived cohort: Unarchive and Delete Permanently -->
					<div class="flex gap-2">
						<button
							onclick={handleUnarchive}
							class="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
							disabled={isBusy}
						>
							<RotateCcw size={16} />
							{unarchiving ? 'Restoring...' : 'Restore'}
						</button>
						<button
							onclick={() => showDeleteConfirm = true}
							class="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
							disabled={isBusy}
						>
							<Trash2 size={16} />
							Delete Permanently
						</button>
					</div>
					<button
						onclick={handleClose}
						class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
						disabled={isBusy}
					>
						Close
					</button>
				{:else}
					<!-- Active cohort: Archive button + delete hint -->
					<div class="flex flex-col items-start gap-1.5">
						<button
							onclick={() => showArchiveConfirm = true}
							class="px-3 py-2 text-amber-700 hover:bg-amber-50 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
							disabled={isBusy}
						>
							<Archive size={16} />
							Archive Cohort
						</button>
						<p class="text-xs text-gray-400 pl-1 flex items-center gap-1">
							<Trash2 size={11} />
							To permanently delete, archive first
						</p>
					</div>

					<div class="flex gap-3">
						<button
							onclick={handleClose}
							class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
							disabled={isBusy}
						>
							Cancel
						</button>
						<button
							onclick={handleSave}
							class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
							disabled={isBusy}
						>
							{saving ? 'Saving...' : 'Save Changes'}
						</button>
					</div>
				{/if}
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

<!-- Archive Confirmation -->
<ConfirmationModal
	show={showArchiveConfirm}
	title="Archive Cohort"
	confirmText={archiving ? 'Archiving...' : 'Archive'}
	cancelText="Cancel"
	onConfirm={handleArchive}
	onCancel={() => showArchiveConfirm = false}
>
	<div class="flex items-start gap-3">
		<div class="p-2 bg-amber-100 rounded-full">
			<Archive size={20} class="text-amber-600" />
		</div>
		<div>
			<p class="font-medium">Archive "{cohort?.name}"?</p>
			<p class="text-sm mt-1">
				The cohort will be hidden from the main list but all data (enrollments, attendance, reflections, chat messages) will be preserved. You can restore it at any time.
			</p>
		</div>
	</div>
</ConfirmationModal>

<!-- Delete Permanently Confirmation (type-to-confirm) -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Permanently Delete Cohort"
	confirmText={deleting ? 'Deleting...' : 'Delete Permanently'}
	confirmVariant="danger"
	cancelText="Cancel"
	confirmDisabled={!deleteNameMatches}
	onConfirm={handleDelete}
	onCancel={() => { showDeleteConfirm = false; deleteConfirmName = ''; }}
>
	<div class="flex items-start gap-3">
		<div class="p-2 bg-red-100 rounded-full">
			<AlertTriangle size={20} class="text-red-600" />
		</div>
		<div class="flex-1">
			<p class="font-medium">Permanently delete "{cohort?.name}"?</p>
			<p class="text-sm mt-1">
				This will permanently delete the cohort and all associated data:
			</p>
			<ul class="text-sm mt-1 list-disc list-inside">
				<li>All enrollments</li>
				<li>Attendance records</li>
				<li>Reflection responses</li>
				<li>Chat messages</li>
				<li>Activity logs</li>
			</ul>
			<p class="text-sm text-red-400 font-semibold mt-2">This action cannot be undone.</p>
			<div class="mt-3">
				<label for="delete-confirm-name" class="block text-sm mb-1">
					Type <strong>{cohort?.name}</strong> to confirm:
				</label>
				<input
					id="delete-confirm-name"
					type="text"
					bind:value={deleteConfirmName}
					class="w-full px-3 py-2 rounded-lg text-sm"
					placeholder={cohort?.name}
					autocomplete="off"
				/>
			</div>
		</div>
	</div>
</ConfirmationModal>
