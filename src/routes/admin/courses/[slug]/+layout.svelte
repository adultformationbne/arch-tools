<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page, navigating } from '$app/stores';
	import { setContext } from 'svelte';
	import CourseAdminSidebar from '$lib/components/CourseAdminSidebar.svelte';
	import CourseAdminMobileNav from '$lib/components/CourseAdminMobileNav.svelte';
	import CohortCreationWizard from '$lib/components/CohortCreationWizard.svelte';

	let { data, children } = $props();

	// Track navigation timing
	let navStartTime = $state(null);

	$effect(() => {
		if ($navigating) {
			navStartTime = Date.now();
		} else if (navStartTime) {
			const duration = Date.now() - navStartTime;
			navStartTime = null;
		}
	});

	const courseSlug = $derived(data.courseSlug);
	const modules = $derived(data.modules || []);
	const enrollmentRole = $derived(data.enrollmentRole);
	const isCourseAdmin = $derived(data.isCourseAdmin);
	const cohorts = $derived(data.cohorts || []);
	const courseTheme = $derived(data.courseTheme || {});
	const courseBranding = $derived(data.courseBranding || {});

	// Default theme colors - use $derived to properly react to courseTheme changes
	const accentDark = $derived(courseTheme.accentDark || '#334642');
	const accentLight = $derived(courseTheme.accentLight || '#c59a6b');

	// Cohort wizard modal state
	let showCohortWizard = $state(false);

	// Extract cohort selection from URL - works on all admin pages
	const selectedCohortId = $derived($page.url.searchParams.get('cohort'));

	function handleNewCohort() {
		// Open modal directly - no navigation needed
		showCohortWizard = true;
	}

	// Expose to child pages via context
	setContext('openCohortWizard', handleNewCohort);

	async function handleWizardComplete(result) {
		showCohortWizard = false;
		await invalidateAll();

		// Navigate to the new cohort
		if (result?.cohortId) {
			goto(`/admin/courses/${courseSlug}?cohort=${result.cohortId}`);
		}
	}

	function handleSelectCohort(cohortId) {
		// Update cohort param while staying on current page
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('cohort', cohortId);
		goto(newUrl.toString());
	}

	function handleSettingsClick() {
		goto(`/admin/courses/${courseSlug}/settings`);
	}
</script>

<div
	class="admin-layout"
	style="--course-accent-dark: {accentDark}; --course-accent-light: {accentLight};"
>
	<!-- Mobile Navigation - visible on mobile only -->
	<CourseAdminMobileNav
		{courseSlug}
		{modules}
		{enrollmentRole}
		{isCourseAdmin}
		{cohorts}
		{courseBranding}
		selectedCohortId={selectedCohortId}
		onNewCohort={handleNewCohort}
		onSelectCohort={handleSelectCohort}
		onSettingsClick={handleSettingsClick}
	/>

	<!-- Desktop Sidebar - hidden on mobile -->
	<div class="hidden lg:block">
		<CourseAdminSidebar
			{courseSlug}
			{modules}
			{enrollmentRole}
			{isCourseAdmin}
			{cohorts}
			{courseBranding}
			selectedCohortId={selectedCohortId}
			onNewCohort={handleNewCohort}
			onSelectCohort={handleSelectCohort}
			onSettingsClick={handleSettingsClick}
		/>
	</div>

	<main class="admin-content">
		{@render children()}
	</main>

	<!-- Cohort Creation Wizard - inside layout for CSS variable access -->
	<CohortCreationWizard
		{courseSlug}
		{modules}
		show={showCohortWizard}
		onClose={() => showCohortWizard = false}
		onComplete={handleWizardComplete}
	/>
</div>

<style>
	.admin-layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background-color: var(--course-accent-dark);
	}

	/* Desktop: horizontal layout with sidebar */
	@media (min-width: 1024px) {
		.admin-layout {
			flex-direction: row;
		}
	}

	.admin-content {
		flex: 1;
		overflow-x: hidden;
		min-height: 0;
	}
</style>
