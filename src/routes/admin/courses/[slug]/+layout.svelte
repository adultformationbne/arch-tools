<script>
	import { goto } from '$app/navigation';
	import { page, navigating } from '$app/stores';
	import CourseAdminSidebar from '$lib/components/CourseAdminSidebar.svelte';

	let { data, children } = $props();

	// Track navigation timing
	let navStartTime = $state(null);

	$effect(() => {
		if ($navigating) {
			navStartTime = Date.now();
			console.log(`[CLIENT] 🚀 Navigation started: ${$navigating.from?.url.pathname} → ${$navigating.to?.url.pathname}`);
		} else if (navStartTime) {
			const duration = Date.now() - navStartTime;
			console.log(`[CLIENT] ✅ Navigation complete in ${duration}ms\n`);
			navStartTime = null;
		}
	});

	const courseSlug = data.courseSlug;
	const modules = data.userModules || [];
	const enrollmentRole = data.enrollmentRole;
	const isCourseAdmin = data.isCourseAdmin;
	const cohorts = data.cohorts || [];
	const courseTheme = data.courseTheme || {};
	const courseBranding = data.courseBranding || {};

	// Default theme colors
	const accentDark = courseTheme.accentDark || '#334642';
	const accentLight = courseTheme.accentLight || '#c59a6b';

	// Extract cohort selection from URL - works on all admin pages
	const selectedCohortId = $derived(() => {
		return $page.url.searchParams.get('cohort');
	});

	function handleNewCohort() {
		// Navigate to dashboard and trigger new cohort wizard
		goto(`/admin/courses/${courseSlug}?action=new-cohort`);
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
	<CourseAdminSidebar
		{courseSlug}
		{modules}
		{enrollmentRole}
		{isCourseAdmin}
		{cohorts}
		{courseBranding}
		selectedCohortId={selectedCohortId()}
		onNewCohort={handleNewCohort}
		onSelectCohort={handleSelectCohort}
		onSettingsClick={handleSettingsClick}
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
