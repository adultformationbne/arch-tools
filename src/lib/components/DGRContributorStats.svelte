<script>
	import { MailCheck, Eye, AlertCircle } from 'lucide-svelte';

	let {
		totalCount = 0,
		welcomedCount = 0,
		visitedCount = 0,
		needsFollowUpCount = 0
	} = $props();
</script>

{#if totalCount > 0}
	<div class="flex flex-wrap gap-4 text-sm">
		<div class="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
			<span class="font-medium text-gray-700">{totalCount}</span>
			<span class="text-gray-500">total</span>
		</div>
		<div class="flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1">
			<MailCheck class="h-3.5 w-3.5 text-purple-600" />
			<span class="font-medium text-purple-700">{welcomedCount}</span>
			<span class="text-purple-600">welcomed</span>
		</div>
		<div class="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1">
			<Eye class="h-3.5 w-3.5 text-blue-600" />
			<span class="font-medium text-blue-700">{visitedCount}</span>
			<span class="text-blue-600">visited</span>
		</div>
		{#if needsFollowUpCount > 0}
			<div class="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1">
				<AlertCircle class="h-3.5 w-3.5 text-amber-600" />
				<span class="font-medium text-amber-700">{needsFollowUpCount}</span>
				<span class="text-amber-600">need follow-up</span>
			</div>
		{/if}
	</div>
{/if}
