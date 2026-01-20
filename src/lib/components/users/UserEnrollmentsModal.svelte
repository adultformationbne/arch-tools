<script>
	import { X, Save, Edit2, Trash2, Plus } from '$lib/icons';
	import { apiPut, apiDelete } from '$lib/utils/api-handler.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let {
		isOpen = false,
		user = null,
		userName = '',
		onClose,
		onUpdated,
		onAddEnrollment
	} = $props();

	let editingEnrollmentId = $state(null);
	let editingEnrollmentRole = $state('');
	let showRemoveConfirm = $state(false);
	let enrollmentToRemove = $state(null);

	function getCourseRoleBadgeColor(role) {
		const colors = {
			admin: 'bg-orange-100 text-orange-800',
			student: 'bg-green-100 text-green-800',
			coordinator: 'bg-indigo-100 text-indigo-800'
		};
		return colors[role] || 'bg-gray-100 text-gray-800';
	}

	function startEditEnrollment(enrollmentId, currentRole) {
		editingEnrollmentId = enrollmentId;
		editingEnrollmentRole = currentRole;
	}

	function cancelEditEnrollment() {
		editingEnrollmentId = null;
		editingEnrollmentRole = '';
	}

	async function saveEnrollmentRole(enrollmentId) {
		try {
			await apiPut(
				'/api/admin/enrollments',
				{
					enrollmentId,
					role: editingEnrollmentRole
				},
				{
					loadingMessage: 'Updating enrollment role',
					loadingTitle: 'Updating...',
					successMessage: 'Role updated successfully',
					successTitle: 'Success!'
				}
			);

			cancelEditEnrollment();
			onUpdated?.();
		} catch (error) {
			console.error('Error updating enrollment:', error);
		}
	}

	function confirmRemoveEnrollment(enrollmentId, courseName) {
		enrollmentToRemove = { enrollmentId, courseName };
		showRemoveConfirm = true;
	}

	async function removeEnrollment() {
		const { enrollmentId, courseName } = enrollmentToRemove;
		showRemoveConfirm = false;
		enrollmentToRemove = null;

		if (!enrollmentId) return;

		try {
			await apiDelete(
				'/api/admin/enrollments',
				{ enrollmentId },
				{
					loadingMessage: 'Removing enrollment',
					loadingTitle: 'Removing...',
					successMessage: 'Enrollment removed successfully',
					successTitle: 'Success!'
				}
			);

			onUpdated?.();
		} catch (error) {
			console.error('Error removing enrollment:', error);
		}
	}
</script>

{#if isOpen && user}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 px-4">
		<div class="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
			<div class="flex items-center justify-between mb-4">
				<h3 class="text-lg font-medium text-gray-900">
					Course Enrollments - {userName}
				</h3>
				<button onclick={onClose} class="text-gray-400 hover:text-gray-600">
					<X class="h-5 w-5" />
				</button>
			</div>

			<div class="space-y-3 max-h-96 overflow-y-auto">
				{#if user.enrollments && user.enrollments.length > 0}
					{#each user.enrollments as enrollment}
						{@const cohort = enrollment.cohort}
						{@const courseName = cohort?.module?.course?.name || 'Unknown'}
						{@const cohortName = cohort?.name || 'Unknown Cohort'}
						<div
							class="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded border border-gray-200"
						>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium text-gray-900">
									{courseName}
								</div>
								<div class="text-xs text-gray-500">
									{cohortName}
								</div>
							</div>
							{#if editingEnrollmentId === enrollment.id}
								<div class="flex items-center gap-2">
									<select
										bind:value={editingEnrollmentRole}
										class="text-xs rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
									>
										<option value="student">Participant</option>
										<option value="coordinator">Hub Coordinator</option>
									</select>
									<button
										onclick={() => saveEnrollmentRole(enrollment.id)}
										class="p-1 text-green-600 hover:text-green-900"
										title="Save"
									>
										<Save class="h-4 w-4" />
									</button>
									<button
										onclick={cancelEditEnrollment}
										class="p-1 text-gray-600 hover:text-gray-900"
										title="Cancel"
									>
										<X class="h-4 w-4" />
									</button>
								</div>
							{:else}
								<div class="flex items-center gap-2">
									<span
										class="px-2 py-0.5 text-xs font-semibold rounded-full {getCourseRoleBadgeColor(enrollment.role)}"
									>
										{enrollment.role}
									</span>
									<button
										onclick={() => startEditEnrollment(enrollment.id, enrollment.role)}
										class="p-1 text-blue-600 hover:text-blue-900"
										title="Edit role"
									>
										<Edit2 class="h-4 w-4" />
									</button>
									<button
										onclick={() => confirmRemoveEnrollment(enrollment.id, courseName)}
										class="p-1 text-red-600 hover:text-red-900"
										title="Remove enrollment"
									>
										<Trash2 class="h-4 w-4" />
									</button>
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="text-center py-8 text-gray-500">No course enrollments yet</div>
				{/if}
			</div>

			<div class="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
				<button
					onclick={() => {
						onAddEnrollment?.();
						onClose?.();
					}}
					class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
				>
					<Plus class="h-4 w-4 mr-1" />
					Add Enrollment
				</button>
				<button
					onclick={onClose}
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Confirmation Modal -->
<ConfirmationModal
	show={showRemoveConfirm}
	title="Remove Enrollment"
	confirmText="Remove"
	cancelText="Cancel"
	onConfirm={removeEnrollment}
	onCancel={() => {
		showRemoveConfirm = false;
		enrollmentToRemove = null;
	}}
>
	<p>Remove this enrollment from {enrollmentToRemove?.courseName}?</p>
	<p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
</ConfirmationModal>
