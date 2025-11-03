<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import CourseAdminSidebar from '$lib/components/CourseAdminSidebar.svelte';

	let { data, children } = $props();

	const courseSlug = data.courseSlug;
	const modules = data.userModules || [];
	const enrollmentRole = data.enrollmentRole;
	const isCourseAdmin = data.isCourseAdmin;
	const cohorts = data.cohorts || [];

	// Extract cohort selection from URL if on dashboard
	const selectedCohortId = $derived(() => {
		if ($page.url.pathname === `/admin/courses/${courseSlug}`) {
			return $page.url.searchParams.get('cohort');
		}
		return null;
	});

	function handleNewCohort() {
		// Navigate to dashboard and trigger new cohort wizard
		goto(`/admin/courses/${courseSlug}?action=new-cohort`);
	}

	function handleSelectCohort(cohortId) {
		// Navigate to dashboard with selected cohort
		goto(`/admin/courses/${courseSlug}?cohort=${cohortId}`);
	}
</script>

<div class="admin-layout">
	<CourseAdminSidebar
		{courseSlug}
		{modules}
		{enrollmentRole}
		{isCourseAdmin}
		{cohorts}
		selectedCohortId={selectedCohortId()}
		onNewCohort={handleNewCohort}
		onSelectCohort={handleSelectCohort}
	/>

	<main class="admin-content">
		{@render children()}
	</main>
</div>

<style>
	.admin-layout {
		display: flex;
		min-height: 100vh;
		background-color: var(--course-accent-dark);
	}

	.admin-content {
		flex: 1;
		overflow-x: hidden;
	}
</style>
