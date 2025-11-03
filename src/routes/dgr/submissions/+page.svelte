<script>
	import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRReviewModal from '$lib/components/DGRReviewModal.svelte';
	import DGRScheduleTable from '$lib/components/DGRScheduleTable.svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';

	let schedule = $state([]);
	let contributors = $state([]);
	let loading = $state(true);
	let reviewModalOpen = $state(false);
	let selectedReflection = $state(null);
	let scheduleDays = $state(90);

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

	$effect(() => {
		(async () => {
			await Promise.all([loadSchedule(), loadContributors()]);
			loading = false;
		})();
	});

	async function loadSchedule() {
		try {
			const response = await fetch(`/api/dgr-admin/schedule?days=${scheduleDays}`);
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

	// Filter to only show submissions
	let filteredSchedule = $derived(
		schedule.filter(
			(entry) =>
				entry.reflection_content ||
				entry.status === 'submitted' ||
				entry.status === 'approved' ||
				entry.status === 'published'
		)
	);

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

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Submissions</h1>
			<p class="mt-1 text-sm text-gray-600">Review and manage submitted reflections</p>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<div class="space-y-6">
			<!-- Filters -->
			<div class="rounded-lg bg-white p-4 shadow-sm">
				<div class="flex items-center gap-6">
					<div class="flex items-center gap-2">
						<label for="days-range" class="text-sm font-medium text-gray-700">Days Range:</label>
						<select
							id="days-range"
							bind:value={scheduleDays}
							onchange={loadSchedule}
							class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value={30}>30 days</option>
							<option value={60}>60 days</option>
							<option value={90}>90 days</option>
							<option value={180}>180 days</option>
							<option value={365}>1 year</option>
						</select>
					</div>
					<div class="text-sm text-gray-600">
						Showing {filteredSchedule.length} submission{filteredSchedule.length !== 1 ? 's' : ''}
					</div>
				</div>
			</div>

			{#if filteredSchedule.length === 0}
				<div class="rounded-lg bg-white p-12 text-center shadow-sm">
					<p class="text-gray-500">No submissions found</p>
				</div>
			{:else}
				<DGRScheduleTable
					schedule={filteredSchedule}
					{contributors}
					{statusColors}
					{statusOptions}
					onUpdateStatus={updateStatus}
					onOpenReviewModal={openReviewModal}
					onSendToWordPress={sendToWordPress}
					onApproveReflection={approveReflection}
					hideEmptyEntries={true}
				/>
			{/if}
		</div>
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

<ToastContainer />
