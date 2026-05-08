<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page, navigating } from '$app/stores';
	import { setContext, onMount } from 'svelte';
	import CourseAdminSidebar from '$lib/components/CourseAdminSidebar.svelte';
	import CourseAdminMobileNav from '$lib/components/CourseAdminMobileNav.svelte';
	import CohortCreationWizard from '$lib/components/CohortCreationWizard.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';

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

	let showDeleteCohortConfirm = $state(false);
	let cohortToDelete = $state(null); // { id, name }
	let deleteCohortConfirmName = $state('');
	let deletingCohort = $state(false);
	const deleteCohortNameMatches = $derived(
		deleteCohortConfirmName.trim().toLowerCase() === (cohortToDelete?.name || '').trim().toLowerCase()
	);

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

	function handleDeleteCohort(cohortId, cohortName) {
		cohortToDelete = { id: cohortId, name: cohortName };
		showDeleteCohortConfirm = true;
	}

	async function confirmDeleteCohort() {
		if (!cohortToDelete) return;
		deletingCohort = true;
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'delete_cohort', cohortId: cohortToDelete.id })
			});
			const result = await response.json();
			if (!result.success) throw new Error(result.message);
			toastSuccess('Cohort permanently deleted');
			showDeleteCohortConfirm = false;
			cohortToDelete = null;
			deleteCohortConfirmName = '';
			await invalidateAll();
		} catch (err) {
			console.error('Delete failed:', err);
			toastError(err.message || 'Failed to delete cohort');
		} finally {
			deletingCohort = false;
		}
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
			onDeleteCohort={handleDeleteCohort}
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

<!-- Delete cohort confirmation (type-to-confirm) -->
<ConfirmationModal
	show={showDeleteCohortConfirm}
	title="Permanently Delete Cohort"
	confirmText={deletingCohort ? 'Deleting...' : 'Delete Permanently'}
	confirmVariant="danger"
	cancelText="Cancel"
	confirmDisabled={!deleteCohortNameMatches || deletingCohort}
	onConfirm={confirmDeleteCohort}
	onCancel={() => { showDeleteCohortConfirm = false; cohortToDelete = null; deleteCohortConfirmName = ''; }}
>
	<div class="flex items-start gap-3">
		<div class="p-2 bg-red-100 rounded-full flex-shrink-0">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
		</div>
		<div class="flex-1">
			<p class="font-medium">Permanently delete "{cohortToDelete?.name}"?</p>
			<p class="text-sm mt-1">This will permanently delete the cohort and all associated data:</p>
			<ul class="text-sm mt-1 list-disc list-inside">
				<li>All enrollments</li>
				<li>Attendance records</li>
				<li>Reflection responses</li>
				<li>Chat messages</li>
				<li>Activity logs</li>
			</ul>
			<p class="text-sm text-red-400 font-semibold mt-2">This action cannot be undone.</p>
			<div class="mt-3">
				<label for="layout-delete-confirm-name" class="block text-sm mb-1">
					Type <strong>{cohortToDelete?.name}</strong> to confirm:
				</label>
				<input
					id="layout-delete-confirm-name"
					type="text"
					bind:value={deleteCohortConfirmName}
					class="w-full px-3 py-2 rounded-lg text-sm"
					placeholder={cohortToDelete?.name}
					autocomplete="off"
				/>
			</div>
		</div>
	</div>
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
