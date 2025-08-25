<script>
	import { Eye, EyeOff, Edit, Trash2, ChevronUp, ChevronDown } from 'lucide-svelte';
	import RichTextDisplay from './RichTextDisplay.svelte';
	import BlockAnalytics from './BlockAnalytics.svelte';
	
	let { 
		blocks = [], 
		selectedBlocks = new Set(),
		onEdit = () => {},
		onToggleVisibility = () => {},
		onDelete = () => {},
		onMove = () => {},
		onToggleSelection = () => {},
		getBlockRecommendation = null,
		getBlockScores = null
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
				const hasSharedMetadata = block.metadata.some(meta => 
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
			'chapter': 'text-3xl font-bold text-gray-900 mb-6 mt-8 border-b-2 border-gray-200 pb-2',
			'h1': 'text-2xl font-bold text-gray-900 mb-4 mt-6',
			'h2': 'text-xl font-semibold text-gray-800 mb-3 mt-5',
			'h3': 'text-lg font-semibold text-gray-800 mb-2 mt-4',
			'title': 'text-2xl font-bold text-center text-gray-900 mb-6',
			'paragraph': 'text-gray-700 mb-4 leading-relaxed',
			'quote': 'italic text-gray-600 border-l-4 border-blue-300 pl-4 mb-4 bg-blue-50 py-2',
			'scripture': 'text-teal-800 bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4 font-medium',
			'prayer': 'text-green-800 bg-green-50 border border-green-200 rounded-lg p-4 mb-4 italic',
			'callout': 'bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 text-orange-900',
			'ul': 'list-disc list-inside text-gray-700 mb-4 ml-4',
			'ol': 'list-decimal list-inside text-gray-700 mb-4 ml-4',
			'author': 'text-right text-gray-600 italic mb-2',
			'date': 'text-right text-gray-500 text-sm mb-4',
			'note': 'text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2 mb-2'
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

<div class="document-preview max-w-4xl mx-auto bg-white">
	{#each groupedBlocks as group}
		<div class="group relative {group.type === 'metadata-group' ? getMetadataGroupClass(group.metadata) : ''}">
			{#if group.title && group.type === 'metadata-group'}
				<h4 class="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4 flex items-center gap-2">
					{group.title}
					{#if group.metadata.includes('prayer page')}
						<span class="text-xs bg-green-200 text-green-800 px-2 py-1 rounded-full">Prayer</span>
					{:else if group.metadata.includes('activity')}
						<span class="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">Activity</span>
					{:else if group.metadata.includes('reflection')}
						<span class="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded-full">Reflection</span>
					{/if}
				</h4>
			{/if}
			
			{#each group.blocks as block, blockIndex}
				{@const isSelected = selectedBlocks.has(block.id)}
				{@const isHidden = !block.isVisible}
				
				<div 
					class="block-container relative group/block {isHidden ? 'opacity-50' : ''} {isSelected ? 'ring-2 ring-blue-400 bg-blue-50' : ''}"
				>
					<!-- Analytics Traffic Light - positioned in top-left corner -->
					<div class="absolute top-1 left-1 z-10">
						<BlockAnalytics 
							blockId={block.id}
							{getBlockRecommendation}
							{getBlockScores}
							compact={false}
						/>
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
					
					<!-- Hover Controls -->
					<div class="absolute top-0 right-0 opacity-0 group-hover/block:opacity-100 transition-opacity duration-200 bg-white border border-gray-300 rounded-lg shadow-lg p-1 flex gap-1 z-10">
						<!-- Selection Checkbox -->
						<input
							type="checkbox"
							checked={isSelected}
							onchange={() => onToggleSelection(block.id)}
							class="mt-1 rounded border-gray-300 text-blue-600"
							title="Select block"
						/>
						
						<!-- Edit Button -->
						<button
							onclick={() => onEdit(block)}
							class="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
							title="Edit block"
						>
							<Edit class="w-3 h-3" />
						</button>
						
						<!-- Visibility Toggle -->
						<button
							onclick={() => onToggleVisibility(block.id)}
							class="p-1.5 hover:bg-gray-50 rounded {block.isVisible ? 'text-gray-500 hover:text-gray-700' : 'text-red-500 hover:text-red-700'}"
							title={block.isVisible ? 'Hide block' : 'Show block'}
						>
							{#if block.isVisible}
								<Eye class="w-3 h-3" />
							{:else}
								<EyeOff class="w-3 h-3" />
							{/if}
						</button>
						
						<!-- Move Up -->
						<button
							onclick={() => onMove(block.id, 'up')}
							disabled={blockIndex === 0}
							class="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 hover:bg-gray-50 rounded"
							title="Move up"
						>
							<ChevronUp class="w-3 h-3" />
						</button>
						
						<!-- Move Down -->
						<button
							onclick={() => onMove(block.id, 'down')}
							disabled={blockIndex === group.blocks.length - 1}
							class="p-1.5 text-gray-500 hover:text-gray-700 disabled:opacity-30 hover:bg-gray-50 rounded"
							title="Move down"
						>
							<ChevronDown class="w-3 h-3" />
						</button>
						
						<!-- Delete -->
						<button
							onclick={() => onDelete(block.id)}
							class="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
							title="Delete block"
						>
							<Trash2 class="w-3 h-3" />
						</button>
					</div>
					
					<!-- Hidden indicator -->
					{#if isHidden}
						<div class="absolute top-2 left-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
							Hidden
						</div>
					{/if}
					
					<!-- Metadata badges -->
					{#if block.metadata && block.metadata.length > 0 && group.type !== 'metadata-group'}
						<div class="absolute top-2 right-16 flex gap-1">
							{#each block.metadata as meta}
								<span class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
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