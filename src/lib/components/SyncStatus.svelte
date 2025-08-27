<script>
	let { syncStatus = {
		pendingCount: 0,
		isProcessing: false,
		lastSync: null,
		hasErrors: false
	} } = $props();

	let showDetails = $state(false);

	function formatTime(isoString) {
		if (!isoString) return 'Never';
		return new Date(isoString).toLocaleTimeString();
	}

	let statusColor = $derived(
		syncStatus?.hasErrors ? 'text-red-500' :
		syncStatus?.pendingCount > 0 ? 'text-amber-500' :
		'text-green-500'
	);

	let statusIcon = $derived(
		syncStatus?.hasErrors ? '⚠️' :
		syncStatus?.isProcessing ? '🔄' :
		syncStatus?.pendingCount > 0 ? '⏳' :
		'✅'
	);

	let statusText = $derived(
		syncStatus?.hasErrors ? 'Sync Error' :
		syncStatus?.isProcessing ? 'Syncing...' :
		syncStatus?.pendingCount > 0 ? `${syncStatus.pendingCount} pending` :
		'All synced'
	);
</script>

<div class="relative">
	<!-- Status Indicator -->
	<button
		onclick={() => (showDetails = !showDetails)}
		class="flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm transition-colors hover:bg-gray-50 {statusColor}"
		title="Click for sync details"
	>
		<span class="text-base">{statusIcon}</span>
		<span class="font-medium">{statusText}</span>
	</button>

	<!-- Details Popover -->
	{#if showDetails}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
		>
			<div class="space-y-3">
				<div class="flex items-center justify-between border-b pb-2">
					<h3 class="font-semibold text-gray-900">Sync Status</h3>
					<button onclick={() => (showDetails = false)} class="text-gray-400 hover:text-gray-600">
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-600">Status:</span>
						<span class="{statusColor} font-medium">{statusText}</span>
					</div>

					<div class="flex justify-between">
						<span class="text-gray-600">Pending operations:</span>
						<span class="font-medium">{syncStatus.pendingCount}</span>
					</div>

					<div class="flex justify-between">
						<span class="text-gray-600">Processing:</span>
						<span class="font-medium">{syncStatus.isProcessing ? 'Yes' : 'No'}</span>
					</div>

					<div class="flex justify-between">
						<span class="text-gray-600">Last sync:</span>
						<span class="font-medium">{formatTime(syncStatus.lastSync)}</span>
					</div>
				</div>

				{#if syncStatus.hasErrors}
					<div class="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
						Sync errors detected. Operations will be retried automatically.
					</div>
				{:else if syncStatus.pendingCount > 0}
					<div class="rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">
						Changes are being synced in the background. Your edits are saved locally.
					</div>
				{:else}
					<div class="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
						All changes have been successfully synced to the server.
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Click outside to close -->
{#if showDetails}
	<div class="fixed inset-0 z-40" onclick={() => (showDetails = false)}></div>
{/if}
