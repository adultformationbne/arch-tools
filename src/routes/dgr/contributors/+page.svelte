<script>
	import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRContributorManager from '$lib/components/DGRContributorManager.svelte';

	let contributors = $state([]);
	let loading = $state(true);

	$effect(() => {
		(async () => {
			await loadContributors();
			loading = false;
		})();
	});

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
				duration: DURATIONS.medium
			});
		}
	}

	async function addContributor(contributorData) {
		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(contributorData)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Contributor added',
				message: `${contributorData.name} has been added successfully`,
				duration: DURATIONS.short
			});

			await loadContributors();
		} catch (error) {
			toast.error({
				title: 'Failed to add contributor',
				message: error.message,
				duration: DURATIONS.medium
			});
		}
	}

	async function updateContributor(contributorId, updates) {
		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: contributorId, ...updates })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			await loadContributors();
		} catch (error) {
			toast.error({
				title: 'Failed to update contributor',
				message: error.message,
				duration: DURATIONS.medium
			});
			throw error;
		}
	}

	async function deleteContributor(contributorId) {
		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: contributorId })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			await loadContributors();
		} catch (error) {
			toast.error({
				title: 'Failed to delete contributor',
				message: error.message,
				duration: DURATIONS.medium
			});
			throw error;
		}
	}
</script>

<div class="mx-auto max-w-7xl p-4 sm:p-6">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900">Contributors</h1>
		<p class="mt-1 text-sm text-gray-600">
			Manage people who write daily gospel reflections and their schedule patterns
		</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<DGRContributorManager
			{contributors}
			onAddContributor={addContributor}
			onUpdateContributor={updateContributor}
			onDeleteContributor={deleteContributor}
			onBulkImport={loadContributors}
			onRefresh={loadContributors}
		/>
	{/if}
</div>

<ToastContainer />
