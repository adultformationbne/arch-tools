<script>
	let { 
		chapters = [], 
		blocks = [], 
		selectedChapter = $bindable(null),
		onChapterSelect = () => {}
	} = $props();

	let isOpen = $state(false);

	function selectChapter(chapterId) {
		selectedChapter = chapterId;
		onChapterSelect({ chapterId });
		isOpen = false;
	}

	function clearChapter() {
		selectedChapter = null;
		onChapterSelect({ chapterId: null });
	}

	// Get chapter with block count
	let chaptersWithCounts = $derived(
		chapters.map((chapter) => {
			const chapterIndex = blocks.findIndex((b) => b.id === chapter.id);
			let blockCount = 0;

			if (chapterIndex !== -1) {
				// Count blocks until next chapter or end
				for (let i = chapterIndex; i < blocks.length; i++) {
					if (i > chapterIndex && blocks[i].tag === 'chapter') break;
					blockCount++;
				}
			}

			return {
				...chapter,
				blockCount
			};
		})
	);

	let selectedChapterInfo = $derived(
		!selectedChapter ? null : chaptersWithCounts.find((c) => c.id === selectedChapter)
	);

</script>

<div class="relative">
	<!-- Chapter Selector Button -->
	<button
		onclick={() => (isOpen = !isOpen)}
		class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors hover:bg-gray-50"
	>
		<svg class="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
			/>
		</svg>
		<span class="font-medium text-gray-700">
			{#if selectedChapterInfo}
				{selectedChapterInfo.title} ({selectedChapterInfo.blockCount} blocks)
			{:else}
				All Chapters ({chapters.length} total)
			{/if}
		</span>
		<svg
			class="h-4 w-4 text-gray-500 transition-transform {isOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="absolute top-full left-0 z-50 mt-2 max-h-80 w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
		>
			<!-- Clear Selection -->
			<button
				onclick={clearChapter}
				class="w-full border-b border-gray-100 px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50"
			>
				📚 All Chapters ({chapters.length} chapters, {blocks.length} total blocks)
			</button>

			<!-- Chapter List -->
			{#each chaptersWithCounts as chapter (chapter.id)}
				<button
					onclick={() => selectChapter(chapter.id)}
					class="w-full px-4 py-3 text-left transition-colors hover:bg-blue-50 {selectedChapter ===
					chapter.id
						? 'border-l-4 border-blue-500 bg-blue-100'
						: ''}"
				>
					<div class="flex items-center justify-between">
						<div class="truncate">
							<span class="font-medium text-gray-900">{chapter.title}</span>
						</div>
						<span class="ml-2 flex-shrink-0 text-sm text-gray-500">
							{chapter.blockCount} blocks
						</span>
					</div>
				</button>
			{/each}

			{#if chapters.length === 0}
				<div class="px-4 py-8 text-center text-gray-500">No chapters found</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Click outside to close -->
{#if isOpen}
	<div class="fixed inset-0 z-40" onclick={() => (isOpen = false)}></div>
{/if}
