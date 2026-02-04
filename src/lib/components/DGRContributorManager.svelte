<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { needsFollowUp, formatRelativeTime } from '$lib/utils/dgr-helpers';
	import DGRContributorsCsvUpload from './DGRContributorsCsvUpload.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';
	import DGRActionButtons from './DGRActionButtons.svelte';
	import DGRContributorStats from './DGRContributorStats.svelte';
	import DGRAddContributorForm from './DGRAddContributorForm.svelte';
	import DGRContributorTable from './DGRContributorTable.svelte';
	import DGREditContributorModal from './DGREditContributorModal.svelte';

	let {
		contributors = [],
		onAddContributor = () => {},
		onUpdateContributor = () => {},
		onDeleteContributor = () => {},
		onBulkImport = () => {},
		onRefresh = () => {}
	} = $props();

	// UI state
	let formExpanded = $state(false);
	let showImportModal = $state(false);
	let openMenuId = $state(null);

	// Welcome email state
	let sendingWelcomeIds = $state(new Set());
	let showBulkWelcomeConfirm = $state(false);
	let selectedForWelcome = $state([]);
	let showSingleWelcomeConfirm = $state(false);
	let singleWelcomeTarget = $state(null);
	let isResend = $state(false);

	// Edit/Delete state
	let showEditModal = $state(false);
	let editingContributor = $state(null);
	let showDeleteConfirm = $state(false);
	let deletingContributor = $state(null);
	let isDeleting = $state(false);

	// Derived stats (exclude guests from email/visit stats)
	let regularContributors = $derived(contributors.filter(c => !c.is_guest));
	let guestCount = $derived(contributors.filter(c => c.is_guest).length);
	let unwelcomedCount = $derived(
		regularContributors.filter(c => c.active && c.access_token && !c.welcome_email_sent_at).length
	);
	let welcomedCount = $derived(regularContributors.filter(c => c.welcome_email_sent_at).length);
	let visitedCount = $derived(regularContributors.filter(c => c.last_visited_at).length);
	let needsFollowUpCount = $derived(regularContributors.filter(c => needsFollowUp(c)).length);
	let isSending = $derived(sendingWelcomeIds.size > 0);

	// Menu handlers
	function toggleMenu(id) {
		openMenuId = openMenuId === id ? null : id;
	}

	function closeMenu() {
		openMenuId = null;
	}

	function handleClickOutside(event) {
		if (openMenuId && !event.target.closest('.relative')) {
			closeMenu();
		}
	}

	// Bulk import handler
	async function handleBulkImport(contributorsData) {
		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'bulk_import',
					contributors: contributorsData
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			showImportModal = false;

			if (data.results.successful > 0) {
				toast.success({
					title: 'Import Complete',
					message: `${data.results.successful} contributor(s) added successfully${data.results.failed > 0 ? `, ${data.results.failed} skipped` : ''}`,
					duration: 4000
				});
			}

			if (data.results.failed > 0 && data.results.successful === 0) {
				toast.error({
					title: 'Import Failed',
					message: `All ${data.results.failed} entries failed. Check for duplicates.`,
					duration: 4000
				});
			}

			await onBulkImport();
		} catch (error) {
			toast.error({ title: 'Import Failed', message: error.message, duration: 4000 });
		}
	}

	// Welcome email handlers
	async function sendWelcomeEmail(contributorIds, contributorName = null) {
		contributorIds.forEach(id => {
			sendingWelcomeIds = new Set([...sendingWelcomeIds, id]);
		});

		try {
			const response = await fetch('/api/dgr/welcome', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contributorIds })
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			if (data.results.sent > 0) {
				const message = contributorName
					? `Welcome email sent to ${contributorName}`
					: `${data.results.sent} email(s) sent successfully`;
				toast.success({
					title: isResend ? 'Welcome Email Resent' : 'Welcome Email Sent',
					message,
					duration: 4000
				});
			}

			if (data.results.skipped > 0) {
				toast.warning({
					title: 'Some Skipped',
					message: `${data.results.skipped} contributor(s) skipped (no access token)`,
					duration: 4000
				});
			}

			if (data.results.failed > 0) {
				toast.error({
					title: 'Some Failed',
					message: `${data.results.failed} email(s) failed to send`,
					duration: 4000
				});
			}

			await onRefresh();
		} catch (error) {
			toast.error({ title: 'Send Failed', message: error.message, duration: 4000 });
		} finally {
			const newSet = new Set(sendingWelcomeIds);
			contributorIds.forEach(id => newSet.delete(id));
			sendingWelcomeIds = newSet;

			showBulkWelcomeConfirm = false;
			showSingleWelcomeConfirm = false;
			selectedForWelcome = [];
			singleWelcomeTarget = null;
			isResend = false;
		}
	}

	function handleSendSingleWelcome(contributor) {
		singleWelcomeTarget = contributor;
		isResend = false;
		showSingleWelcomeConfirm = true;
	}

	function handleResendWelcome(contributor) {
		singleWelcomeTarget = contributor;
		isResend = true;
		showSingleWelcomeConfirm = true;
	}

	function confirmSingleWelcome() {
		if (singleWelcomeTarget) {
			sendWelcomeEmail([singleWelcomeTarget.id], singleWelcomeTarget.name);
		}
	}

	function handleBulkWelcomeClick() {
		selectedForWelcome = contributors
			.filter(c => !c.is_guest && c.active && c.access_token && !c.welcome_email_sent_at)
			.map(c => c.id);

		if (selectedForWelcome.length === 0) {
			toast.warning({
				title: 'No Recipients',
				message: 'All active contributors have already received welcome emails',
				duration: 3000
			});
			return;
		}

		showBulkWelcomeConfirm = true;
	}

	function confirmBulkWelcome() {
		sendWelcomeEmail(selectedForWelcome);
	}

	// Edit handlers
	function openEditModal(contributor) {
		editingContributor = contributor;
		showEditModal = true;
	}

	async function handleSaveEdit(contributorId, updates) {
		await onUpdateContributor(contributorId, updates);
		await onRefresh();
	}

	// Delete handlers
	function openDeleteConfirm(contributor) {
		deletingContributor = contributor;
		showDeleteConfirm = true;
	}

	async function confirmDelete() {
		if (!deletingContributor) return;

		isDeleting = true;
		try {
			await onDeleteContributor(deletingContributor.id);
			toast.success({ title: 'Deleted', message: `${deletingContributor.name} has been removed`, duration: 2000 });
			showDeleteConfirm = false;
			deletingContributor = null;
			onRefresh();
		} catch (error) {
			toast.error({ title: 'Error', message: error.message || 'Failed to delete contributor', duration: 3000 });
		} finally {
			isDeleting = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="space-y-6">
	<DGRActionButtons
		{isSending}
		{unwelcomedCount}
		onToggleForm={() => formExpanded = !formExpanded}
		onShowImport={() => showImportModal = true}
		onBulkWelcome={handleBulkWelcomeClick}
	/>

	<DGRContributorStats
		totalCount={contributors.length}
		{welcomedCount}
		{visitedCount}
		{needsFollowUpCount}
		{guestCount}
	/>

	<DGRAddContributorForm
		bind:expanded={formExpanded}
		{onAddContributor}
	/>

	<DGRContributorTable
		{contributors}
		{sendingWelcomeIds}
		{openMenuId}
		onToggleMenu={toggleMenu}
		onCloseMenu={closeMenu}
		onSendWelcome={handleSendSingleWelcome}
		onResendWelcome={handleResendWelcome}
		onEdit={openEditModal}
		onDelete={openDeleteConfirm}
	/>
</div>

<!-- Import Modal -->
{#if showImportModal}
	<DGRContributorsCsvUpload
		onUpload={handleBulkImport}
		onClose={() => showImportModal = false}
	/>
{/if}

<!-- Single Welcome Email Confirmation -->
<ConfirmationModal
	show={showSingleWelcomeConfirm}
	onConfirm={confirmSingleWelcome}
	onCancel={() => { showSingleWelcomeConfirm = false; singleWelcomeTarget = null; isResend = false; }}
	confirmText={isSending ? 'Sending...' : (isResend ? 'Resend Email' : 'Send Email')}
	confirmDisabled={isSending}
	title={isResend ? 'Resend Welcome Email' : 'Send Welcome Email'}
>
	{#if singleWelcomeTarget}
		<p class="text-gray-600">
			{#if isResend}
				Resend the welcome email to <strong>{singleWelcomeTarget.name}</strong>?
			{:else}
				Send a welcome email to <strong>{singleWelcomeTarget.name}</strong> ({singleWelcomeTarget.email})?
			{/if}
		</p>
		{#if isResend}
			<p class="mt-2 text-sm text-gray-500">
				They were previously sent a welcome email {formatRelativeTime(singleWelcomeTarget.welcome_email_sent_at)}.
				{#if !singleWelcomeTarget.last_visited_at}
					They haven't visited their page yet.
				{/if}
			</p>
		{:else}
			<p class="mt-2 text-sm text-gray-500">
				The email includes their personal link to view assigned dates and submit reflections.
			</p>
		{/if}
	{/if}
</ConfirmationModal>

<!-- Bulk Welcome Email Confirmation -->
<ConfirmationModal
	show={showBulkWelcomeConfirm}
	onConfirm={confirmBulkWelcome}
	onCancel={() => { showBulkWelcomeConfirm = false; selectedForWelcome = []; }}
	confirmText={isSending ? 'Sending...' : 'Send Emails'}
	confirmDisabled={isSending}
	title="Send Welcome Emails"
>
	<p class="text-gray-600">
		This will send welcome emails to <strong>{selectedForWelcome.length}</strong> contributor{selectedForWelcome.length !== 1 ? 's' : ''} who haven't received one yet.
	</p>
	<p class="mt-2 text-sm text-gray-500">
		Each email includes their personal link to view assigned dates and submit reflections.
	</p>
</ConfirmationModal>

<!-- Edit Contributor Modal -->
<DGREditContributorModal
	show={showEditModal}
	contributor={editingContributor}
	onSave={handleSaveEdit}
	onClose={() => { showEditModal = false; editingContributor = null; }}
/>

<!-- Delete Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	onConfirm={confirmDelete}
	onCancel={() => { showDeleteConfirm = false; deletingContributor = null; }}
	confirmText={isDeleting ? 'Deleting...' : 'Delete'}
	confirmDisabled={isDeleting}
	title="Delete Contributor"
	danger={true}
>
	{#if deletingContributor}
		<p class="text-gray-600">
			Are you sure you want to delete <strong>{deletingContributor.name}</strong>?
		</p>
		<p class="mt-2 text-sm text-gray-500">
			This will remove them from the system. Any assigned reflections will need to be reassigned.
		</p>
	{/if}
</ConfirmationModal>
