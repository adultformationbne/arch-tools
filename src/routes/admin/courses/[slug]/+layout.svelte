<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page, navigating } from '$app/stores';
	import { setContext, onMount } from 'svelte';
	import CourseAdminSidebar from '$lib/components/CourseAdminSidebar.svelte';
	import CourseAdminMobileNav from '$lib/components/CourseAdminMobileNav.svelte';
	import CohortCreationWizard from '$lib/components/CohortCreationWizard.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let { data, children } = $props();

	// Chat unread tracking
	let hasUnreadChat = $state(data.hasUnreadChat || false);
	const isOnChatPage = $derived($page.url.pathname.endsWith('/chat'));

	// Reset unread when navigating to chat page
	$effect(() => {
		if (isOnChatPage) {
			hasUnreadChat = false;
		}
	});

	// Update from server data on navigation
	$effect(() => {
		if (data.hasUnreadChat !== undefined) {
			hasUnreadChat = data.hasUnreadChat;
		}
	});

	// Track navigation timing
	/** @type {number | null} */
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
	const archivedCohorts = $derived(data.archivedCohorts || []);
	const courseTheme = $derived(data.courseTheme || {});
	const courseBranding = $derived(data.courseBranding || {});
	const courseFeatures = $derived(data.courseFeatures || {});

	// Default theme colors - use $derived to properly react to courseTheme changes
	const accentDark = $derived(courseTheme.accentDark || '#334642');
	const accentLight = $derived(courseTheme.accentLight || '#c59a6b');

	// Cohort wizard modal state
	let showCohortWizard = $state(false);

	let showArchiveConfirm = $state(false);
	let cohortToArchive = $state(null); // { id, name }

	// Extract cohort selection from URL - works on all admin pages
	const selectedCohortId = $derived($page.url.searchParams.get('cohort'));

	function handleNewCohort() {
		// Open modal directly - no navigation needed
		showCohortWizard = true;
	}

	// Expose to child pages via context
	setContext('openCohortWizard', handleNewCohort);

	/** @param {{ cohortId?: string }} result */
	async function handleWizardComplete(result) {
		showCohortWizard = false;
		await invalidateAll();

		// Navigate to the new cohort
		if (result?.cohortId) {
			goto(`/admin/courses/${courseSlug}?cohort=${result.cohortId}`);
		}
	}

	/** @param {string} cohortId */
	function handleSelectCohort(cohortId) {
		// Update cohort param while staying on current page
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('cohort', cohortId);
		goto(newUrl.toString());
	}

	function handleArchiveCohort(cohortId, cohortName) {
		cohortToArchive = { id: cohortId, name: cohortName };
		showArchiveConfirm = true;
	}

	async function confirmArchiveCohort() {
		if (!cohortToArchive) return;
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'archive_cohort', cohortId: cohortToArchive.id })
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.message);
			showArchiveConfirm = false;
			cohortToArchive = null;
			await invalidateAll();
		} catch (err) {
			console.error('Archive failed:', err);
		}
	}

	function handleSettingsClick() {
		goto(`/admin/courses/${courseSlug}/settings`);
	}

	// Realtime subscription for unread chat dot
	onMount(() => {
		const cohortId = selectedCohortId;
		if (!data.supabase || !cohortId) return;

		const channel = data.supabase
			.channel(`admin-chat-unread:${cohortId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'courses_chat_messages',
					filter: `cohort_id=eq.${cohortId}`
				},
				(/** @type {any} */ payload) => {
					if (!$page.url.pathname.endsWith('/chat') && payload.new.sender_id !== data.userId) {
						hasUnreadChat = true;
					}
				}
			)
			.subscribe();

		return () => {
			data.supabase?.removeChannel(channel);
		};
	});
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
		{archivedCohorts}
		{courseBranding}
		{courseFeatures}
		{hasUnreadChat}
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
			{archivedCohorts}
			{courseBranding}
			{courseFeatures}
			{hasUnreadChat}
			selectedCohortId={selectedCohortId}
			onNewCohort={handleNewCohort}
			onSelectCohort={handleSelectCohort}
			onArchiveCohort={handleArchiveCohort}
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
		{courseFeatures}
		show={showCohortWizard}
		onClose={() => showCohortWizard = false}
		onComplete={handleWizardComplete}
	/>
</div>

<!-- Archive cohort confirmation -->
<ConfirmationModal
	show={showArchiveConfirm}
	title="Archive Cohort"
	confirmText="Archive"
	cancelText="Cancel"
	onConfirm={confirmArchiveCohort}
	onCancel={() => { showArchiveConfirm = false; cohortToArchive = null; }}
>
	<p>Archive <strong>{cohortToArchive?.name}</strong>?</p>
	<p class="text-sm text-gray-500 mt-2">The cohort will be hidden from the main list but all data is preserved. You can restore or permanently delete it from Cohort Settings.</p>
</ConfirmationModal>

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
		overflow-x: clip;
		min-height: 0;
	}
</style>
