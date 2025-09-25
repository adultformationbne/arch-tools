<script>
	let {
		title = 'Live Preview',
		previewHtml = '',
		isReady = false,
		readyMessage = 'Ready',
		waitingMessage = 'Waiting for content',
		emptyStateTitle = 'Fill in the form to see preview',
		emptyStateSubtitle = 'Enter title and reflection text to get started'
	} = $props();
</script>

<!-- Preview Header -->
<div class="p-4 border-b border-gray-200 bg-white">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold text-gray-900">{title}</h2>
		<div class="flex items-center gap-2 text-xs text-gray-600">
			<div class="w-2 h-2 rounded-full {isReady ? 'bg-green-500' : 'bg-gray-300'}"></div>
			{isReady ? readyMessage : waitingMessage}
		</div>
	</div>
</div>

<!-- Preview Content (scrollable) -->
<div class="flex-1 overflow-y-auto bg-white">
	{#if isReady && previewHtml}
		<div class="h-full">
			{@html previewHtml}
		</div>
	{:else}
		<div class="flex items-center justify-center h-full text-gray-500">
			<div class="text-center p-8">
				<div class="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
					<svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
					</svg>
				</div>
				<p class="text-sm font-medium">{emptyStateTitle}</p>
				<p class="text-xs text-gray-400 mt-1">{emptyStateSubtitle}</p>
			</div>
		</div>
	{/if}
</div>