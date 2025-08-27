<script>
	import { appState } from '$lib/stores/state.svelte.js';

	// Log state changes
	$effect(() => {
		console.log('🧭 Navigation - chapters available:', appState.filteredChapters.length);
	});

	function jumpToChapter(chapterId) {
		const element = document.getElementById(chapterId);
		element?.scrollIntoView({ behavior: 'smooth' });
	}

	function expandChapter(chapterId) {
		appState.expandChapter(chapterId);
		jumpToChapter(chapterId);
	}

	const contentTypes = [
		{ value: 'all', label: 'All Content' },
		{ value: 'paragraph', label: 'Paragraphs' },
		{ value: 'callout_text', label: 'Callouts' },
		{ value: 'callout_header', label: 'Callout Headers' },
		{ value: 'header', label: 'Headers' },
		{ value: 'special_text', label: 'Special Text' }
	];
</script>

<nav class="flex h-full flex-col bg-gray-50">
	<!-- Search Section -->
	<div class="search-section border-b border-gray-200 p-4">
		<div class="mb-3">
			<label for="search" class="mb-1 block text-sm font-medium text-gray-700">
				Search Content
			</label>
			<input
				id="search"
				type="text"
				placeholder="Search chapters and content..."
				bind:value={appState.searchQuery}
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
		</div>

		<div class="mb-3">
			<label for="filter" class="mb-1 block text-sm font-medium text-gray-700">
				Content Type
			</label>
			<select
				id="filter"
				bind:value={appState.contentTypeFilter}
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			>
				{#each contentTypes as type}
					<option value={type.value}>{type.label}</option>
				{/each}
			</select>
		</div>

		<div class="flex gap-2">
			<button
				onclick={() => appState.expandAll()}
				class="flex-1 rounded bg-blue-100 px-3 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-200"
			>
				Expand All
			</button>
			<button
				onclick={() => appState.collapseAll()}
				class="flex-1 rounded bg-gray-100 px-3 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200"
			>
				Collapse All
			</button>
		</div>
	</div>

	<!-- Book Statistics -->
	{#if appState.bookData}
		<div class="stats-section border-b border-gray-200 bg-gray-50 p-4">
			<h3 class="mb-2 text-sm font-semibold text-gray-700">Book Statistics</h3>
			<div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
				<div>Chapters: {appState.bookData.chapters?.length || 0}</div>
				<div>Total Blocks: {appState.bookData.totalBlocks || 0}</div>
				<div>Paragraphs: {appState.bookData.statistics?.paragraphs || 0}</div>
				<div>Callouts: {appState.bookData.statistics?.callouts || 0}</div>
			</div>
		</div>
	{/if}

	<!-- Chapters List -->
	<div class="chapters-list flex-1 overflow-y-auto">
		<div class="p-4">
			<h3 class="mb-3 text-sm font-semibold text-gray-700">
				Chapters ({appState.filteredChapters?.length || 0})
			</h3>

			{#if appState.filteredChapters && appState.filteredChapters.length > 0}
				<div class="space-y-2">
					{#each appState.filteredChapters as chapter (chapter.id)}
						<button
							class="chapter-nav-item group w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:bg-gray-50"
							onclick={() => expandChapter(chapter.id)}
						>
							<div class="flex items-start justify-between">
								<div class="min-w-0 flex-1">
									<div class="mb-1 flex items-center gap-2">
										<span
											class="chapter-number rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-600"
										>
											{chapter.number}
										</span>
										<span class="chapter-count text-xs text-gray-500">
											{chapter.totalBlocks} blocks
										</span>
									</div>
									<h4
										class="chapter-title truncate text-sm font-medium text-gray-800 group-hover:text-blue-600"
									>
										{chapter.title}
									</h4>
								</div>
								<svg
									class="ml-2 h-4 w-4 flex-shrink-0 text-gray-400 group-hover:text-blue-600"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fill-rule="evenodd"
										d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
										clip-rule="evenodd"
									/>
								</svg>
							</div>
						</button>
					{/each}
				</div>
			{:else if appState.searchQuery || appState.contentTypeFilter !== 'all'}
				<div class="py-8 text-center text-gray-500">
					<p class="text-sm">No chapters match your search criteria.</p>
					<button
						onclick={() => appState.clearFilters()}
						class="mt-2 text-sm text-blue-600 underline hover:text-blue-800"
					>
						Clear filters
					</button>
				</div>
			{:else}
				<div class="py-8 text-center text-gray-500">
					<p class="text-sm">No chapters available.</p>
				</div>
			{/if}
		</div>
	</div>
</nav>
