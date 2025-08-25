// Svelte 5 UI state management
export let sidebarOpen = $state(true);
export let viewMode = $state('expanded'); // 'compact' | 'expanded'
export let showMetadata = $state(false);
export let showUUIDs = $state(false);
export let expandedChapters = $state(new Set());