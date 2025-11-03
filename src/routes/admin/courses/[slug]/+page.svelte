<script>
	import { Plus, Download } from 'lucide-svelte';
	import { goto, replaceState } from '$app/navigation';
	import { page } from '$app/stores';
	import CohortCard from '$lib/components/CohortCard.svelte';
	import CohortManager from '$lib/components/CohortManager.svelte';
	import CohortCreationWizard from '$lib/components/CohortCreationWizard.svelte';
	import StudentEnrollmentModal from '$lib/components/StudentEnrollmentModal.svelte';
	import CohortDetails from '$lib/components/CohortDetails.svelte';
	import RecentActivity from '$lib/components/RecentActivity.svelte';
	import StudentAdvancementModal from '$lib/components/StudentAdvancementModal.svelte';

	let { data } = $props();

	const courseSlug = data.courseSlug;
	let modules = $state(data.modules || []);
	let cohorts = $state(data.cohorts || []);
	let showCohortWizard = $state(false);
	let showStudentEnrollment = $state(false);
	let showAdvancementModal = $state(false);
	let showAttendanceModal = $state(false);
	let refreshTrigger = $state(0);

	let students = $state([]);
	let loadingStudents = $state(false);

	// Get selected cohort - use server-provided initial value for instant load
	let selectedCohortId = $state(data.initialSelectedCohort);

	// On mount: if we have a selected cohort but no URL param, update URL instantly
	$effect(() => {
		const cohortParam = $page.url.searchParams.get('cohort');
		const actionParam = $page.url.searchParams.get('action');

		// Handle new cohort action from sidebar
		if (actionParam === 'new-cohort') {
			showCohortWizard = true;
			// Clear the action param
			const newUrl = new URL($page.url);
			newUrl.searchParams.delete('action');
			goto(newUrl.pathname + newUrl.search, { replaceState: true });
			return;
		}

		// If we have an initial selection but no URL param, update URL using SvelteKit's replaceState (instant + reactive!)
		if (selectedCohortId && !cohortParam) {
			const newUrl = new URL($page.url);
			newUrl.searchParams.set('cohort', selectedCohortId);
			replaceState(newUrl.toString(), {});
		}

		// Sync selectedCohortId with URL changes (when user clicks sidebar)
		if (cohortParam && cohortParam !== selectedCohortId) {
			selectedCohortId = cohortParam;
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
	}

	async function handleWizardComplete(event) {
		showCohortWizard = false;
		// Refresh data without navigation
		await refreshData();
	}

	function openStudentEnrollment() {
		console.log('openStudentEnrollment called!');
		console.log('Current showStudentEnrollment state:', showStudentEnrollment);
		showStudentEnrollment = true;
		console.log('New showStudentEnrollment state:', showStudentEnrollment);
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
			const response = await fetch(`/admin/courses/${courseSlug}/api`);
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
			const response = await fetch(`/admin/courses/${courseSlug}`, {
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
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
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
				onDelete={handleCohortDelete}
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

<StudentEnrollmentModal {courseSlug}
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
