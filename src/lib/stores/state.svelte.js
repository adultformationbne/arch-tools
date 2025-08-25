// Global application state using Svelte 5 runes
class AppState {
  bookData = $state(null);
  selectedChapter = $state(null);
  searchQuery = $state('');
  contentTypeFilter = $state('all');
  
  sidebarOpen = $state(true);
  viewMode = $state('expanded');
  showMetadata = $state(false);
  showUUIDs = $state(false);
  expandedChapters = $state({});

  // Manually managed filtered chapters
  filteredChapters = $state([]);
  
  // Method to update filtered chapters
  updateFilteredChapters() {
    console.log('🔄 updateFilteredChapters called');
    
    if (!this.bookData?.chapters) {
      console.log('🔄 No bookData or chapters available');
      this.filteredChapters = [];
      return;
    }
    
    console.log('🔄 Filtering', this.bookData.chapters.length, 'chapters');
    console.log('🔄 Search query:', `"${this.searchQuery}"`);
    console.log('🔄 Content filter:', this.contentTypeFilter);
    
    let chapters = [...this.bookData.chapters]; // Create a copy
    
    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      chapters = chapters.filter(chapter => {
        if (chapter.title.toLowerCase().includes(query)) return true;
        return chapter.blocks.some(block => 
          block.content.toLowerCase().includes(query)
        );
      });
      console.log('🔍 After search filter:', chapters.length);
    }
    
    // Filter by content type
    if (this.contentTypeFilter !== 'all') {
      chapters = chapters.map(chapter => {
        const filteredBlocks = chapter.blocks.filter(block => block.type === this.contentTypeFilter);
        return {
          ...chapter,
          blocks: filteredBlocks,
          totalBlocks: filteredBlocks.length
        };
      }).filter(chapter => chapter.blocks.length > 0);
      console.log('📝 After content type filter:', chapters.length);
    }
    
    console.log('✅ Setting filteredChapters to', chapters.length, 'chapters');
    this.filteredChapters = chapters;
  }

  currentChapterBlocks = $derived(() => {
    if (!this.bookData?.chapters || !this.selectedChapter) return [];
    
    const chapter = this.bookData.chapters.find(ch => ch.id === this.selectedChapter.id);
    return chapter?.blocks || [];
  });

  bookStatistics = $derived(() => {
    if (!this.bookData) return null;
    
    return {
      totalChapters: this.bookData.chapters.length,
      totalBlocks: this.bookData.totalBlocks,
      ...(this.bookData.statistics || {})
    };
  });

  // Actions
  setBookData(data) {
    console.log('📚 Setting bookData with', data?.chapters?.length, 'chapters');
    this.bookData = data;
    this.updateFilteredChapters();
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  expandChapter(chapterId) {
    this.expandedChapters[chapterId] = true;
  }

  collapseChapter(chapterId) {
    delete this.expandedChapters[chapterId];
  }

  toggleChapter(chapterId) {
    if (this.expandedChapters[chapterId]) {
      delete this.expandedChapters[chapterId];
    } else {
      this.expandedChapters[chapterId] = true;
    }
  }

  expandAll() {
    if (this.bookData?.chapters) {
      this.expandedChapters = {};
      this.bookData.chapters.forEach(ch => {
        this.expandedChapters[ch.id] = true;
      });
    }
  }

  collapseAll() {
    this.expandedChapters = {};
  }

  clearFilters() {
    this.searchQuery = '';
    this.contentTypeFilter = 'all';
    this.updateFilteredChapters();
  }
  
  setSearchQuery(query) {
    this.searchQuery = query;
    this.updateFilteredChapters();
  }
  
  setContentTypeFilter(filter) {
    this.contentTypeFilter = filter;
    this.updateFilteredChapters();
  }
}

// Export a single instance
export const appState = new AppState();