<script>
	import RichTextDisplay from './RichTextDisplay.svelte';
	import BlockActionsBar from './BlockActionsBar.svelte';
	import Card from '$lib/design-system/Card.svelte';
	import { getTagColorClass } from '$lib/design-system/tokens.js';

	let {
		blocks = [],
		selectedBlocks = new Set(),
		onEdit = () => {},
		onToggleVisibility = () => {},
		onDelete = () => {},
		onMove = () => {},
		onToggleSelection = () => {},
		onShowVersionHistory = () => {},
		onDuplicate = () => {}
	} = $props();
</script>

<Card>
	<div class="space-y-6">
		{#each blocks as block, index}
			<div
				class="overflow-hidden rounded-xl border border-gray-200 transition-shadow hover:shadow-md {!block.isVisible
					? 'bg-gray-50 opacity-60'
					: 'bg-white'}"
			>
				<!-- Block Header -->
				<div class="border-b border-gray-200 bg-gray-50 px-6 py-3">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<!-- Selection Checkbox -->
							<input
								type="checkbox"
								checked={selectedBlocks.has(block.id)}
								onchange={() => onToggleSelection(block.id)}
								class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>

							<!-- Block Position -->
							<span class="rounded bg-white px-2 py-1 font-mono text-xs text-gray-500">
								#{index + 1}
							</span>

							<!-- Tag Badge -->
							<span
								class="inline-block rounded-full border px-3 py-1 text-xs font-semibold {getTagColorClass(
									block.tag
								)}"
							>
								{block.tag}
							</span>


							<!-- Metadata Badges -->
							{#if block.metadata && block.metadata.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each block.metadata as meta}
										<span
											class="inline-block rounded border border-orange-200 bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700"
										>
											{meta}
										</span>
									{/each}
								</div>
							{/if}

							<!-- Visibility Badge -->
							{#if !block.isVisible}
								<span
									class="inline-block rounded border border-red-200 bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
								>
									Hidden
								</span>
							{/if}
						</div>

						<!-- Block ID -->
						<div class="font-mono text-xs text-gray-400">
							{block.id.slice(0, 8)}...
						</div>
					</div>
				</div>

				<!-- Block Content -->
				<div class="p-6">
					<div class="prose prose-sm mb-6 max-w-none leading-relaxed text-gray-700">
						<RichTextDisplay
							content={block.content.length > 500
								? block.content.substring(0, 500) + '...'
								: block.content}
						/>
					</div>

					{#if block.content.length > 500}
						<div class="mb-4 text-xs text-gray-500">
							Content truncated • {block.content.length} characters total
						</div>
					{/if}

					<!-- Compact Actions Bar -->
					<BlockActionsBar
						{block}
						{index}
						totalBlocks={blocks.length}
						{onEdit}
						{onToggleVisibility}
						{onDelete}
						{onMove}
						{onShowVersionHistory}
						{onDuplicate}
						compact={true}
					/>
				</div>
			</div>
		{/each}
	</div>
</Card>
