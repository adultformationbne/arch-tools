<script>
	import { Search } from 'lucide-svelte';
	import Button from '$lib/design-system/Button.svelte';
	import Card from '$lib/design-system/Card.svelte';

	let {
		searchQuery = $bindable(''),
		tagFilter = $bindable('all'),
		metadataFilter = $bindable('all'),
		hideInvisible = $bindable(false),
		allTags = [],
		allMetadata = [],
		filteredCount = 0,
		totalCount = 0,
		selectedBlocks = new Set(),
		onSelectAll = () => {},
		onClearSelection = () => {},
		onBulkToggleVisibility = () => {}
	} = $props();
</script>

<Card>
	<!-- Search and Filters -->
	<div class="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-4">
		<!-- Search -->
		<div class="relative">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search blocks..."
				class="w-full rounded-lg border border-gray-300 py-3 pr-3 pl-10 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<!-- Tag Filter -->
		<div>
			<select
				bind:value={tagFilter}
				class="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500"
			>
				<option value="all">All Tags</option>
				{#each allTags as tag}
					<option value={tag}>{tag}</option>
				{/each}
			</select>
		</div>

		<!-- Metadata Filter -->
		<div>
			<select
				bind:value={metadataFilter}
				class="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500"
			>
				<option value="all">All Metadata</option>
				{#each allMetadata as meta}
					<option value={meta}>{meta}</option>
				{/each}
			</select>
		</div>

		<!-- Options -->
		<div class="flex items-center justify-center">
			<label class="flex cursor-pointer items-center gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm">
				<input
					type="checkbox"
					bind:checked={hideInvisible}
					class="rounded border-gray-300 text-blue-600"
				/>
				<span class="font-medium">Hide invisible blocks</span>
			</label>
		</div>
	</div>

	<!-- Bulk Actions -->
	{#if selectedBlocks.size > 0}
		<div class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="text-sm font-semibold text-blue-900"
						>{selectedBlocks.size} blocks selected</span
					>
				</div>
				<div class="flex gap-2">
					<Button variant="primary" size="sm" onclick={onBulkToggleVisibility}>
						Toggle Visibility
					</Button>
					<Button variant="outline" size="sm" onclick={onClearSelection}>Clear Selection</Button>
				</div>
			</div>
		</div>
	{/if}

	<!-- View Controls and Stats -->
	<div class="flex items-center justify-between">
		<div class="text-sm text-gray-600">
			Showing <span class="font-semibold text-gray-900">{filteredCount}</span> of
			<span class="font-semibold text-gray-900">{totalCount}</span> blocks
		</div>

		<div class="flex items-center gap-4">
			<Button
				variant="ghost"
				size="sm"
				onclick={onSelectAll}
				class="text-blue-600 hover:text-blue-700"
			>
				Select All
			</Button>
		</div>
	</div>
</Card>
