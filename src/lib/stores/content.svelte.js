// Svelte 5 state management
export let bookData = $state(null);
export let selectedChapter = $state(null);
export let searchQuery = $state('');
export let contentTypeFilter = $state('all');

// Derived values
export const filteredChapters = $derived(() => {
  if (!bookData?.chapters) return [];
  
  let chapters = bookData.chapters;
  
  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    chapters = chapters.filter(chapter => {
      // Search in chapter title
      if (chapter.title.toLowerCase().includes(query)) return true;
      
      // Search in chapter content blocks
      return chapter.blocks.some(block => 
        block.content.toLowerCase().includes(query)
      );
    });
  }
  
  // Filter by content type
  if (contentTypeFilter !== 'all') {
    chapters = chapters.map(chapter => ({
      ...chapter,
      blocks: chapter.blocks.filter(block => block.type === contentTypeFilter),
      totalBlocks: chapter.blocks.filter(block => block.type === contentTypeFilter).length
    })).filter(chapter => chapter.blocks.length > 0);
  }
  
  return chapters;
});

export const currentChapterBlocks = $derived(() => {
  if (!bookData?.chapters || !selectedChapter) return [];
  
  const chapter = bookData.chapters.find(ch => ch.id === selectedChapter.id);
  return chapter?.blocks || [];
});

export const bookStatistics = $derived(() => {
  if (!bookData) return null;
  
  return {
    totalChapters: bookData.chapters.length,
    totalBlocks: bookData.totalBlocks,
    ...(bookData.statistics || {})
  };
});