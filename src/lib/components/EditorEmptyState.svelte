<script>
	import { FileText, Plus } from 'lucide-svelte';
	import Button from '$lib/design-system/Button.svelte';
	import Card from '$lib/design-system/Card.svelte';

	let { searchQuery = '', hasFilters = false } = $props();

	const isFiltered = searchQuery.trim() || hasFilters;
</script>

<Card>
	<div class="py-16 text-center">
		<div class="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
			<FileText class="h-12 w-12 text-gray-400" />
		</div>

		<h3 class="mb-2 text-lg font-semibold text-gray-900">
			{isFiltered ? 'No blocks match your filters' : 'No content blocks found'}
		</h3>

		<p class="mx-auto mb-8 max-w-md text-gray-600">
			{#if isFiltered}
				Try adjusting your search terms or filters to find the content you're looking for.
			{:else}
				Get started by adding some content to your document. You can create various types of blocks
				like headers, paragraphs, quotes, and more.
			{/if}
		</p>

		<div class="flex justify-center gap-4">
			{#if isFiltered}
				<Button variant="outline" onclick={() => window.location.reload()}>Clear Filters</Button>
			{/if}

			<!-- Add Content functionality will be added here later -->
		</div>
	</div>
</Card>
