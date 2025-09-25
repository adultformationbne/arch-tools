<script>
  import { Edit3, Play, FileText } from 'lucide-svelte';
  import TemplatePreview from './TemplatePreview.svelte';
  import TemplateCodeEditor from './TemplateCodeEditor.svelte';

  let {
    selectedTemplate = null,
    templateName = $bindable(''),
    editingHtml = $bindable(''),
    previewHtml = '',
    sampleData = {},
    isSaving = false,
    onBack,
    onActivate,
    onSave,
    onRefreshData
  } = $props();
</script>

<div class="flex-1 flex flex-col">
  <!-- Editor Header -->
  <div class="bg-white border-b border-gray-200 px-6 py-3 flex-none">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Edit3 class="w-5 h-5 text-blue-600" />
        <div>
          <h3 class="font-medium text-gray-900">Editing: {selectedTemplate?.name}</h3>
          <p class="text-xs text-gray-500">{selectedTemplate?.template_key} v{selectedTemplate?.version}</p>
        </div>
        {#if selectedTemplate?.is_active}
          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-3">
        <button
          onclick={onBack}
          class="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          ← Back to Templates
        </button>

        <input
          type="text"
          bind:value={templateName}
          class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Template Name"
        >

        {#if !selectedTemplate?.is_active}
          <button
            onclick={onActivate}
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Play class="w-4 h-4" />
            Activate
          </button>
        {/if}

        <button
          onclick={onSave}
          disabled={isSaving}
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {#if isSaving}
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          {:else}
            <FileText class="w-4 h-4" />
          {/if}
          {isSaving ? 'Saving...' : 'Save as v' + (selectedTemplate ? selectedTemplate.version + 1 : 1)}
        </button>
      </div>
    </div>

    <!-- Variables Helper -->
    {#if selectedTemplate?.variables}
      <div class="mt-3 text-xs text-gray-500">
        <strong>Available variables:</strong>
        {selectedTemplate.variables.map(v => `{{${v}}}`).join(', ')}
      </div>
    {/if}
  </div>

  <!-- Editor Content -->
  <div class="flex-1 flex min-h-0 overflow-hidden">
    <TemplatePreview
      {previewHtml}
      {sampleData}
      {onRefreshData}
    />

    <TemplateCodeEditor
      bind:html={editingHtml}
      {selectedTemplate}
      onFormat={(message, type = 'success') => {
        // This could trigger a toast notification if needed
        console.log('Format result:', message, type);
      }}
    />
  </div>
</div>