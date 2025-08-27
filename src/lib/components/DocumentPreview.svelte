<script>
	import { Eye, EyeOff, Edit, ChevronUp, ChevronDown, History } from 'lucide-svelte';
	import RichTextDisplay from './RichTextDisplay.svelte';
	import TrafficLight from './TrafficLight.svelte';

	let {
		blocks = [],
		selectedBlocks = new Set(),
		onEdit = () => {},
		onToggleVisibility = () => {},
		onMove = () => {},
		onToggleSelection = () => {},
		onShowVersionHistory = () => {},
		getBlockRecommendation = null,
		getBlockScores = null,
		evaluations = []
	} = $props();

	// Group blocks by sections (starting with chapters/h1/h2)
	function groupBlocks() {
		const groups = [];
		let currentGroup = null;

		blocks.forEach((block, index) => {
			const isSection = ['chapter', 'h1', 'h2'].includes(block.tag);
			const isMetadataGroup = block.metadata && block.metadata.length > 0;

			if (isSection || (!currentGroup && index === 0)) {
				// Start new section
				currentGroup = {
					id: block.id,
					title: isSection ? block.content : null,
					type: block.tag,
					metadata: block.metadata || [],
					blocks: [block],
					isVisible: block.isVisible
				};
				groups.push(currentGroup);
			} else if (isMetadataGroup && currentGroup) {
				// Check if this should start a new metadata subsection
				const hasSharedMetadata = block.metadata.some((meta) =>
					currentGroup.metadata.includes(meta)
				);

				if (!hasSharedMetadata && block.metadata.includes('prayer page')) {
					// Start new prayer page subsection
					currentGroup = {
						id: `meta-${block.id}`,
						title: 'Prayer Page',
						type: 'metadata-group',
						metadata: block.metadata,
						blocks: [block],
						isVisible: block.isVisible
					};
					groups.push(currentGroup);
				} else {
					currentGroup.blocks.push(block);
				}
			} else if (currentGroup) {
				currentGroup.blocks.push(block);
			}
		});

		return groups;
	}

	let groupedBlocks = $derived(groupBlocks());

	// Get semantic styling for each tag
	function getSemanticClass(tag) {
		const styles = {
			chapter: 'text-3xl font-bold text-gray-900 mb-6 mt-8 border-b-2 border-gray-200 pb-2',
			h1: 'text-2xl font-bold text-gray-900 mb-4 mt-6',
			h2: 'text-xl font-semibold text-gray-800 mb-3 mt-5',
			h3: 'text-lg font-semibold text-gray-800 mb-2 mt-4',
			title: 'text-2xl font-bold text-center text-gray-900 mb-6',
			paragraph: 'text-gray-700 mb-4 leading-relaxed',
			quote: 'italic text-gray-600 border-l-4 border-blue-300 pl-4 mb-4 bg-blue-50 py-2',
			scripture: 'text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4 font-medium',
			prayer: 'text-green-800 bg-green-50 border border-green-200 rounded-lg p-4 mb-4 italic',
			callout: 'bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 text-orange-900',
			ul: 'list-disc list-inside text-gray-700 mb-4 ml-4',
			ol: 'list-decimal list-inside text-gray-700 mb-4 ml-4',
			author: 'text-right text-gray-600 italic mb-2',
			date: 'text-right text-gray-500 text-sm mb-4',
			note: 'text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2 mb-2'
		};
		return styles[tag] || 'text-gray-700 mb-4';
	}

	// Get metadata section styling
	function getMetadataGroupClass(metadata) {
		if (metadata.includes('prayer page')) {
			return 'bg-green-50 border border-green-200 rounded-xl p-6 mb-6';
		}
		if (metadata.includes('activity')) {
			return 'bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6';
		}
		if (metadata.includes('reflection')) {
			return 'bg-purple-50 border border-purple-200 rounded-xl p-6 mb-6';
		}
		return 'bg-gray-50 border border-gray-200 rounded-xl p-6 mb-6';
	}

	// Check if we should render as list item
	function isListItem(tag) {
		return ['ul', 'ol'].includes(tag);
	}
</script>

<div class="document-preview mx-auto max-w-4xl bg-white">
	{#each groupedBlocks as group}
		<div
			class="group relative {group.type === 'metadata-group'
				? getMetadataGroupClass(group.metadata)
				: ''}"
		>
			{#if group.title && group.type === 'metadata-group'}
				<h4
					class="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-600 uppercase"
				>
					{group.title}
					{#if group.metadata.includes('prayer page')}
						<span class="rounded-full bg-green-200 px-2 py-1 text-xs text-green-800">Prayer</span>
					{:else if group.metadata.includes('activity')}
						<span class="rounded-full bg-blue-200 px-2 py-1 text-xs text-blue-800">Activity</span>
					{:else if group.metadata.includes('reflection')}
						<span class="rounded-full bg-purple-200 px-2 py-1 text-xs text-purple-800"
							>Reflection</span
						>
					{/if}
				</h4>
			{/if}

			{#each group.blocks as block, blockIndex}
				{@const isSelected = selectedBlocks.has(block.id)}
				{@const isHidden = !block.isVisible}

				<div
					class="block-container group/block relative {isHidden ? 'opacity-50' : ''} {isSelected
						? 'bg-blue-50 ring-2 ring-blue-400'
						: ''}"
				>
					<!-- Analytics dot - positioned on right side -->
					<div class="absolute top-2 right-2 z-10">
						<TrafficLight blockId={block.id} {evaluations} showTooltip={true} />
					</div>

					<!-- Block Content -->
					{#if isListItem(block.tag)}
						<li class="{getSemanticClass(block.tag)} pr-12">
							<RichTextDisplay content={block.content} />
						</li>
					{:else if block.tag === 'chapter'}
						<h1 class="{getSemanticClass(block.tag)} pr-12">
							<RichTextDisplay content={block.content} />
						</h1>
					{:else if block.tag === 'h1'}
						<h1 class="{getSemanticClass(block.tag)} pr-12">
							<RichTextDisplay content={block.content} />
						</h1>
					{:else if block.tag === 'h2'}
						<h2 class="{getSemanticClass(block.tag)} pr-12">
							<RichTextDisplay content={block.content} />
						</h2>
					{:else if block.tag === 'h3'}
						<h3 class="{getSemanticClass(block.tag)} pr-12">
							<RichTextDisplay content={block.content} />
						</h3>
					{:else if block.tag === 'title'}
						<div class="{getSemanticClass(block.tag)} pr-12">
							<RichTextDisplay content={block.content} />
						</div>
					{:else}
						<div class="{getSemanticClass(block.tag)} pr-12">
							<RichTextDisplay content={block.content} />
						</div>
					{/if}

					<!-- Horizontal Actions Bar - appears above block on hover -->
					<div
						class="absolute -top-16 right-0 left-0 z-20 translate-y-2 transform opacity-0 transition-all duration-300 group-hover/block:translate-y-0 group-hover/block:opacity-100"
					>
						<div class="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
							<div class="flex items-center justify-between">
								<!-- Left side - Block info -->
								<div class="flex items-center gap-3">
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => onToggleSelection(block.id)}
										class="h-4 w-4 rounded border-gray-300 text-blue-600"
										title="Select block"
									/>
									<span class="font-mono text-xs text-gray-500">#{blockIndex + 1}</span>
									<span class="text-xs font-medium text-gray-600">{block.tag}</span>
								</div>

								<!-- Center - Action buttons -->
								<div class="flex items-center gap-2">
									<button
										onclick={() => onEdit(block)}
										class="flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
										title="Edit content"
									>
										<Edit class="h-4 w-4" />
										Edit
									</button>

									<button
										onclick={() => {
											console.log('Hide/Show button clicked for block:', block.id);
											onToggleVisibility(block.id);
										}}
										class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {block.isVisible
											? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
											: 'bg-green-50 text-green-700 hover:bg-green-100'}"
										title={block.isVisible ? 'Hide block' : 'Show block'}
									>
										{#if block.isVisible}
											<EyeOff class="h-4 w-4" />
											Hide
										{:else}
											<Eye class="h-4 w-4" />
											Show
										{/if}
									</button>

									<button
										onclick={() => onShowVersionHistory(block)}
										class="flex items-center gap-1.5 rounded-md bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
										title="Version history"
									>
										<History class="h-4 w-4" />
										History
									</button>

									<div class="mx-1 h-6 w-px bg-gray-300"></div>

									<button
										onclick={() => {
											console.log('Move up button clicked for block:', block.id);
											onMove(block.id, 'up');
										}}
										disabled={blockIndex === 0}
										class="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
										title="Move up"
									>
										<ChevronUp class="h-4 w-4" />
										Up
									</button>

									<button
										onclick={() => {
											console.log('Move down button clicked for block:', block.id);
											onMove(block.id, 'down');
										}}
										disabled={blockIndex === group.blocks.length - 1}
										class="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
										title="Move down"
									>
										<ChevronDown class="h-4 w-4" />
										Down
									</button>
								</div>

								<!-- Right side - Block ID -->
								<span class="font-mono text-xs text-gray-400">
									{block.id.slice(0, 8)}...
								</span>
							</div>
						</div>
					</div>

					<!-- Hidden indicator -->
					{#if isHidden}
						<div class="absolute top-2 left-2 rounded bg-red-100 px-2 py-1 text-xs text-red-700">
							Hidden
						</div>
					{/if}

					<!-- Metadata badges -->
					{#if block.metadata && block.metadata.length > 0 && group.type !== 'metadata-group'}
						<div class="absolute top-2 right-16 flex gap-1">
							{#each block.metadata as meta}
								<span class="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
									{meta}
								</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	/* List styling */
	:global(.document-preview ul) {
		list-style-type: disc;
		margin-left: 1.5rem;
	}

	:global(.document-preview ol) {
		list-style-type: decimal;
		margin-left: 1.5rem;
	}

	:global(.document-preview li) {
		margin-bottom: 0.5rem;
	}

	/* Block container hover effects */
	.block-container:hover {
		background-color: rgba(249, 250, 251, 0.8);
		outline: 1px solid #e5e7eb;
		outline-offset: 2px;
	}

	/* Smooth transitions */
	.block-container {
		transition: all 0.2s ease-in-out;
		border-radius: 0.375rem;
		position: relative;
	}
</style>
