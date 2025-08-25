<script>
	import { onMount } from 'svelte';
	import EditBlockModal from '$lib/components/EditBlockModal.svelte';
	import RichTextDisplay from '$lib/components/RichTextDisplay.svelte';
	import DocumentPreview from '$lib/components/DocumentPreview.svelte';
	import AnalyticsSidebar from '$lib/components/AnalyticsSidebar.svelte';
	import BlockAnalytics from '$lib/components/BlockAnalytics.svelte';
	import {
		Search, Filter, Eye, EyeOff, Edit, Trash2,
		ChevronUp, ChevronDown, Check, X, AlertCircle,
		RotateCcw, Save, Plus, Home
	} from 'lucide-svelte';
	
	// State management
	let blocks = $state([]);
	let filteredBlocks = $state([]);
	let selectedBlocks = $state(new Set());
	let showEditModal = $state(false);
	let editingBlock = $state(null);
	let documentTitle = $state('Untitled Document');
	let saveStatus = $state('saved');
	let lastSaveTime = $state(null);
	
	// Analytics functions - will be set by AnalyticsSidebar
	let getBlockRecommendation = $state(null);
	let getBlockScores = $state(null);
	
	// Filters and settings
	let searchQuery = $state('');
	let tagFilter = $state('all');
	let metadataFilter = $state('all');
	let hideInvisible = $state(false);
	let selectedChapter = $state(null);
	let viewMode = $state('preview'); // 'preview' or 'list'
	
	// Predefined options
	const predefinedTags = [
		'paragraph', 'h1', 'h2', 'h3', 'chapter', 
		'title', 'quote', 'author', 'date', 'prayer',
		'scripture', 'callout', 'note', 'ul', 'ol'
	];
	
	const metadataOptions = [
		'prayer page', 'activity', 'reflection', 'discussion', 
		'ritual', 'celebration', 'homework', 'assessment',
		'introduction', 'conclusion', 'background info'
	];
	
	// Derived values
	let chapters = $derived(() => {
		return blocks.filter(block => block.tag === 'chapter').map(block => ({
			id: block.id,
			title: block.content,
			index: blocks.indexOf(block)
		}));
	});
	
	let allTags = $derived(() => {
		const usedTags = new Set(blocks.map(block => block.tag));
		return [...predefinedTags, ...Array.from(usedTags).filter(tag => !predefinedTags.includes(tag))];
	});
	
	let allMetadata = $derived(() => {
		const usedMetadata = new Set();
		blocks.forEach(block => {
			if (block.metadata) {
				block.metadata.forEach(meta => usedMetadata.add(meta));
			}
		});
		return [...metadataOptions, ...Array.from(usedMetadata).filter(meta => !metadataOptions.includes(meta))];
	});
	
	// Load data from JSON file
	onMount(async () => {
		try {
			const response = await fetch('/api/builder');
			if (response.ok) {
				const data = await response.json();
				blocks = data.blocks || [];
				documentTitle = data.documentTitle || 'Untitled Document';
				lastSaveTime = data.lastSaved;
				
				// Initialize visibility for existing blocks
				blocks = blocks.map(block => ({
					...block,
					isVisible: block.isVisible !== undefined ? block.isVisible : true
				}));
				
				applyFilters();
			}
		} catch (error) {
			console.error('Error loading data:', error);
		}
	});
	
	// Filter blocks based on search and filters
	function applyFilters() {
		let filtered = blocks;
		
		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(block => 
				block.content.toLowerCase().includes(query) ||
				block.tag.toLowerCase().includes(query) ||
				(block.metadata && block.metadata.some(meta => meta.toLowerCase().includes(query)))
			);
		}
		
		// Tag filter
		if (tagFilter !== 'all') {
			filtered = filtered.filter(block => block.tag === tagFilter);
		}
		
		// Metadata filter
		if (metadataFilter !== 'all') {
			filtered = filtered.filter(block => 
				block.metadata && block.metadata.includes(metadataFilter)
			);
		}
		
		// Chapter filter
		if (selectedChapter) {
			const chapterIndex = blocks.findIndex(b => b.id === selectedChapter);
			if (chapterIndex !== -1) {
				const chapterBlocks = [];
				for (let i = chapterIndex; i < blocks.length; i++) {
					if (i > chapterIndex && blocks[i].tag === 'chapter') break;
					chapterBlocks.push(blocks[i]);
				}
				filtered = filtered.filter(block => chapterBlocks.includes(block));
			}
		}
		
		// Visibility filter
		if (hideInvisible) {
			filtered = filtered.filter(block => block.isVisible);
		}
		
		filteredBlocks = filtered;
	}
	
	// Watch for filter changes
	$effect(() => {
		applyFilters();
	});
	
	// Save data to JSON file
	async function saveToFile() {
		saveStatus = 'saving';
		
		const data = {
			blocks,
			documentTitle,
			lastSaved: new Date().toISOString()
		};
		
		try {
			const response = await fetch('/api/builder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data)
			});
			
			if (response.ok) {
				saveStatus = 'saved';
				lastSaveTime = new Date().toISOString();
			} else {
				saveStatus = 'error';
			}
		} catch (error) {
			saveStatus = 'error';
			console.error('Error saving:', error);
		}
	}
	
	// Block operations
	function editBlock(block) {
		editingBlock = block;
		showEditModal = true;
	}
	
	function saveBlockEdit(updatedBlock) {
		const index = blocks.findIndex(b => b.id === updatedBlock.id);
		if (index !== -1) {
			blocks[index] = updatedBlock;
			blocks = [...blocks];
			saveToFile();
		}
	}
	
	function closeEditModal() {
		showEditModal = false;
		editingBlock = null;
	}
	
	function toggleBlockVisibility(blockId) {
		const block = blocks.find(b => b.id === blockId);
		if (block) {
			block.isVisible = !block.isVisible;
			blocks = [...blocks];
			saveToFile();
		}
	}
	
	function deleteBlock(blockId) {
		if (confirm('Are you sure you want to delete this block?')) {
			blocks = blocks.filter(b => b.id !== blockId);
			saveToFile();
		}
	}
	
	function moveBlock(blockId, direction) {
		const index = blocks.findIndex(b => b.id === blockId);
		if (index === -1) return;
		
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= blocks.length) return;
		
		const newBlocks = [...blocks];
		[newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
		blocks = newBlocks;
		saveToFile();
	}
	
	// Selection operations
	function toggleBlockSelection(blockId) {
		if (selectedBlocks.has(blockId)) {
			selectedBlocks.delete(blockId);
		} else {
			selectedBlocks.add(blockId);
		}
		selectedBlocks = new Set(selectedBlocks);
	}
	
	function selectAll() {
		selectedBlocks = new Set(filteredBlocks.map(b => b.id));
	}
	
	function clearSelection() {
		selectedBlocks = new Set();
	}
	
	function bulkToggleVisibility() {
		selectedBlocks.forEach(blockId => {
			const block = blocks.find(b => b.id === blockId);
			if (block) {
				block.isVisible = !block.isVisible;
			}
		});
		blocks = [...blocks];
		saveToFile();
	}
	
	function bulkDelete() {
		if (confirm(`Are you sure you want to delete ${selectedBlocks.size} selected blocks?`)) {
			blocks = blocks.filter(b => !selectedBlocks.has(b.id));
			selectedBlocks = new Set();
			saveToFile();
		}
	}
	
	// Utility functions
	function getTagColorClass(tag) {
		const colorMap = {
			'h1': 'bg-red-100 text-red-700',
			'h2': 'bg-orange-100 text-orange-700',
			'h3': 'bg-amber-100 text-amber-700',
			'chapter': 'bg-indigo-100 text-indigo-700',
			'title': 'bg-purple-100 text-purple-700',
			'paragraph': 'bg-gray-100 text-gray-700',
			'quote': 'bg-blue-100 text-blue-700',
			'scripture': 'bg-teal-100 text-teal-700',
			'prayer': 'bg-green-100 text-green-700',
			'callout': 'bg-sky-100 text-sky-700',
			'ul': 'bg-lime-100 text-lime-700',
			'ol': 'bg-emerald-100 text-emerald-700',
			'author': 'bg-pink-100 text-pink-700',
			'date': 'bg-slate-100 text-slate-700',
			'note': 'bg-yellow-100 text-yellow-700'
		};
		return colorMap[tag] || 'bg-violet-100 text-violet-700';
	}
	
	function formatTime(isoString) {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleTimeString('en-US', { 
			hour: 'numeric', 
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 pr-16">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="bg-white rounded-xl shadow-lg p-6 mb-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-800">Document Editor</h1>
					<p class="text-gray-600 mt-1">Manage, edit, and organize your content blocks</p>
				</div>
				<div class="flex gap-4 items-center">
					<!-- Save Status -->
					<div class="flex items-center gap-2 text-sm">
						{#if saveStatus === 'saving'}
							<RotateCcw class="w-4 h-4 text-blue-600 animate-spin" />
							<span class="text-blue-600">Saving...</span>
						{:else if saveStatus === 'saved'}
							<Check class="w-4 h-4 text-green-600" />
							<span class="text-green-600">Saved {lastSaveTime ? `at ${formatTime(lastSaveTime)}` : ''}</span>
						{:else if saveStatus === 'error'}
							<AlertCircle class="w-4 h-4 text-red-600" />
							<span class="text-red-600">Save error</span>
						{/if}
					</div>
					
					<a href="/builder" class="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
						<Plus class="w-4 h-4" />
						Add Content
					</a>
					<a href="/" class="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
						<Home class="w-4 h-4" />
						Back to Home
					</a>
				</div>
			</div>
			
			<!-- Document Title -->
			<div class="mt-4">
				<input
					type="text"
					bind:value={documentTitle}
					class="text-lg font-medium bg-transparent border-none focus:outline-none focus:ring-0 text-gray-800"
					placeholder="Document Title..."
				/>
			</div>
		</div>
		
		<!-- Filters and Controls -->
		<div class="bg-white rounded-xl shadow-lg p-6 mb-6">
			<div class="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
				<!-- Search -->
				<div>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search blocks..."
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					/>
				</div>
				
				<!-- Tag Filter -->
				<div>
					<select bind:value={tagFilter} class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
						<option value="all">All Tags</option>
						{#each allTags as tag}
							<option value={tag}>{tag}</option>
						{/each}
					</select>
				</div>
				
				<!-- Metadata Filter -->
				<div>
					<select bind:value={metadataFilter} class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
						<option value="all">All Metadata</option>
						{#each allMetadata as meta}
							<option value={meta}>{meta}</option>
						{/each}
					</select>
				</div>
				
				<!-- Options -->
				<div class="flex items-center gap-4">
					<label class="flex items-center gap-2 text-sm cursor-pointer">
						<input type="checkbox" bind:checked={hideInvisible} class="rounded border-gray-300 text-blue-600">
						<span>Hide invisible</span>
					</label>
				</div>
			</div>
			
			<!-- Chapter Pills -->
			{#if chapters.length > 0}
				<div class="mb-4">
					<div class="flex flex-wrap gap-2">
						<button
							onclick={() => selectedChapter = null}
							class="px-3 py-1.5 rounded-full text-sm font-medium transition-all {
								!selectedChapter ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
							}"
						>
							All Chapters
						</button>
						{#each chapters as chapter}
							<button
								onclick={() => selectedChapter = chapter.id}
								class="px-3 py-1.5 rounded-full text-sm font-medium transition-all {
									selectedChapter === chapter.id ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
								}"
							>
								{chapter.title.length > 30 ? chapter.title.substring(0, 30) + '...' : chapter.title}
							</button>
						{/each}
					</div>
				</div>
			{/if}
			
			<!-- Bulk Actions -->
			{#if selectedBlocks.size > 0}
				<div class="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
					<span class="text-sm text-blue-700 font-medium">{selectedBlocks.size} selected</span>
					<div class="flex gap-2">
						<button onclick={bulkToggleVisibility} class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
							Toggle Visibility
						</button>
						<button onclick={bulkDelete} class="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
							Delete
						</button>
						<button onclick={clearSelection} class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
							Clear Selection
						</button>
					</div>
				</div>
			{/if}
			
			<!-- View Controls -->
			<div class="flex items-center justify-between text-sm text-gray-600 mt-4">
				<div>
					Showing {filteredBlocks.length} of {blocks.length} blocks
				</div>
				<div class="flex gap-4 items-center">
					<!-- View Mode Toggle -->
					<div class="flex bg-gray-100 rounded-lg p-1">
						<button
							onclick={() => viewMode = 'preview'}
							class="px-3 py-1 text-xs font-medium rounded {viewMode === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}"
						>
							Document View
						</button>
						<button
							onclick={() => viewMode = 'list'}
							class="px-3 py-1 text-xs font-medium rounded {viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}"
						>
							List View
						</button>
					</div>
					
					<button onclick={selectAll} class="text-blue-600 hover:text-blue-700">Select All</button>
					<button onclick={clearSelection} class="text-gray-600 hover:text-gray-700">Clear Selection</button>
				</div>
			</div>
		</div>
		
		<!-- Content Display -->
		{#if filteredBlocks.length === 0}
			<div class="bg-white rounded-xl shadow-lg p-6">
				<div class="text-center py-12 text-gray-500">
					<p class="text-lg">No blocks found</p>
					<p class="text-sm mt-2">Try adjusting your filters or add some content</p>
				</div>
			</div>
		{:else if viewMode === 'preview'}
			<!-- Document Preview Mode -->
			<div class="bg-white rounded-xl shadow-lg p-8">
				<DocumentPreview 
					blocks={filteredBlocks}
					selectedBlocks={selectedBlocks}
					onEdit={editBlock}
					onToggleVisibility={toggleBlockVisibility}
					onDelete={deleteBlock}
					onMove={moveBlock}
					onToggleSelection={toggleBlockSelection}
					{getBlockRecommendation}
					{getBlockScores}
				/>
			</div>
		{:else}
			<!-- List View Mode -->
			<div class="bg-white rounded-xl shadow-lg p-6">
				<div class="space-y-3">
					{#each filteredBlocks as block, index}
						<div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow {!block.isVisible ? 'opacity-50 bg-gray-50' : ''}">
							<div class="flex items-start gap-4">
								<!-- Selection Checkbox -->
								<input
									type="checkbox"
									checked={selectedBlocks.has(block.id)}
									onchange={() => toggleBlockSelection(block.id)}
									class="mt-1 rounded border-gray-300 text-blue-600"
								/>
								
								<!-- Block Content -->
								<div class="flex-1">
									<div class="flex flex-wrap gap-1 items-center mb-2">
										<span class="inline-block px-2 py-1 text-xs font-medium rounded {getTagColorClass(block.tag)}">
											{block.tag}
										</span>
										
										<!-- Analytics Traffic Light -->
										<BlockAnalytics 
											blockId={block.id}
											{getBlockRecommendation}
											{getBlockScores}
											compact={true}
										/>
										
										{#if block.metadata && block.metadata.length > 0}
											{#each block.metadata as meta}
												<span class="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
													{meta}
												</span>
											{/each}
										{/if}
										{#if !block.isVisible}
											<span class="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
												Hidden
											</span>
										{/if}
									</div>
									<div class="text-gray-700 text-sm leading-relaxed">
										<RichTextDisplay 
											content={block.content.length > 200 ? block.content.substring(0, 200) + '...' : block.content}
										/>
									</div>
								</div>
								
								<!-- Action Buttons -->
								<div class="flex gap-1">
									<button
										onclick={() => editBlock(block)}
										class="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
										title="Edit block"
									>
										<Edit class="w-4 h-4" />
									</button>
									<button
										onclick={() => toggleBlockVisibility(block.id)}
										class="p-2 hover:bg-gray-50 rounded {block.isVisible ? 'text-gray-500 hover:text-gray-700' : 'text-red-500 hover:text-red-700'}"
										title={block.isVisible ? 'Hide block' : 'Show block'}
									>
										{#if block.isVisible}
											<Eye class="w-4 h-4" />
										{:else}
											<EyeOff class="w-4 h-4" />
										{/if}
									</button>
									<button
										onclick={() => moveBlock(block.id, 'up')}
										disabled={index === 0}
										class="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-30 hover:bg-gray-50 rounded"
										title="Move up"
									>
										<ChevronUp class="w-4 h-4" />
									</button>
									<button
										onclick={() => moveBlock(block.id, 'down')}
										disabled={index === filteredBlocks.length - 1}
										class="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-30 hover:bg-gray-50 rounded"
										title="Move down"
									>
										<ChevronDown class="w-4 h-4" />
									</button>
									<button
										onclick={() => deleteBlock(block.id)}
										class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
										title="Delete block"
									>
										<Trash2 class="w-4 h-4" />
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Edit Block Modal -->
<EditBlockModal 
	isOpen={showEditModal}
	block={editingBlock}
	allTags={allTags}
	metadataOptions={metadataOptions}
	onSave={saveBlockEdit}
	onClose={closeEditModal}
/>

<!-- Analytics Sidebar -->
<AnalyticsSidebar 
  onAnalyticsReady={(functions) => {
    getBlockRecommendation = functions.getBlockRecommendation;
    getBlockScores = functions.getBlockScores;
  }}
/>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>