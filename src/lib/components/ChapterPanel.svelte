<script>
  let { chapter, showMetadata = false, showUUIDs = false } = $props();
  
  import ContentCard from './ContentCard.svelte';
  import { appState } from '$lib/stores/state.svelte.js';
  
  // Use a derived state that reacts to expandedChapters object changes
  const isExpanded = $derived(!!appState.expandedChapters[chapter.id]);
  
  function toggleExpanded() {
    console.log('🔄 Toggling chapter:', chapter.id);
    appState.toggleChapter(chapter.id);
    console.log('🔄 Chapter expanded:', !!appState.expandedChapters[chapter.id]);
  }
</script>

<div class="mb-6 border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm" id={chapter.id}>
  <button class="w-full text-left p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150" onclick={toggleExpanded}>
    <div class="flex-1">
      <h2 class="text-xl font-semibold text-gray-800">
        Chapter {chapter.number}: {chapter.title}
      </h2>
      <div class="flex items-center mt-1">
        <span class="text-sm text-gray-500">
          {chapter.totalBlocks} blocks
        </span>
        {#if showUUIDs}
          <code class="text-xs text-gray-400 font-mono ml-2">
            {chapter.id}
          </code>
        {/if}
      </div>
    </div>
    <span class="transition-transform duration-200 text-gray-400" class:rotate-180={isExpanded}>
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </span>
  </button>
  
  {#if isExpanded}
    <div class="p-6 bg-gray-50">
      {#if chapter.blocks && chapter.blocks.length > 0}
        {#each chapter.blocks as block (block.id)}
          <ContentCard {block} {showMetadata} showUUID={showUUIDs} />
        {/each}
      {:else}
        <div class="text-gray-500 text-center p-8">
          No content blocks found in this chapter.
        </div>
      {/if}
    </div>
  {/if}
</div>

