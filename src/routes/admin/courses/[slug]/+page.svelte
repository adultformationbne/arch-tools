<script>
	import { Plus, Download } from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import CohortCard from '$lib/components/CohortCard.svelte';
	import CohortManager from '$lib/components/CohortManager.svelte';
	import CohortCreationWizard from '$lib/components/CohortCreationWizard.svelte';
	import ParticipantEnrollmentModal from '$lib/components/ParticipantEnrollmentModal.svelte';
	import CohortDetails from '$lib/components/CohortDetails.svelte';
	import RecentActivity from '$lib/components/RecentActivity.svelte';
	import StudentAdvancementModal from '$lib/components/StudentAdvancementModal.svelte';
	import { toastError, toastWarning } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let { data } = $props();

	const courseSlug = data.courseSlug;
	let modules = $state(data.modules || []);
	let cohorts = $state(data.cohorts || []);
	let showCohortWizard = $state(false);
	let showStudentEnrollment = $state(false);
	let showAdvancementModal = $state(false);
	let refreshTrigger = $state(0);

	// Students state
	let students = $state([]);
	let loadingStudents = $state(false);

	// Delete confirmation state
	let showDeleteConfirm = $state(false);

	// Get selected cohort from URL params (simple derived state)
	const selectedCohortId = $derived($page.url.searchParams.get('cohort'));
	const selectedCohort = $derived(cohorts.find(c => c.id === selectedCohortId));

	// Handle action param for new cohort wizard
	$effect(() => {
		const actionParam = $page.url.searchParams.get('action');
		if (actionParam === 'new-cohort') {
			showCohortWizard = true;
		}
	});

	// Load students when cohort changes
	$effect(() => {
		if (selectedCohortId) {
			loadStudents();
		} else {
			students = [];
		}
	});

	async function loadStudents() {
		if (!selectedCohortId) return;

		loadingStudents = true;
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api?endpoint=courses_enrollments&cohort_id=${selectedCohortId}`);
			const result = await response.json();
			students = result.success ? result.data : [];
		} catch (err) {
			console.error('Failed to load students:', err);
			students = [];
		} finally {
			loadingStudents = false;
		}
	}

	function closeCohortWizard() {
		showCohortWizard = false;
		// Clear action param from URL
		const newUrl = new URL($page.url);
		newUrl.searchParams.delete('action');
		goto(newUrl.toString(), { replaceState: true });
	}

	async function handleWizardComplete(event) {
		showCohortWizard = false;
		await invalidateAll();
	}

	function openStudentEnrollment() {
		showStudentEnrollment = true;
	}

	function closeStudentEnrollment() {
		showStudentEnrollment = false;
	}

	async function handleEnrollmentComplete() {
		showStudentEnrollment = false;
		await invalidateAll();
		await loadStudents();
	}

	async function handleCohortUpdate() {
		await invalidateAll();
		refreshTrigger++;
	}

	function openAdvancementModal() {
		showAdvancementModal = true;
	}

	function closeAdvancementModal() {
		showAdvancementModal = false;
	}

	async function handleAdvancementComplete() {
		showAdvancementModal = false;
		await loadStudents();
		refreshTrigger++;
	}

	function confirmCohortDelete() {
		showDeleteConfirm = true;
	}

	async function handleCohortDelete() {
		showDeleteConfirm = false;

		if (!selectedCohortId) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_cohort',
					cohortId: selectedCohortId
				})
			});

			if (response.ok) {
				// Clear cohort param from URL
				const newUrl = new URL($page.url);
				newUrl.searchParams.delete('cohort');
				await goto(newUrl.toString(), { invalidateAll: true });
			} else {
				const error = await response.text();
				toastError(error || 'Failed to delete cohort', 'Delete Failed');
			}
		} catch (err) {
			console.error('Error deleting cohort:', err);
			toastError('Failed to delete cohort', 'Delete Failed');
		}
	}

	function downloadCSVTemplate() {
		const csvContent = `full_name,email,role,hub
John Smith,john.smith@example.com,student,St. Mary's Parish
Jane Doe,jane.doe@example.com,hub_coordinator,Downtown Hub
Bob Johnson,bob.j@example.com,student,`;

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);

		link.setAttribute('href', url);
		link.setAttribute('download', 'accf-student-import-template.csv');
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}
</script>

<div class="px-24 pb-16 pt-8">
	{#if !selectedCohort && cohorts.length === 0}
		<div class="empty-state">
			<h2>No Active Cohorts</h2>
			<p>Get started by creating your first cohort using the sidebar.</p>
		</div>
	{:else if !selectedCohort}
		<div class="empty-state">
			<h2>Select a Cohort</h2>
			<p>Choose a cohort from the sidebar to view details and manage participants.</p>
		</div>
	{/if}

	<!-- Two-Column Section: Cohort Details + Recent Activity -->
	{#if selectedCohort}
		<div class="details-activity-row">
			<!-- Left: Cohort Details -->
			<CohortDetails {courseSlug}
				cohort={selectedCohort}
				{modules}
				onUpdate={handleCohortUpdate}
				onDelete={confirmCohortDelete}
			/>

			<!-- Right: Recent Activity -->
			<div class="activity-sidebar">
				<RecentActivity cohort={selectedCohort} {courseSlug} />
			</div>
		</div>
	{/if}

	<!-- Full-Width Participants Section -->
	{#if selectedCohort}
		<CohortManager {courseSlug}
			cohort={selectedCohort}
			{modules}
			{refreshTrigger}
			onUpdate={handleCohortUpdate}
			onDelete={handleCohortDelete}
			onAddStudents={openStudentEnrollment}
		/>
	{/if}
</div>

<!-- Modals -->
<CohortCreationWizard {courseSlug}
	{modules}
	show={showCohortWizard}
	onClose={closeCohortWizard}
	on:complete={handleWizardComplete}
/>

<ParticipantEnrollmentModal {courseSlug}
	cohort={selectedCohort}
	show={showStudentEnrollment}
	onClose={closeStudentEnrollment}
	on:complete={handleEnrollmentComplete}
/>

<StudentAdvancementModal {courseSlug}
	cohort={selectedCohort}
	{students}
	bind:show={showAdvancementModal}
	onComplete={handleAdvancementComplete}
/>

<!-- Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Delete Cohort"
	confirmText="Delete"
	cancelText="Cancel"
	onConfirm={handleCohortDelete}
	onCancel={() => showDeleteConfirm = false}
>
	<p>Are you sure you want to delete this cohort?</p>
	<p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
</ConfirmationModal>

<style>
	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 80px 24px;
		background: rgba(255, 255, 255, 0.05);
		border: 2px dashed rgba(255, 255, 255, 0.2);
		border-radius: 16px;
		margin-top: 40px;
	}

	.empty-state h2 {
		margin: 0 0 12px 0;
		color: rgba(255, 255, 255, 0.9);
		font-size: 1.75rem;
		font-weight: 600;
	}

	.empty-state p {
		margin: 0;
		color: rgba(255, 255, 255, 0.6);
		font-size: 1rem;
	}

	/* Two-Column Details + Activity */
	.details-activity-row {
		display: grid;
		grid-template-columns: 1fr 400px;
		gap: 24px;
		margin-bottom: 32px;
	}

	/* Activity Sidebar */
	.activity-sidebar {
		/* RecentActivity component handles its own styling */
	}


	@media (max-width: 1024px) {
		.details-activity-row {
			grid-template-columns: 1fr;
		}
	}
</style>
