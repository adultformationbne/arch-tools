<script>
  import { appState } from '$lib/stores/state.svelte.js';
  
  // Log state changes
  $effect(() => {
    console.log('🧭 Navigation - chapters available:', appState.filteredChapters.length);
  });
  
  function jumpToChapter(chapterId) {
    const element = document.getElementById(chapterId);
    element?.scrollIntoView({ behavior: 'smooth' });
  }
  
  function expandChapter(chapterId) {
    appState.expandChapter(chapterId);
    jumpToChapter(chapterId);
  }
  
  const contentTypes = [
    { value: 'all', label: 'All Content' },
    { value: 'paragraph', label: 'Paragraphs' },
    { value: 'callout_text', label: 'Callouts' },
    { value: 'callout_header', label: 'Callout Headers' },
    { value: 'header', label: 'Headers' },
    { value: 'special_text', label: 'Special Text' }
  ];
</script>

<nav class="h-full flex flex-col bg-gray-50">
  <!-- Search Section -->
  <div class="search-section p-4 border-b border-gray-200">
    <div class="mb-3">
      <label for="search" class="block text-sm font-medium text-gray-700 mb-1">
        Search Content
      </label>
      <input 
        id="search"
        type="text" 
        placeholder="Search chapters and content..." 
        bind:value={appState.searchQuery}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      />
    </div>
    
    <div class="mb-3">
      <label for="filter" class="block text-sm font-medium text-gray-700 mb-1">
        Content Type
      </label>
      <select 
        id="filter"
        bind:value={appState.contentTypeFilter}
        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
      >
        {#each contentTypes as type}
          <option value={type.value}>{type.label}</option>
        {/each}
      </select>
    </div>
    
    <div class="flex gap-2">
      <button 
        onclick={() => appState.expandAll()}
        class="flex-1 px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
      >
        Expand All
      </button>
      <button 
        onclick={() => appState.collapseAll()}
        class="flex-1 px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
      >
        Collapse All
      </button>
    </div>
  </div>
  
  <!-- Book Statistics -->
  {#if appState.bookData}
    <div class="stats-section p-4 border-b border-gray-200 bg-gray-50">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">Book Statistics</h3>
      <div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div>Chapters: {appState.bookData.chapters?.length || 0}</div>
        <div>Total Blocks: {appState.bookData.totalBlocks || 0}</div>
        <div>Paragraphs: {appState.bookData.statistics?.paragraphs || 0}</div>
        <div>Callouts: {appState.bookData.statistics?.callouts || 0}</div>
      </div>
    </div>
  {/if}
  
  <!-- Chapters List -->
  <div class="chapters-list flex-1 overflow-y-auto">
    <div class="p-4">
      <h3 class="text-sm font-semibold text-gray-700 mb-3">
        Chapters ({appState.filteredChapters?.length || 0})
      </h3>
      
      {#if appState.filteredChapters && appState.filteredChapters.length > 0}
        <div class="space-y-2">
          {#each appState.filteredChapters as chapter (chapter.id)}
            <button 
              class="chapter-nav-item w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors group"
              onclick={() => expandChapter(chapter.id)}
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="chapter-number text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {chapter.number}
                    </span>
                    <span class="chapter-count text-xs text-gray-500">
                      {chapter.totalBlocks} blocks
                    </span>
                  </div>
                  <h4 class="chapter-title text-sm font-medium text-gray-800 truncate group-hover:text-blue-600">
                    {chapter.title}
                  </h4>
                </div>
                <svg class="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          {/each}
        </div>
      {:else if appState.searchQuery || appState.contentTypeFilter !== 'all'}
        <div class="text-center py-8 text-gray-500">
          <p class="text-sm">No chapters match your search criteria.</p>
          <button 
            onclick={() => appState.clearFilters()}
            class="text-blue-600 hover:text-blue-800 text-sm mt-2 underline"
          >
            Clear filters
          </button>
        </div>
      {:else}
        <div class="text-center py-8 text-gray-500">
          <p class="text-sm">No chapters available.</p>
        </div>
      {/if}
    </div>
  </div>
</nav>

