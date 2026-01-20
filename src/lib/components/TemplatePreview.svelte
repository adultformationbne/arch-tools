<script>
  import { Eye, RefreshCw } from '$lib/icons';

  let {
    previewHtml = '',
    sampleData = {},
    onRefreshData
  } = $props();
</script>

<div class="flex-1 bg-white flex flex-col border-r border-gray-200 min-h-0">
  <div class="bg-gray-50 border-b border-gray-200 px-4 py-3 flex-none">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Eye class="w-4 h-4 text-gray-600" />
        <h4 class="font-medium text-gray-700">Live Preview</h4>
      </div>
      <button
        onclick={onRefreshData}
        class="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
      >
        <RefreshCw class="w-3 h-3" />
        Refresh Data
      </button>
    </div>
    <p class="text-xs text-gray-500 mt-1">
      Using: {sampleData.title !== 'Loading...' ? `"${sampleData.title}" by ${sampleData.authorName}` : 'sample data'}
    </p>
  </div>
  <div class="flex-1 overflow-auto p-6 min-h-0">
    {#if previewHtml}
      <div class="prose prose-lg max-w-none">
        {@html previewHtml}
      </div>
    {:else}
      <div class="flex items-center justify-center h-full text-gray-400">
        <div class="text-center">
          <Eye class="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Preview will appear here</p>
        </div>
      </div>
    {/if}
  </div>
</div>