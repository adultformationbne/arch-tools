<script>
	import { Plus, Download } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import CohortCard from '$lib/components/CohortCard.svelte';
	import CohortManager from '$lib/components/CohortManager.svelte';
	import CohortCreationWizard from '$lib/components/CohortCreationWizard.svelte';
	import StudentEnrollmentModal from '$lib/components/StudentEnrollmentModal.svelte';
	import CohortDetails from '$lib/components/CohortDetails.svelte';
	import RecentActivity from '$lib/components/RecentActivity.svelte';
	import StudentAdvancementModal from '$lib/components/StudentAdvancementModal.svelte';

	let { data } = $props();

	let modules = $state(data.modules || []);
	let cohorts = $state(data.cohorts || []);
let selectedCohortId = $state(null);

$effect(() => {
 const currentId = selectedCohortId;
 if (cohorts.length > 0) {
  const exists = cohorts.some(cohort => cohort.id === currentId);
  if (!exists) {
   selectedCohortId = cohorts[0].id;
  }
 }
});
	let showCohortWizard = $state(false);
	let showStudentEnrollment = $state(false);
	let showAdvancementModal = $state(false);
	let showAttendanceModal = $state(false);
	let refreshTrigger = $state(0);

	let students = $state([]);
	let loadingStudents = $state(false);

	// Auto-select the latest cohort
	$effect(() => {
		if (cohorts.length > 0 && !selectedCohortId) {
			selectedCohortId = cohorts[0].id;
		}
	});

	// Load students when cohort changes
	$effect(() => {
		if (selectedCohortId) {
			loadStudents();
		}
	});

	const selectedCohort = $derived(cohorts.find(c => c.id === selectedCohortId));

	async function loadStudents() {
		if (!selectedCohortId) return;

		loadingStudents = true;
		try {
			const response = await fetch(`/admin/api?endpoint=courses_enrollments&cohort_id=${selectedCohortId}`);
			const result = await response.json();
			students = result.success ? result.data : [];
		} catch (err) {
			console.error('Failed to load students:', err);
			students = [];
		} finally {
			loadingStudents = false;
		}
	}

	function selectCohort(cohortId) {
		selectedCohortId = cohortId;
	}

	function openCohortWizard() {
		showCohortWizard = true;
	}

	function closeCohortWizard() {
		showCohortWizard = false;
	}

	async function handleWizardComplete(event) {
		showCohortWizard = false;
		// Refresh data without navigation
		await refreshData();
	}

	function openStudentEnrollment() {
		showStudentEnrollment = true;
	}

	function closeStudentEnrollment() {
		showStudentEnrollment = false;
	}

	async function handleEnrollmentComplete() {
		showStudentEnrollment = false;
		// Trigger component refresh immediately
		refreshTrigger++;
		// Then refresh full data
		await refreshData();
	}

	async function handleCohortUpdate() {
		// Fetch updated cohort data directly
		try {
			const response = await fetch('/admin/api');
			const result = await response.json();
			if (result.success) {
				cohorts = result.data;
			}
		} catch (err) {
			console.error('Failed to refresh cohorts:', err);
		}
		// Trigger component refresh
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
		// Reload students to see updated sessions
		await loadStudents();
		refreshTrigger++;
	}

	function openAttendanceModal() {
		showAttendanceModal = true;
		// TODO: Implement attendance modal
		alert('Attendance tracking coming soon!');
		showAttendanceModal = false;
	}

	async function refreshData() {
		try {
			// Fetch fresh data from server
			const response = await fetch('/admin', {
				headers: {
					'Accept': 'application/json'
				}
			});

			if (response.ok) {
				// Use invalidateAll to refresh the page data
				await goto('/admin', { invalidateAll: true, replaceState: true });
			}
		} catch (err) {
			console.error('Failed to refresh data:', err);
		}
	}

	async function handleCohortDelete() {
		if (!selectedCohortId) return;

		if (!confirm('Delete this cohort? This cannot be undone.')) return;

		try {
			const response = await fetch('/admin/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_cohort',
					cohortId: selectedCohortId
				})
			});

			if (response.ok) {
				// Reset selection before refresh
				selectedCohortId = null;
				await refreshData();
			} else {
				const error = await response.text();
				alert(error || 'Failed to delete cohort');
			}
		} catch (err) {
			console.error('Error deleting cohort:', err);
			alert('Failed to delete cohort');
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

<div class="px-24 pb-16">
	<!-- Compact Header Row: Cohort Pills + New Cohort Button -->
	<div class="cohort-header-row">
		<div class="cohort-pills-container">
			{#if cohorts.length === 0}
				<div class="empty-state-inline">
					<p>No cohorts yet</p>
				</div>
			{:else}
				{#each cohorts.slice(0, 4) as cohort}
					<CohortCard
						{cohort}
						isActive={selectedCohortId === cohort.id}
						onClick={() => selectCohort(cohort.id)}
					/>
				{/each}
			{/if}
		</div>

		<button onclick={openCohortWizard} class="btn-new-cohort">
			<Plus size={20} />
			New Cohort
		</button>
	</div>

	<!-- Two-Column Section: Cohort Details + Recent Activity -->
	{#if selectedCohort}
		<div class="details-activity-row">
			<!-- Left: Cohort Details -->
			<CohortDetails
				cohort={selectedCohort}
				{modules}
				onUpdate={handleCohortUpdate}
				onDelete={handleCohortDelete}
			/>

			<!-- Right: Recent Activity -->
			<div class="activity-sidebar">
				<RecentActivity cohort={selectedCohort} />
			</div>
		</div>
	{/if}

	<!-- Full-Width Participants Section -->
	{#if selectedCohort}
		<CohortManager
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
<CohortCreationWizard
	{modules}
	show={showCohortWizard}
	onClose={closeCohortWizard}
	on:complete={handleWizardComplete}
/>

<StudentEnrollmentModal
	cohort={selectedCohort}
	show={showStudentEnrollment}
	onClose={closeStudentEnrollment}
	on:complete={handleEnrollmentComplete}
/>

<StudentAdvancementModal
	cohort={selectedCohort}
	{students}
	bind:show={showAdvancementModal}
	onComplete={handleAdvancementComplete}
/>

<style>
	/* Compact Header Row */
	.cohort-header-row {
		display: flex;
		justify-content: space-between;
		align-items: stretch;
		gap: 12px;
		padding-top: 32px;
		padding-bottom: 24px;
	}

	.cohort-pills-container {
		display: flex;
		gap: 12px;
		overflow-x: auto;
		flex: 1;
	}

	.empty-state-inline {
		display: flex;
		align-items: center;
		padding: 16px 24px;
		background: rgba(255, 255, 255, 0.08);
		border: 2px dashed rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		color: rgba(255, 255, 255, 0.6);
		font-size: 0.9375rem;
	}

	.empty-state-inline p {
		margin: 0;
	}

	.btn-new-cohort {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 16px 24px;
		background: var(--course-accent-light);
		color: var(--course-accent-darkest);
		border: 2px solid var(--course-accent-light);
		border-radius: 12px;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		font-family: 'Inter', system-ui, -apple-system, sans-serif;
	}

	.btn-new-cohort:hover {
		background: var(--course-accent-dark);
		border-color: var(--course-accent-dark);
		color: white;
		transform: translateY(-2px);
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
