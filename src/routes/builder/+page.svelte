<script>
	import { untrack } from 'svelte';
	import { onMount } from 'svelte';
	import EditBlockModal from '$lib/components/EditBlockModal.svelte';
	import RichTextDisplay from '$lib/components/RichTextDisplay.svelte';
	
	// Reactive state using Svelte 5 syntax
	let selectedTag = $state('paragraph');
	let contentInput = $state('');
	let customTagInput = $state('');
	let blocks = $state([]);
	let documentTitle = $state('Untitled Document');
	let showExportModal = $state(false);
	let saveStatus = $state('saved'); // 'saved', 'saving', 'error'
	let lastSaveTime = $state(null);
	let autoAddOnPaste = $state(true); // Toggle for auto-add on paste
	let selectedChapter = $state(null); // Currently selected chapter
	let selectedMetadata = $state([]); // Selected metadata tags
	let showEditModal = $state(false); // Edit modal visibility
	let editingBlock = $state(null); // Block being edited
	let reverseOrder = $state(false); // Toggle for display order
	let tagChangeMode = $state(false); // Hotkey mode for changing block tags
	let dataLoaded = $state(false); // Track if initial data has been loaded
	let showAllChapters = $state(false); // Toggle to show all chapters
	
	// Predefined tags
	const predefinedTags = [
		'paragraph', 'h1', 'h2', 'h3', 'chapter', 
		'title', 'quote', 'author', 'date', 'prayer',
		'scripture', 'callout', 'note', 'ul', 'ol'
	];
	
	// Predefined metadata options
	const metadataOptions = [
		'prayer page', 'activity', 'reflection', 'discussion', 
		'ritual', 'celebration', 'homework', 'assessment',
		'introduction', 'conclusion', 'background info'
	];
	
	let customTags = $state([]);
	
	// Combined tags list
	let allTags = $derived([...predefinedTags, ...customTags]);
	
	// Get all chapters from blocks
	let chapters = $derived(
		blocks.filter(block => block.tag === 'chapter')
			.map(block => ({
				id: block.id,
				title: block.content,
				index: blocks.indexOf(block)
			}))
	);
	
	// Get current chapter for a block
	function getBlockChapter(blockIndex) {
		let currentChapter = null;
		for (let i = blockIndex; i >= 0; i--) {
			if (blocks[i].tag === 'chapter') {
				currentChapter = blocks[i].id;
				break;
			}
		}
		return currentChapter;
	}
	
	// Filter blocks by selected chapter
	let filteredBlocks = $derived(
		!selectedChapter 
			? (reverseOrder ? [...blocks].reverse() : blocks)
			: (() => {
				const chapterIndex = blocks.findIndex(b => b.id === selectedChapter);
				if (chapterIndex === -1) return [];
				
				const filtered = [];
				for (let i = chapterIndex; i < blocks.length; i++) {
					if (i > chapterIndex && blocks[i].tag === 'chapter') break;
					filtered.push(blocks[i]);
				}
				
				return reverseOrder ? filtered.reverse() : filtered;
			})()
	);
	
	// Keyboard event handlers for tag change mode
	function handleKeyDown(e) {
		if (e.key === 'Alt' && !tagChangeMode) {
			tagChangeMode = true;
			document.body.style.cursor = 'crosshair';
		}
	}
	
	function handleKeyUp(e) {
		if (e.key === 'Alt' && tagChangeMode) {
			tagChangeMode = false;
			document.body.style.cursor = '';
		}
	}

	// Load saved data from file on mount
	onMount(async () => {
		// Add global keyboard listeners
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		
		// Load data
		try {
			const response = await fetch('/api/builder');
			if (response.ok) {
				const data = await response.json();
				blocks = data.blocks || [];
				customTags = data.customTags || [];
				documentTitle = data.documentTitle || 'Untitled Document';
				lastSaveTime = data.lastSaved;
				autoAddOnPaste = data.autoAddOnPaste !== undefined ? data.autoAddOnPaste : true;
				reverseOrder = data.reverseOrder || false;
				dataLoaded = true;
			} else {
				console.error('Failed to load data, response not ok:', response.status);
				dataLoaded = true;
			}
		} catch (error) {
			console.error('Error loading saved data:', error);
			// Fall back to localStorage if file load fails
			const saved = localStorage.getItem('xmlBuilderState');
			if (saved) {
				const data = JSON.parse(saved);
				blocks = data.blocks || [];
				customTags = data.customTags || [];
				documentTitle = data.documentTitle || 'Untitled Document';
			}
			dataLoaded = true;
		}
		
		// Cleanup on unmount
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			document.body.style.cursor = '';
		};
	});
	
	// Auto-save to file with debouncing
	let saveTimeout;
	$effect(() => {
		// Skip if data hasn't been loaded yet
		if (!dataLoaded) {
			return;
		}
		
		// Skip initial load
		if (blocks.length === 0 && customTags.length === 0 && documentTitle === 'Untitled Document') {
			return;
		}
		
		// Clear existing timeout
		clearTimeout(saveTimeout);
		
		// Save after 1 second of inactivity
		saveTimeout = setTimeout(async () => {
			await saveToFile();
		}, 1000);
	});
	
	async function saveToFile() {
		saveStatus = 'saving';
		
		const data = {
			blocks,
			customTags,
			documentTitle,
			autoAddOnPaste,
			reverseOrder
		};
		
		try {
			const response = await fetch('/api/builder', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(data)
			});
			
			if (response.ok) {
				saveStatus = 'saved';
				lastSaveTime = new Date().toISOString();
				// Also save to localStorage as backup
				localStorage.setItem('xmlBuilderState', JSON.stringify({
					...data,
					lastSaved: lastSaveTime
				}));
			} else {
				saveStatus = 'error';
				console.error('Failed to save file');
			}
		} catch (error) {
			saveStatus = 'error';
			console.error('Error saving file:', error);
		}
	}
	
	function addCustomTag() {
		const tagName = customTagInput.trim().toLowerCase();
		
		if (tagName && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tagName)) {
			if (!allTags.includes(tagName)) {
				customTags = [...customTags, tagName];
				selectedTag = tagName;
				customTagInput = '';
			} else {
				alert('Tag already exists!');
			}
		} else {
			alert('Please enter a valid tag name (letters, numbers, hyphens, underscores only)');
		}
	}
	
	function addContent() {
		const content = contentInput.trim();
		
		if (content) {
			// Only split content if auto-add is enabled
			if (autoAddOnPaste) {
				// Split by single line breaks - handles Windows, Unix, and mixed line endings
				const paragraphs = content.split(/\r?\n/).map(p => p.trim()).filter(p => p);
				
				// Create a block for each paragraph
				const newBlocks = paragraphs.map(paragraph => {
					let tag = selectedTag;
					let cleanContent = paragraph;
					
					// Auto-detect numbered lists (e.g., "1.", "2.", "1)", "2)")
					if (/^\d+[\.\)]\s+/.test(paragraph)) {
						tag = 'ol'; // ordered list
						cleanContent = paragraph.replace(/^\d+[\.\)]\s+/, '');
					}
					// Auto-detect bullet points (•, ·, -, *, +)
					else if (/^[•·\-\*\+]\s+/.test(paragraph)) {
						tag = 'ul'; // unordered list
						cleanContent = paragraph.replace(/^[•·\-\*\+]\s+/, '');
					}
					
					return {
						id: crypto.randomUUID(),
						tag: tag,
						content: cleanContent,
						metadata: [...selectedMetadata],
						createdAt: new Date().toISOString()
					};
				});
				
				blocks = [...blocks, ...newBlocks];
				
				// Auto-select first chapter if adding chapters
				if (newBlocks.some(b => b.tag === 'chapter') && !selectedChapter) {
					const firstChapter = newBlocks.find(b => b.tag === 'chapter');
					if (firstChapter) selectedChapter = firstChapter.id;
				}
			} else {
				// When auto-add is off, just add as single block without splitting
				const newBlock = {
					id: crypto.randomUUID(),
					tag: selectedTag,
					content: content,
					metadata: [...selectedMetadata],
					createdAt: new Date().toISOString()
				};
				
				blocks = [...blocks, newBlock];
				
				// Auto-select if this is the first chapter
				if (newBlock.tag === 'chapter' && !selectedChapter) {
					selectedChapter = newBlock.id;
				}
			}
			
			contentInput = '';
			selectedMetadata = []; // Clear metadata after adding
		}
	}
	
	function removeBlock(id) {
		blocks = blocks.filter(block => block.id !== id);
	}
	
	function editBlock(block) {
		editingBlock = block;
		showEditModal = true;
	}
	
	function changeBlockTag(blockId, newTag) {
		const index = blocks.findIndex(b => b.id === blockId);
		if (index !== -1) {
			blocks[index] = { ...blocks[index], tag: newTag };
			blocks = [...blocks]; // Trigger reactivity
		}
	}
	
	function handleBlockClick(e, block) {
		if (tagChangeMode) {
			e.preventDefault();
			e.stopPropagation();
			changeBlockTag(block.id, selectedTag);
		}
	}
	
	function saveBlockEdit(updatedBlock) {
		const index = blocks.findIndex(b => b.id === updatedBlock.id);
		if (index !== -1) {
			blocks[index] = updatedBlock;
			blocks = [...blocks]; // Trigger reactivity
		}
	}
	
	function closeEditModal() {
		showEditModal = false;
		editingBlock = null;
	}
	
	function moveBlock(id, direction) {
		const index = blocks.findIndex(block => block.id === id);
		if (index === -1) return;
		
		// If reversed order is enabled, flip the direction
		const actualDirection = reverseOrder ? (direction === 'up' ? 'down' : 'up') : direction;
		const newIndex = actualDirection === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= blocks.length) return;
		
		// Don't allow moving across chapter boundaries
		const currentChapter = getBlockChapter(index);
		const targetChapter = getBlockChapter(newIndex);
		if (currentChapter !== targetChapter) return;
		
		const newBlocks = [...blocks];
		[newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
		blocks = newBlocks;
	}
	
	
	function downloadJSON() {
		const data = {
			documentTitle,
			blocks,
			customTags,
			exportedAt: new Date().toISOString()
		};
		
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${documentTitle.replace(/\s+/g, '_')}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
	
	function generateXML() {
		let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
		xml += `<document title="${escapeXML(documentTitle)}">\n`;
		
		blocks.forEach(block => {
			const escapedContent = escapeXML(block.content);
			const metadataAttr = block.metadata && block.metadata.length > 0 
				? ` metadata="${escapeXML(block.metadata.join(', '))}"` 
				: '';
			xml += `  <${block.tag}${metadataAttr}>${escapedContent}</${block.tag}>\n`;
		});
		
		xml += '</document>';
		return xml;
	}
	
	function downloadXML() {
		const xml = generateXML();
		const blob = new Blob([xml], { type: 'application/xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${documentTitle.replace(/\s+/g, '_')}.xml`;
		a.click();
		URL.revokeObjectURL(url);
		showExportModal = false;
	}
	
	function escapeXML(str) {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
	
	function handleTextareaKeyDown(e) {
		if (e.key === 'Enter' && e.ctrlKey) {
			e.preventDefault();
			addContent();
		}
	}
	
	function handlePaste(e) {
		if (!autoAddOnPaste) return;
		
		// Wait for the paste to complete
		setTimeout(() => {
			if (contentInput.trim()) {
				addContent();
			}
		}, 50); // Increased timeout to ensure paste completes
	}
	
	// XML Preview
	let xmlPreview = $derived(generateXML());
	
	// Format time for display
	function formatTime(isoString) {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleTimeString('en-US', { 
			hour: 'numeric', 
			minute: '2-digit',
			second: '2-digit'
		});
	}
	
	// Get tag color class
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
			'scripture': 'bg-emerald-100 text-emerald-700',
			'prayer': 'bg-green-100 text-green-700',
			'callout': 'bg-blue-100 text-blue-700',
			
			// Meta
			'author': 'bg-pink-100 text-pink-700',
			'date': 'bg-slate-100 text-slate-700',
			'note': 'bg-yellow-100 text-yellow-700'
		};
		
		// Return custom tag style if not in predefined list
		return colorMap[tag] || 'bg-violet-100 text-violet-700';
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="bg-white rounded-xl shadow-lg p-6 mb-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold text-gray-800">Document Builder</h1>
					<p class="text-gray-600 mt-1">Create structured content with custom tags</p>
				</div>
				<div class="flex gap-4 items-center">
					<!-- Save Status Indicator -->
					<div class="flex items-center gap-2 text-sm">
						{#if saveStatus === 'saving'}
							<div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
							<span class="text-blue-600">Saving...</span>
						{:else if saveStatus === 'saved'}
							<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
							</svg>
							<span class="text-green-600">Saved to AHWGP_master.json {lastSaveTime ? `at ${formatTime(lastSaveTime)}` : ''}</span>
						{:else if saveStatus === 'error'}
							<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<span class="text-red-600">Save error</span>
						{/if}
					</div>
					
					<a href="/" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
						Back to Home
					</a>
					<button
						onclick={() => showExportModal = true}
						class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
					>
						Export
					</button>
				</div>
			</div>
			
			<!-- Document Title -->
			<div class="mt-4">
				<input
					type="text"
					bind:value={documentTitle}
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
					placeholder="Document Title..."
				/>
			</div>
		</div>
		
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Input Section -->
			<div class="bg-white rounded-xl shadow-lg p-6">
				<h2 class="text-xl font-semibold mb-4 text-gray-800">Content Editor</h2>
				
				<!-- Current Selection -->
				<div class="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
					<div class="flex items-center justify-between">
						<div>
							<span class="text-purple-700 font-medium">Selected Tag:</span>
							<span class="text-purple-900 font-bold ml-2">{selectedTag}</span>
						</div>
						{#if tagChangeMode}
							<div class="flex items-center gap-2 text-sm">
								<div class="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
								<span class="text-orange-700 font-medium">Hold Alt + Click to Change Tags</span>
							</div>
						{/if}
					</div>
					{#if !tagChangeMode}
						<div class="text-xs text-purple-600 mt-1">
							💡 Hold Alt key and click any block to change its tag to "{selectedTag}"
						</div>
					{/if}
				</div>
				
				<!-- Tag Selector -->
				<div class="mb-4">
					<h3 class="text-sm font-medium text-gray-700 mb-2">Select Tag</h3>
					<div class="flex flex-wrap gap-2">
						{#each allTags as tag}
							<button
								onclick={() => selectedTag = tag}
								class="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 {
									selectedTag === tag 
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
				<div class="mb-4">
					<h3 class="text-sm font-medium text-gray-700 mb-2">Add Metadata (Optional)</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each metadataOptions as option}
							<label class="flex items-center gap-2 text-sm cursor-pointer">
								<input 
									type="checkbox" 
									value={option}
									bind:group={selectedMetadata}
									class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
								>
								<span class="text-gray-700">{option}</span>
							</label>
						{/each}
					</div>
					{#if selectedMetadata.length > 0}
						<div class="mt-2 flex flex-wrap gap-1">
							{#each selectedMetadata as meta}
								<span class="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
									{meta}
									<button onclick={() => selectedMetadata = selectedMetadata.filter(m => m !== meta)} class="text-orange-500 hover:text-orange-700">×</button>
								</span>
							{/each}
						</div>
					{/if}
				</div>
				
				<!-- Custom Tag Input -->
				<div class="mb-4 flex gap-2">
					<input
						type="text"
						bind:value={customTagInput}
						onkeydown={(e) => e.key === 'Enter' && addCustomTag()}
						placeholder="Create custom tag..."
						class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
					/>
					<button
						onclick={addCustomTag}
						class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
					>
						Add Tag
					</button>
				</div>
				
				<!-- Content Input -->
				<div class="mb-4">
					<textarea
						bind:value={contentInput}
						onkeydown={handleTextareaKeyDown}
						onpaste={handlePaste}
						placeholder="Enter your content here... {autoAddOnPaste ? '(Paste auto-adds, or Ctrl+Enter to add)' : '(Ctrl+Enter to add)'}"
						class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
					></textarea>
					
					<!-- Auto-add toggle -->
					<div class="mt-2 flex items-center gap-2">
						<label class="relative inline-flex items-center cursor-pointer">
							<input 
								type="checkbox" 
								bind:checked={autoAddOnPaste}
								class="sr-only peer"
							>
							<div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
						</label>
						<span class="text-sm text-gray-700">Auto-add on paste & split by line breaks</span>
					</div>
				</div>
				
				<!-- Action Buttons -->
				<div class="flex gap-2">
					<button
						onclick={addContent}
						class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
					>
						Add to Document
					</button>
				</div>
				
				<!-- Stats -->
				<div class="mt-4 text-sm text-gray-600">
					<span>Blocks: {blocks.length}</span>
					<span class="mx-2">•</span>
					<span>Custom Tags: {customTags.length}</span>
				</div>
			</div>
			
			<!-- Preview Section -->
			<div class="bg-white rounded-xl shadow-lg p-6">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xl font-semibold text-gray-800">Document Structure</h2>
					<button
						onclick={() => reverseOrder = !reverseOrder}
						class="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
						title="Toggle display order"
					>
						{reverseOrder ? '↑ Newest First' : '↓ Oldest First'}
					</button>
				</div>
				
				<!-- Chapter Pills -->
				{#if chapters.length > 0}
					{@const visibleChapters = showAllChapters ? chapters : chapters.slice(-5)}
					<div class="mb-4">
						<div class="flex flex-wrap gap-2 items-center">
							<button
								onclick={() => selectedChapter = null}
								class="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 {
									!selectedChapter 
										? 'bg-indigo-600 text-white shadow-md' 
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
								}"
							>
								All Chapters
							</button>
							
							{#each visibleChapters as chapter}
								<button
									onclick={() => selectedChapter = chapter.id}
									class="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 {
										selectedChapter === chapter.id 
											? 'bg-indigo-600 text-white shadow-md' 
											: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
									}"
									title={chapter.title}
								>
									{chapter.title.length > 25 ? chapter.title.substring(0, 25) + '...' : chapter.title}
								</button>
							{/each}
							
							{#if chapters.length > 5}
								<button
									onclick={() => showAllChapters = !showAllChapters}
									class="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all duration-200"
								>
									{showAllChapters ? `Hide ${chapters.length - 5} chapters` : `+${chapters.length - 5} more`}
								</button>
							{/if}
						</div>
						
						{#if !showAllChapters && chapters.length > 5}
							<div class="text-xs text-gray-500 mt-1">
								Showing latest 5 chapters • Total: {chapters.length} chapters
							</div>
						{/if}
					</div>
				{/if}
				
				{#if blocks.length === 0}
					<div class="text-center py-12 text-gray-500">
						<p class="text-lg">No content yet</p>
						<p class="text-sm mt-2">Start adding blocks to see them here</p>
					</div>
				{:else}
					<div class="space-y-2 max-h-[600px] overflow-y-auto">
						{#each filteredBlocks as block, index}
							<div 
								class="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow {tagChangeMode ? 'hover:bg-purple-50 cursor-crosshair' : ''}"
								onclick={(e) => handleBlockClick(e, block)}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<div class="flex flex-wrap gap-1 items-center">
											<span class="inline-block px-2 py-1 text-xs font-medium rounded {getTagColorClass(block.tag)}">
												{block.tag}
											</span>
											{#if block.metadata && block.metadata.length > 0}
												{#each block.metadata as meta}
													<span class="inline-block px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded">
														{meta}
													</span>
												{/each}
											{/if}
										</div>
										<div class="mt-2 text-gray-700 text-sm">
											<RichTextDisplay content={block.content} />
										</div>
									</div>
									<div class="flex gap-1 ml-2">
										<button
											onclick={() => editBlock(block)}
											class="p-1 text-blue-500 hover:text-blue-700"
											title="Edit block"
										>
											✏️
										</button>
										<button
											onclick={() => moveBlock(block.id, 'up')}
											disabled={index === 0}
											class="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
											title="Move up"
										>
											↑
										</button>
										<button
											onclick={() => moveBlock(block.id, 'down')}
											disabled={index === filteredBlocks.length - 1}
											class="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
											title="Move down"
										>
											↓
										</button>
										<button
											onclick={() => removeBlock(block.id)}
											class="p-1 text-red-500 hover:text-red-700"
											title="Delete block"
										>
											×
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Export Modal -->
{#if showExportModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
		<div class="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
			<div class="p-6">
				<h3 class="text-2xl font-bold mb-4">Export Options</h3>
				
				<div class="space-y-4">
					<button
						onclick={downloadJSON}
						class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left"
					>
						<div class="font-medium">Download as JSON</div>
						<div class="text-sm opacity-90">Best for saving and loading later</div>
					</button>
					
					<button
						onclick={downloadXML}
						class="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-left"
					>
						<div class="font-medium">Download as XML</div>
						<div class="text-sm opacity-90">Ready for InDesign import</div>
					</button>
				</div>
				
				<div class="mt-6">
					<h4 class="font-medium mb-2">XML Preview:</h4>
					<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-64">
{xmlPreview}
					</pre>
				</div>
				
				<div class="mt-6 flex justify-end">
					<button
						onclick={() => showExportModal = false}
						class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Edit Block Modal -->
<EditBlockModal 
	isOpen={showEditModal}
	block={editingBlock}
	allTags={allTags}
	metadataOptions={metadataOptions}
	onSave={saveBlockEdit}
	onClose={closeEditModal}
/>

<style>
	/* Additional styles if needed */
	:global(html) {
		scroll-behavior: smooth;
	}
</style>