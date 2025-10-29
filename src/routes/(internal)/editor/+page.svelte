<script>
	import EditBlockModal from '$lib/components/EditBlockModal.svelte';
	import DocumentPreview from '$lib/components/DocumentPreview.svelte';
	import BlockVersionHistory from '$lib/components/BlockVersionHistory.svelte';
	import EditorHeader from '$lib/components/EditorHeader.svelte';
	import EditorFilters from '$lib/components/EditorFilters.svelte';
	import EditorListView from '$lib/components/EditorListView.svelte';
	import EditorEmptyState from '$lib/components/EditorEmptyState.svelte';
	import ChapterSidebar from '$lib/components/ChapterSidebar.svelte';
	import SyncStatus from '$lib/components/SyncStatus.svelte';
	import { OptimisticEditor } from '$lib/optimistic-editor.svelte.js';
	import * as EditorAPI from '$lib/editor-api.js';

	// Simple approach - go back to working patterns
	let blocks = $state([]);
	let filteredBlocks = $state([]);
	let syncStatus = $state({ pendingCount: 0, isProcessing: false, lastSync: null, hasErrors: false });
	let selectedBlocks = $state(new Set());
	let showEditModal = $state(false);
	let editingBlock = $state(null);
	let showVersionHistory = $state(false);
	let versionHistoryBlockId = $state(null);
	let versionHistoryCurrentContent = $state('');
	let documentTitle = $state('Untitled Document');
	let lastSavedTitle = $state('Untitled Document');
	let saveStatus = $state('saved');
	let lastSaveTime = $state(null);
	let errorMessage = $state('');


	// Filters and settings
	let searchQuery = $state('');
	let tagFilter = $state('all');
	let metadataFilter = $state('all');
	let hideInvisible = $state(false);
	let selectedChapter = $state(null);

	// Predefined options
	const predefinedTags = [
		'paragraph',
		'h1',
		'h2',
		'h3',
		'chapter',
		'title',
		'quote',
		'author',
		'date',
		'prayer',
		'scripture',
		'callout',
		'note',
		'ul',
		'ol'
	];

	const metadataOptions = [
		'prayer page',
		'activity',
		'reflection',
		'discussion',
		'ritual',
		'celebration',
		'homework',
		'assessment',
		'introduction',
		'conclusion',
		'background info'
	];

	// Derived values - correct Svelte 5 syntax
	let chapters = $derived(
		blocks
			.filter((block) => block.tag === 'chapter')
			.map((block) => ({
				id: block.id,
				title: block.content,
				index: blocks.indexOf(block)
			}))
	);

	let allTags = $derived([
		...predefinedTags,
		...Array.from(new Set(blocks.map((block) => block.tag))).filter((tag) => !predefinedTags.includes(tag))
	]);

	let allMetadata = $derived((() => {
		const usedMetadata = new Set();
		blocks.forEach((block) => {
			if (block.metadata && Array.isArray(block.metadata)) {
				block.metadata.forEach((meta) => usedMetadata.add(meta));
			}
		});
		return [
			...metadataOptions,
			...Array.from(usedMetadata).filter((meta) => !metadataOptions.includes(meta))
		];
	})());

	// Load data directly using EditorAPI
	$effect(() => {
		(async () => {
			try {
				saveStatus = 'loading';
				const bookData = await EditorAPI.loadBook();

				// Set blocks directly
				blocks = (bookData.blocks || []).map(block => ({
					...block,
					isVisible: block.isVisible !== undefined ? block.isVisible : true
				}));

				// Apply filters
				applyFilters();

				documentTitle = bookData.documentTitle || 'Untitled Document';
				lastSavedTitle = documentTitle;
				lastSaveTime = bookData.lastSaved;
				saveStatus = 'saved';
			} catch (error) {
				console.error('Error loading data:', error);
				saveStatus = 'error';
				errorMessage = error.message || 'Failed to load data';
			}
		})();
	});
	
	// Simple filter function
	function applyFilters() {
		let filtered = [...blocks];
		
		// Apply all filters
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(block) =>
					block.content?.toLowerCase().includes(query) ||
					block.tag?.toLowerCase().includes(query) ||
					(block.metadata && Array.isArray(block.metadata) && block.metadata.some((meta) => meta.toLowerCase().includes(query)))
			);
		}
		
		if (tagFilter !== 'all') {
			filtered = filtered.filter((block) => block.tag === tagFilter);
		}
		
		if (metadataFilter !== 'all') {
			filtered = filtered.filter(
				(block) => block.metadata && Array.isArray(block.metadata) && block.metadata.includes(metadataFilter)
			);
		}
		
		if (selectedChapter) {
			const chapterIndex = blocks.findIndex((b) => b.id === selectedChapter);
			if (chapterIndex !== -1) {
				const chapterBlocks = [];
				for (let i = chapterIndex; i < blocks.length; i++) {
					if (i > chapterIndex && blocks[i].tag === 'chapter') break;
					chapterBlocks.push(blocks[i]);
				}
				filtered = filtered.filter((block) => chapterBlocks.includes(block));
			}
		}
		
		if (hideInvisible) {
			filtered = filtered.filter((block) => block.isVisible !== false);
		}
		
		filteredBlocks = filtered;
	}
	
	// Watch for filter changes
	$effect(() => {
		applyFilters();
	});


	// Watch for document title changes and save
	let titleSaveTimeout;
	$effect(() => {
		if (documentTitle && documentTitle !== lastSavedTitle) {
			clearTimeout(titleSaveTimeout);
			titleSaveTimeout = setTimeout(async () => {
				try {
					saveStatus = 'saving';
					await EditorAPI.saveBook({ documentTitle });
					lastSavedTitle = documentTitle;
					lastSaveTime = new Date().toISOString();
					saveStatus = 'saved';
					errorMessage = '';
				} catch (error) {
					console.error('Error saving document title:', error);
					saveStatus = 'error';
					errorMessage = 'Failed to save document title';
				}
			}, 1000);
		}
	});

	// Refresh blocks from database (used after content changes like block edits)
	async function refreshBlocks() {
		try {
			saveStatus = 'loading';
			const bookData = await EditorAPI.loadBook();
			
			blocks = (bookData.blocks || []).map(block => ({
				...block,
				isVisible: block.isVisible !== undefined ? block.isVisible : true
			}));
			
			documentTitle = bookData.documentTitle || 'Untitled Document';
			lastSavedTitle = documentTitle;
			lastSaveTime = bookData.lastSaved;
			applyFilters();
			saveStatus = 'saved';
		} catch (error) {
			console.error('Error refreshing:', error);
			saveStatus = 'error';
			errorMessage = error.message || 'Failed to refresh data';
		}
	}

	// Save block to database
	async function saveBlock(blockData) {
		try {
			saveStatus = 'saving';
			await EditorAPI.saveBlock(blockData);
			await refreshBlocks();
		} catch (error) {
			console.error('Error saving block:', error);
			saveStatus = 'error';
			errorMessage = error.message || 'Failed to save block';
		}
	}

	// Block operations
	function editBlock(block) {
		editingBlock = block;
		showEditModal = true;
	}

	async function saveBlockEdit(updatedBlock) {
		await saveBlock({
			block_id: updatedBlock.id,
			content: updatedBlock.content,
			tag: updatedBlock.tag,
			metadata: updatedBlock.metadata
		});
	}

	function closeEditModal() {
		showEditModal = false;
		editingBlock = null;
	}

	function showBlockVersionHistory(block) {
		versionHistoryBlockId = block.id;
		versionHistoryCurrentContent = block.content;
		showVersionHistory = true;
	}

	function closeVersionHistory() {
		showVersionHistory = false;
		versionHistoryBlockId = null;
		versionHistoryCurrentContent = '';
	}

	async function restoreBlockVersion(event) {
		try {
			const { blockId, content, tag, metadata, versionId } = event.detail;

			// Create a new version with the restored content
			await saveBlock({
				block_id: blockId,
				content: content,
				tag: tag,
				metadata: metadata
			});

			// Show success message
			console.log('Version restored successfully');
		} catch (error) {
			console.error('Error restoring version:', error);
		}
	}

	async function toggleBlockVisibility(blockId) {
		try {
			const block = blocks.find(b => b.id === blockId);
			if (block) {
				// Optimistic update
				block.isVisible = !block.isVisible;
				applyFilters();
				
				// API call
				await EditorAPI.bulkOperation('set_visibility', [blockId], {
					visible: block.isVisible
				});
			}
		} catch (error) {
			console.error('Error toggling visibility:', error);
		}
	}

	async function moveBlock(blockId, direction) {
		try {
			const index = blocks.findIndex(b => b.id === blockId);
			if (index === -1) return;
			
			const newIndex = direction === 'up' ? index - 1 : index + 1;
			if (newIndex < 0 || newIndex >= blocks.length) return;
			
			// Optimistic update
			const [movedBlock] = blocks.splice(index, 1);
			blocks.splice(newIndex, 0, movedBlock);
			blocks = [...blocks]; // Trigger reactivity
			applyFilters();
			
			// API call
			await EditorAPI.bulkOperation('move', [blockId], { direction });
		} catch (error) {
			console.error('Error moving block:', error);
		}
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
		selectedBlocks = new Set(filteredBlocks.map((b) => b.id));
	}

	function clearSelection() {
		selectedBlocks = new Set();
	}

	async function bulkToggleVisibility() {
		try {
			// Optimistic update
			Array.from(selectedBlocks).forEach(blockId => {
				const block = blocks.find(b => b.id === blockId);
				if (block) {
					block.isVisible = !block.isVisible;
				}
			});
			applyFilters();
			
			// API call
			await EditorAPI.bulkOperation('toggle_visibility', Array.from(selectedBlocks));
		} catch (error) {
			console.error('Error bulk toggling visibility:', error);
		}
	}

	// Duplicate block function
	function duplicateBlock(block) {
		// TODO: Implement block duplication
		console.log('Duplicate block:', block.id);
	}

	// Chapter navigation function
	function scrollToChapter(chapterId) {
		// Find the chapter element and scroll to it
		const chapterElement = document.querySelector(`[data-block-id="${chapterId}"]`);
		if (chapterElement) {
			chapterElement.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'start',
				inline: 'nearest'
			});
		}
	}
</script>

<div class="flex bg-gradient-to-br from-blue-50 to-indigo-50">
	<!-- Chapter Sidebar - Hidden on mobile, visible on tablet+ -->
	<div class="hidden md:block">
		<ChapterSidebar
			{chapters}
			{blocks}
			bind:selectedChapter
			onChapterSelect={applyFilters}
			onScrollToChapter={scrollToChapter}
		/>
	</div>

	<!-- Mobile Chapter Sidebar Overlay -->
	<div class="md:hidden">
		<ChapterSidebar
			{chapters}
			{blocks}
			bind:selectedChapter
			onChapterSelect={applyFilters}
			onScrollToChapter={scrollToChapter}
		/>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 flex flex-col min-w-0 min-h-screen">
		<!-- Header -->
		<div class="bg-white border-b border-gray-200 px-6 py-4">
			<div class="flex items-center justify-between">
				<div class="flex-1">
					<EditorHeader bind:documentTitle {saveStatus} {lastSaveTime} {errorMessage} />
				</div>
				<div class="flex items-center gap-4">
					<SyncStatus {syncStatus} />
				</div>
			</div>
		</div>

		<!-- Main Content -->
		<div class="flex-1 overflow-auto p-6">
			<div class="mx-auto max-w-5xl space-y-6">
				<!-- Filters and Controls -->
				<EditorFilters
					bind:searchQuery
					bind:tagFilter
					bind:metadataFilter
					bind:hideInvisible
					{allTags}
					{allMetadata}
					filteredCount={filteredBlocks.length}
					totalCount={blocks.length}
					{selectedBlocks}
					onSelectAll={selectAll}
					onClearSelection={clearSelection}
					onBulkToggleVisibility={bulkToggleVisibility}
				/>

				<!-- Content Display -->
				{#if filteredBlocks.length === 0}
					<EditorEmptyState
						{searchQuery}
						hasFilters={tagFilter !== 'all' ||
							metadataFilter !== 'all' ||
							hideInvisible ||
							selectedChapter}
					/>
				{:else}
					<!-- Document Preview Mode -->
					<div class="rounded-xl bg-white p-8 shadow-lg">
						<DocumentPreview
							blocks={filteredBlocks}
							{selectedBlocks}
							onEdit={editBlock}
							onToggleVisibility={toggleBlockVisibility}
							onMove={moveBlock}
							onToggleSelection={toggleBlockSelection}
							onShowVersionHistory={showBlockVersionHistory}
						/>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Edit Block Modal -->
<EditBlockModal
	isOpen={showEditModal}
	block={editingBlock}
	{allTags}
	{metadataOptions}
	onSave={saveBlockEdit}
	onClose={closeEditModal}
/>

<!-- Version History Modal -->
<BlockVersionHistory
	isOpen={showVersionHistory}
	blockId={versionHistoryBlockId}
	currentContent={versionHistoryCurrentContent}
	on:close={closeVersionHistory}
	on:restore={restoreBlockVersion}
/>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>
