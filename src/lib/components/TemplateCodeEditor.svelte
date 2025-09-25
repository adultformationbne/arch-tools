<script>
  import { Settings, Wand2 } from 'lucide-svelte';
  import CodeMirrorEditor from './CodeMirrorEditor.svelte';
  import { formatHtml } from '$lib/utils/html-formatter.js';

  let {
    html = $bindable(''),
    selectedTemplate = null,
    onFormat = null
  } = $props();

  let editor;
  let isFormatting = $state(false);

  // Format HTML function
  async function handleFormat() {
    if (!html.trim()) return;

    isFormatting = true;
    try {
      const formatted = await formatHtml(html);
      html = formatted;

      if (onFormat) {
        onFormat('HTML formatted successfully');
      }
    } catch (error) {
      console.error('Formatting error:', error);
      if (onFormat) {
        onFormat('Formatting failed: ' + error.message, 'error');
      }
    }
    isFormatting = false;
  }
</script>

<div class="w-[500px] bg-gray-900 flex flex-col min-h-0">
  <div class="bg-gray-800 border-b border-gray-700 px-4 py-3 flex-none">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Settings class="w-4 h-4 text-gray-400" />
        <h4 class="font-medium text-gray-200">HTML Template</h4>
      </div>

      <button
        onclick={handleFormat}
        disabled={isFormatting || !html.trim()}
        class="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {#if isFormatting}
          <div class="animate-spin rounded-full h-3 w-3 border-b border-white"></div>
        {:else}
          <Wand2 class="w-3 h-3" />
        {/if}
        Format
      </button>
    </div>
    <p class="text-xs text-gray-400 mt-1">Use {'{{variable}}'} for text, {'{{{variable}}}'} for HTML</p>
  </div>

  <div class="flex-1 min-h-0">
    <CodeMirrorEditor
      bind:this={editor}
      bind:value={html}
      theme="dark"
      placeholder="Enter your HTML template here..."
    />
  </div>
</div>