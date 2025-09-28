<script>
	import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRReviewModal from '$lib/components/DGRReviewModal.svelte';
	import DGRScheduleTable from '$lib/components/DGRScheduleTable.svelte';
	import DGRScheduleGenerator from '$lib/components/DGRScheduleGenerator.svelte';
	import DGRContributorManager from '$lib/components/DGRContributorManager.svelte';
	import DGRPromoTilesEditor from '$lib/components/DGRPromoTilesEditor.svelte';
	import ContextualHelp from '$lib/components/ContextualHelp.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import { getHelpForPage, getPageTitle } from '$lib/data/help-content.js';
	import { onMount } from 'svelte';
	import { Eye, Send, ExternalLink, Trash2 } from 'lucide-svelte';

	let schedule = $state([]);
	let contributors = $state([]);
	let loading = $state(true);
	let activeTab = $state('schedule');
	let reviewModalOpen = $state(false);
	let selectedReflection = $state(null);
	let confirmDeleteModal = $state({ open: false, entry: null });
	
	// Promo tiles state - start with 1 tile, can add up to 3
	let promoTiles = $state([
		{ position: 1, image_url: '', title: '', link_url: '' }
	]);
	let savingTiles = $state(false);

	// Form states
	let generateForm = $state({
		startDate: new Date().toISOString().split('T')[0],
		days: 14
	});

	let newContributor = $state({
		name: '',
		email: '',
		preferred_days: [],
		day_of_month: null,
		notes: ''
	});

	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const statusColors = {
		pending: 'bg-yellow-100 text-yellow-800',
		submitted: 'bg-blue-100 text-blue-800',
		approved: 'bg-green-100 text-green-800',
		published: 'bg-purple-100 text-purple-800'
	};

	const statusOptions = [
		{ value: 'pending', label: 'Pending' },
		{ value: 'submitted', label: 'Needs Approval' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'published', label: 'Published' }
	];

	onMount(async () => {
		await Promise.all([loadSchedule(), loadContributors(), loadPromoTiles()]);
		loading = false;
	});

	async function loadSchedule() {
		try {
			const response = await fetch('/api/dgr-admin/schedule?days=30');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			schedule = data.schedule || [];
		} catch (error) {
			toast.error({
				title: 'Failed to load schedule',
				message: error.message,
				duration: DURATIONS.medium
			});
		}
	}

	async function loadContributors() {
		try {
			const response = await fetch('/api/dgr-admin/contributors');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			contributors = data.contributors || [];
		} catch (error) {
			toast.error({
				title: 'Failed to load contributors',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function loadPromoTiles() {
		try {
			const response = await fetch('/api/dgr-admin/promo-tiles');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			
			// Update the promoTiles array with fetched data
			if (data.tiles && data.tiles.length > 0) {
				// Only include tiles that have image URLs (not empty ones)
				const activeTiles = data.tiles.filter(tile => tile.image_url);
				if (activeTiles.length > 0) {
					promoTiles = activeTiles.map(tile => ({
						position: tile.position,
						image_url: tile.image_url || '',
						title: tile.title || '',
						link_url: tile.link_url || ''
					}));
				} else {
					// No active tiles, start with one empty tile
					promoTiles = [{ position: 1, image_url: '', title: '', link_url: '' }];
				}
			}
		} catch (error) {
			console.error('Failed to load promo tiles:', error);
		}
	}

	async function savePromoTiles() {
		savingTiles = true;
		const loadingId = toast.loading({
			title: 'Saving promo tiles...',
			message: 'Updating promotional content'
		});

		try {
			// Only save tiles that have image URLs, reposition them as 1, 2, 3
			const tilesToSave = promoTiles
				.filter(tile => tile.image_url && tile.image_url.trim())
				.map((tile, index) => ({
					...tile,
					position: index + 1
				}));

			const response = await fetch('/api/dgr-admin/promo-tiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tiles: tilesToSave })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.dismiss(loadingId);
			toast.success({
				title: 'Promo tiles saved',
				message: `${tilesToSave.length} promotional tile${tilesToSave.length !== 1 ? 's' : ''} updated`,
				duration: 3000
			});

			// Reload to refresh positions
			await loadPromoTiles();
		} catch (error) {
			toast.dismiss(loadingId);
			toast.error({
				title: 'Failed to save promo tiles',
				message: error.message,
				duration: 5000
			});
		} finally {
			savingTiles = false;
		}
	}

	function addTile() {
		if (promoTiles.length < 3) {
			promoTiles.push({
				position: promoTiles.length + 1,
				image_url: '',
				title: '',
				link_url: ''
			});
		}
	}

	function removeTile(index) {
		if (promoTiles.length > 1) {
			promoTiles.splice(index, 1);
			// Update positions
			promoTiles.forEach((tile, idx) => {
				tile.position = idx + 1;
			});
		}
	}

	async function generateSchedule() {
		const loadingId = toast.loading({
			title: 'Generating schedule...',
			message: 'Creating assignments for the next ' + generateForm.days + ' days'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'generate_schedule',
					startDate: generateForm.startDate,
					days: generateForm.days
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Schedule generated!',
				message: data.message,
				type: 'success',
				duration: 4000
			});

			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Generation failed',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		}
	}

	async function updateAssignment(scheduleId, contributorId) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_assignment',
					scheduleId,
					contributorId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Assignment updated',
				message: 'Contributor assignment changed successfully',
				duration: DURATIONS.short
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Update failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function approveReflection(scheduleId) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'approve_reflection',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Reflection approved',
				message: 'Reflection has been approved and is ready for publishing',
				duration: DURATIONS.short
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Approval failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function updateStatus(scheduleId, newStatus) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_status',
					scheduleId,
					status: newStatus
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			const statusLabels = {
				pending: 'set to Pending',
				submitted: 'marked as Needs Approval',
				approved: 'approved',
				published: 'marked as Published'
			};

			toast.success({
				title: 'Status updated',
				message: `Reflection ${statusLabels[newStatus]}`,
				duration: DURATIONS.short
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Status update failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function addContributor() {
		if (!newContributor.name || !newContributor.email) {
			toast.warning({
				title: 'Missing information',
				message: 'Name and email are required',
				duration: DURATIONS.short
			});
			return;
		}

		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newContributor)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Contributor added',
				message: `${newContributor.name} has been added successfully`,
				duration: DURATIONS.short
			});

			newContributor = { name: '', email: '', preferred_days: [], day_of_month: null, notes: '' };
			await loadContributors();
		} catch (error) {
			toast.error({
				title: 'Failed to add contributor',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function saveReflection(reflectionData) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'save_reflection',
					...reflectionData
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			await loadSchedule();
			return data.schedule;
		} catch (error) {
			throw error;
		}
	}

	async function sendToWordPress(scheduleId) {
		const loadingId = toast.loading({
			title: 'Sending to WordPress...',
			message: 'Publishing reflection to WordPress'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'send_to_wordpress',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Published to WordPress!',
				message: 'Reflection has been published successfully',
				type: 'success',
				duration: 4000
			});

			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Publishing failed',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		}
	}

	function openReviewModal(entry) {
		selectedReflection = entry;
		reviewModalOpen = true;
	}

	function getSubmissionUrl(token) {
		return `${window.location.origin}/dgr/submit/${token}`;
	}

	function copySubmissionUrl(token) {
		const url = getSubmissionUrl(token);
		navigator.clipboard.writeText(url).then(() => {
			toast.success({
				title: 'Copied!',
				message: 'Submission link copied to clipboard',
				duration: DURATIONS.short
			});
		}).catch(() => {
			toast.error({
				title: 'Copy Failed',
				message: 'Could not access clipboard',
				duration: DURATIONS.short
			});
		});
	}

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function togglePreferredDay(day) {
		if (newContributor.preferred_days.includes(day)) {
			newContributor.preferred_days = newContributor.preferred_days.filter((d) => d !== day);
		} else {
			newContributor.preferred_days = [...newContributor.preferred_days, day];
		}
	}

	function hasScheduleData(entry) {
		return entry.reflection_title || entry.reflection_content || entry.status !== 'pending';
	}

	function openDeleteConfirm(entry) {
		confirmDeleteModal = { open: true, entry };
	}

	function closeDeleteConfirm() {
		confirmDeleteModal = { open: false, entry: null };
	}

	async function deleteScheduleEntry(scheduleId) {
		// Optimistically remove from UI
		const originalSchedule = [...schedule];
		const deletedEntry = schedule.find(entry => entry.id === scheduleId);
		schedule = schedule.filter(entry => entry.id !== scheduleId);

		const loadingId = toast.loading({
			title: 'Removing entry...',
			message: 'Deleting schedule entry'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_schedule',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Removed!',
				message: `Entry for ${formatDate(deletedEntry.date)} deleted`,
				type: 'success',
				duration: DURATIONS.short
			});
		} catch (error) {
			// Revert optimistic update on error
			schedule = originalSchedule;
			toast.updateToast(loadingId, {
				title: 'Delete Failed',
				message: error.message,
				type: 'error',
				duration: DURATIONS.medium
			});
		}

		closeDeleteConfirm();
	}

</script>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Daily Gospel Reflections</h1>
			<p class="mt-1 text-sm text-gray-600">Unified management platform with full liturgical readings integration</p>
		</div>
		<div class="text-sm text-gray-600">Admin Dashboard</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<!-- Tabs -->
		<div class="mb-6 border-b border-gray-200">
			<nav class="-mb-px flex space-x-8">
				<button
					onclick={() => (activeTab = 'schedule')}
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'schedule'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Schedule ({schedule.length})
				</button>
				<button
					onclick={() => (activeTab = 'contributors')}
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'contributors'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Contributors ({contributors.length})
				</button>
				<button
					onclick={() => (activeTab = 'promo')}
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'promo'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
				>
					Promo Tiles
				</button>
				<a
					href="/dgr-publish"
					class="border-b-2 px-1 py-2 text-sm font-medium border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center"
				>
					<ExternalLink class="w-4 h-4 mr-1" />
					Quick Publish
				</a>
				<a
					href="/dgr-templates"
					class="border-b-2 px-1 py-2 text-sm font-medium border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center"
				>
					<ExternalLink class="w-4 h-4 mr-1" />
					Templates
				</a>
			</nav>
		</div>

		{#if activeTab === 'schedule'}
			<!-- Schedule Tab -->
			<div class="space-y-6">
				<DGRScheduleGenerator
					formData={generateForm}
					onGenerate={generateSchedule}
				/>

				<DGRScheduleTable
					{schedule}
					{contributors}
					{statusColors}
					{statusOptions}
					onUpdateAssignment={updateAssignment}
					onUpdateStatus={updateStatus}
					onOpenReviewModal={openReviewModal}
					onSendToWordPress={sendToWordPress}
					onOpenDeleteConfirm={openDeleteConfirm}
					onCopySubmissionUrl={copySubmissionUrl}
				/>
			</div>
		{:else if activeTab === 'contributors'}
			<!-- Contributors Tab -->
			<DGRContributorManager
				{contributors}
				{dayNames}
				onAddContributor={addContributor}
				onUpdateContributor={async (contributorId, updates) => {
					try {
						const response = await fetch('/api/dgr-admin/contributors', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ id: contributorId, ...updates })
						});
						if (!response.ok) throw new Error('Update failed');

						// Update local state
						const contributorIndex = contributors.findIndex(c => c.id === contributorId);
						if (contributorIndex !== -1) {
							Object.assign(contributors[contributorIndex], updates);
						}

						toast.success({
							title: 'Contributor updated',
							message: `Settings saved successfully`,
							duration: 2000
						});
					} catch (error) {
						toast.error({
							title: 'Update failed',
							message: error.message,
							duration: 3000
						});
					}
				}}
			/>
		{:else if activeTab === 'promo'}
			<!-- Promo Tiles Tab -->
			<DGRPromoTilesEditor
				tiles={promoTiles}
				savingState={savingTiles}
				onSave={savePromoTiles}
				onAddTile={addTile}
				onRemoveTile={removeTile}
			/>
		{/if}
	{/if}
</div>

<!-- Review Modal -->
<DGRReviewModal
	bind:isOpen={reviewModalOpen}
	bind:reflection={selectedReflection}
	onSave={saveReflection}
	onApprove={approveReflection}
	onSendToWordPress={sendToWordPress}
/>

<!-- Delete Confirmation Modal -->
<Modal
	isOpen={confirmDeleteModal.open}
	title="Remove Schedule Entry"
	onClose={closeDeleteConfirm}
	size="sm"
>
	{#if confirmDeleteModal.entry}
		<div class="flex items-start gap-4">
			<div class="flex-shrink-0">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
					<Trash2 class="h-5 w-5 text-red-600" />
				</div>
			</div>
			<div class="flex-1">
				<p class="text-sm text-gray-500">
					Are you sure you want to remove the schedule entry for
					<strong>{formatDate(confirmDeleteModal.entry.date)}</strong>?
				</p>

				{#if hasScheduleData(confirmDeleteModal.entry)}
					<div class="mt-3 rounded-md bg-yellow-50 p-3">
						<div class="flex">
							<div class="ml-3">
								<h3 class="text-sm font-medium text-yellow-800">
									This entry contains data
								</h3>
								<div class="mt-1 text-sm text-yellow-700">
									<p>This schedule entry has reflection content or has been submitted. Removing it will permanently delete this data.</p>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<p class="mt-3 text-sm text-gray-400">
					This action cannot be undone. You can regenerate the schedule entry later.
				</p>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex gap-3">
			<button
				onclick={closeDeleteConfirm}
				class="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				onclick={() => deleteScheduleEntry(confirmDeleteModal.entry.id)}
				class="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
			>
				Remove Entry
			</button>
		</div>
	{/snippet}
</Modal>

<!-- Contextual Help -->
<ContextualHelp
	helpContent={getHelpForPage('/dgr')}
	pageTitle={getPageTitle('/dgr')}
	mode="sidebar"
	position="right"
	autoShow={true}
/>

<ToastContainer />
