<script>
	import RichTextEditor from './RichTextEditor.svelte';
	
	let { isOpen = false, block = null, allTags = [], metadataOptions = [], onSave = () => {}, onClose = () => {} } = $props();
	
	// Local state for editing
	let editTag = $state('');
	let editContent = $state('');
	let editMetadata = $state([]);
	
	// Get tag color class function (copied from parent)
	function getTagColorClass(tag) {
		const colorMap = {
			// Headers
			'h1': 'bg-red-100 text-red-700',
			'h2': 'bg-orange-100 text-orange-700',
			'h3': 'bg-amber-100 text-amber-700',
			'chapter': 'bg-indigo-100 text-indigo-700',
			'title': 'bg-purple-100 text-purple-700',
			
			// Content types
			'paragraph': 'bg-gray-100 text-gray-700',
			'quote': 'bg-blue-100 text-blue-700',
			'scripture': 'bg-teal-100 text-teal-700',
			'prayer': 'bg-green-100 text-green-700',
			'callout': 'bg-sky-100 text-sky-700',
			
			// Lists
			'ul': 'bg-lime-100 text-lime-700',
			'ol': 'bg-emerald-100 text-emerald-700',
			
			// Meta
			'author': 'bg-pink-100 text-pink-700',
			'date': 'bg-slate-100 text-slate-700',
			'note': 'bg-yellow-100 text-yellow-700'
		};
		
		// Return custom tag style if not in predefined list
		return colorMap[tag] || 'bg-violet-100 text-violet-700';
	}
	
	// Initialize form when block changes
	$effect(() => {
		if (block && isOpen) {
			editTag = block.tag;
			editContent = block.content;
			editMetadata = [...(block.metadata || [])];
		}
	});
	
	function handleSave() {
		if (!editContent.trim()) return;
		
		const updatedBlock = {
			...block,
			tag: editTag,
			content: editContent.trim(),
			metadata: [...editMetadata]
		};
		
		onSave(updatedBlock);
		handleClose();
	}
	
	function handleClose() {
		onClose();
		// Reset form
		editTag = '';
		editContent = '';
		editMetadata = [];
	}
	
	function handleKeyDown(e) {
		if (e.key === 'Escape') {
			handleClose();
		}
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSave();
		}
	}
</script>

{#if isOpen && block}
	<!-- Modal Backdrop -->
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
		onclick={handleClose}
	>
		<!-- Modal Content -->
		<div 
			class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-2xl font-bold text-gray-800">Edit Block</h3>
					<button
						onclick={handleClose}
						class="text-gray-500 hover:text-gray-700 text-2xl leading-none"
					>
						×
					</button>
				</div>
				
				<!-- Tag Selector -->
				<div class="mb-6">
					<h4 class="text-sm font-medium text-gray-700 mb-3">Block Type</h4>
					<div class="flex flex-wrap gap-2">
						{#each allTags as tag}
							<button
								onclick={() => editTag = tag}
								class="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 {
									editTag === tag 
										? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400' 
										: getTagColorClass(tag) + ' hover:opacity-80'
								}"
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>
				
				<!-- Metadata Selector -->
				<div class="mb-6">
					<h4 class="text-sm font-medium text-gray-700 mb-3">Metadata (Optional)</h4>
					<div class="grid grid-cols-2 gap-2 mb-3">
						{#each metadataOptions as option}
							<label class="flex items-center gap-2 text-sm cursor-pointer">
								<input 
									type="checkbox" 
									value={option}
									bind:group={editMetadata}
									class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
								>
								<span class="text-gray-700">{option}</span>
							</label>
						{/each}
					</div>
					{#if editMetadata.length > 0}
						<div class="flex flex-wrap gap-1">
							{#each editMetadata as meta}
								<span class="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
									{meta}
									<button onclick={() => editMetadata = editMetadata.filter(m => m !== meta)} class="text-orange-500 hover:text-orange-700">×</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>
				
				<!-- Content Editor -->
				<div class="mb-6">
					<h4 class="text-sm font-medium text-gray-700 mb-3">Content</h4>
					<RichTextEditor
						value={editContent}
						placeholder="Edit your content here... Use the toolbar for formatting."
						onInput={(content) => editContent = content}
						class="min-h-[160px]"
					/>
				</div>
				
				<!-- Action Buttons -->
				<div class="flex gap-3 justify-end">
					<button
						onclick={handleClose}
						class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleSave}
						disabled={!editContent.trim()}
						class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Save Changes
					</button>
				</div>
				
				<!-- Keyboard Shortcuts -->
				<div class="mt-4 text-xs text-gray-500 text-center">
					<p>Press <kbd class="px-1 py-0.5 bg-gray-100 rounded">Escape</kbd> to cancel • <kbd class="px-1 py-0.5 bg-gray-100 rounded">Ctrl+Enter</kbd> to save</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	kbd {
		font-family: monospace;
		font-size: 0.75rem;
	}
</style>