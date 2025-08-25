<script>
  import { onMount } from 'svelte';
  import { parseXML } from '$lib/xmlParser.js';
  import { appState } from '$lib/stores/state.svelte.js';
  
  import Navigation from '$lib/components/Navigation.svelte';
  import ChapterPanel from '$lib/components/ChapterPanel.svelte';
  
  let fileInput = $state();
  let loading = $state(false);
  let error = $state(null);
  
  // Log state changes
  $effect(() => {
    console.log('📖 Viewer - bookData chapters:', appState.bookData?.chapters?.length || 0);
    console.log('📖 Viewer - filteredChapters length:', appState.filteredChapters.length);
    if (appState.filteredChapters.length > 0) {
      console.log('📖 First chapter:', appState.filteredChapters[0].title);
    }
  });
  
  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📁 File selected:', file.name, 'Size:', file.size);
    loading = true;
    error = null;
    
    try {
      const text = await file.text();
      console.log('📄 File text loaded, length:', text.length);
      const parsedData = parseXML(text);
      console.log('✅ XML parsed successfully:', parsedData);
      console.log('📊 Summary - Chapters:', parsedData.chapters?.length, 'Total blocks:', parsedData.totalBlocks);
      appState.setBookData(parsedData);
      console.log('💾 Data set in appState');
    } catch (err) {
      error = err.message;
      console.error('❌ Error parsing XML:', err);
    } finally {
      loading = false;
    }
  }
  
  // Load sample XML for development
  onMount(async () => {
    console.log('🚀 Component mounted, loading sample XML...');
    try {
      const response = await fetch('/AHWGP_structured_with_ids.xml');
      console.log('📡 Fetch response:', response.status, response.ok);
      if (response.ok) {
        const text = await response.text();
        console.log('📄 Sample XML loaded, length:', text.length);
        const parsedData = parseXML(text);
        console.log('✅ Sample XML parsed:', parsedData);
        console.log('📊 Summary - Chapters:', parsedData.chapters?.length, 'Total blocks:', parsedData.totalBlocks);
        appState.setBookData(parsedData);
        console.log('💾 Sample data set in appState');
        console.log('🔍 Current appState.bookData:', appState.bookData);
      }
    } catch (err) {
      console.error('❌ Could not load sample XML:', err);
    }
  });
</script>

<svelte:head>
  <title>AHWGP Content Viewer</title>
</svelte:head>

<div class="h-screen flex bg-gray-50">
  <!-- Sidebar -->
  {#if appState.sidebarOpen}
    <aside class="w-80 bg-gray-50 border-r border-gray-200 overflow-y-auto flex-shrink-0">
      <Navigation />
    </aside>
  {/if}
  
  <!-- Main Content -->
  <main class="flex-1 bg-gray-50 overflow-y-auto" class:w-full={!appState.sidebarOpen}>
    <!-- Header Controls -->
    <header class="viewer-header bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <div class="header-left flex items-center gap-4">
        <button 
          onclick={() => appState.toggleSidebar()}
          class="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
          Toggle Navigation
        </button>
        
        <label class="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded cursor-pointer hover:bg-blue-100 transition-colors">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
          </svg>
          Upload XML File
          <input 
            type="file" 
            accept=".xml"
            bind:this={fileInput}
            onchange={handleFileUpload}
            class="hidden"
          />
        </label>
      </div>
      
      <div class="header-controls flex items-center gap-4">
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" bind:checked={appState.showUUIDs} class="rounded" />
          Show UUIDs
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" bind:checked={appState.showMetadata} class="rounded" />
          Show Metadata
        </label>
      </div>
    </header>
    
    <!-- Content Display -->
    <div class="content-area flex-1 overflow-y-auto p-6">
      {#if loading}
        <div class="loading flex items-center justify-center h-64">
          <div class="text-center">
            <svg class="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-gray-600 mt-2">Loading XML content...</p>
          </div>
        </div>
      {:else if error}
        <div class="error bg-red-50 border border-red-200 rounded-lg p-6">
          <div class="flex items-start gap-3">
            <svg class="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div>
              <h3 class="text-red-800 font-medium">Error loading XML</h3>
              <p class="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      {:else if appState.bookData}
        <div class="book-header mb-8">
          <h1 class="text-3xl font-bold text-gray-800 mb-2">{appState.bookData.metadata.title}</h1>
          <p class="text-xl text-gray-600 mb-4">{appState.bookData.metadata.subtitle}</p>
          <div class="book-stats flex flex-wrap gap-4 text-sm text-gray-500">
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {appState.bookData.chapters.length} chapters
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
              </svg>
              {appState.bookData.totalBlocks} content blocks
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
              </svg>
              {appState.bookData.statistics.paragraphs} paragraphs
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              {appState.bookData.statistics.callouts} callouts
            </span>
          </div>
        </div>
        
        <div class="chapters-container">
          {#if appState.filteredChapters && appState.filteredChapters.length > 0}
            {#each appState.filteredChapters as chapter (chapter.id)}
              <ChapterPanel 
                {chapter} 
                showMetadata={appState.showMetadata}
                showUUIDs={appState.showUUIDs}
              />
            {/each}
          {:else}
            <div class="empty-state text-center py-16">
              <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <h3 class="text-lg font-medium text-gray-600 mb-2">No chapters match your filters</h3>
              <p class="text-gray-500">Try adjusting your search or content type filter.</p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-state text-center py-16">
          <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 class="text-xl font-medium text-gray-600 mb-2">No content loaded</h2>
          <p class="text-gray-500 mb-4">Upload an XML file to begin viewing content, or wait for the sample file to load.</p>
          <label class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
            Choose XML File
            <input 
              type="file" 
              accept=".xml"
              onchange={handleFileUpload}
              class="hidden"
            />
          </label>
        </div>
      {/if}
    </div>
  </main>
</div>

