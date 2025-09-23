<script>
  import { onMount } from 'svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { renderTemplate } from '$lib/utils/dgr-template-renderer.js';

  let { data } = $props();
  const { supabase } = data;

  let templates = $state([]);
  let selectedTemplate = $state(null);
  let selectedTemplateId = $state('');
  let editingHtml = $state('');
  let previewHtml = $state('');
  let isSaving = $state(false);
  let isLoading = $state(true);
  let templateName = $state('');
  let templateDescription = $state('');
  let toast = $state(null);

  // Real DGR data for preview
  let sampleData = $state({
    title: 'Loading...',
    date: new Date().toISOString().split('T')[0],
    formattedDate: 'Loading...',
    liturgicalDate: 'Loading...',
    readings: 'Loading...',
    gospelQuote: 'Loading...',
    reflectionText: '<p>Loading latest published reflection...</p>',
    authorName: 'Loading...',
    gospelFullText: '<p>Loading...</p>',
    gospelReference: 'Loading...'
  });


  // Use the same renderer as the API
  function processTemplate(template, data) {
    return renderTemplate(template, data);
  }

  // Update preview when HTML changes
  $effect(() => {
    if (editingHtml) {
      previewHtml = processTemplate(editingHtml, sampleData);
    }
  });

  async function loadLatestDGRData() {
    try {
      const { data, error } = await supabase
        .from('dgr_schedule')
        .select(`
          date,
          gospel_reference,
          gospel_text,
          reflection_title,
          reflection_content,
          liturgical_date,
          dgr_contributors(name)
        `)
        .eq('status', 'published')
        .not('reflection_content', 'is', null)
        .not('reflection_title', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        const dateObj = new Date(data.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        // Extract a good gospel quote (first sentence or meaningful snippet)
        const gospelQuote = extractGospelQuote(data.reflection_content);

        sampleData = {
          title: data.reflection_title,
          date: data.date,
          formattedDate: formattedDate,
          liturgicalDate: data.liturgical_date || `Date: ${formattedDate}`,
          readings: data.gospel_reference || 'Gospel Reading',
          gospelQuote: gospelQuote,
          reflectionText: formatReflectionText(data.reflection_content),
          authorName: data.dgr_contributors?.name || 'Anonymous',
          gospelFullText: data.gospel_text || '',
          gospelReference: data.gospel_reference || ''
        };
      }
    } catch (err) {
      console.warn('Could not load latest DGR data:', err);
    }
  }

  function extractGospelQuote(reflectionText) {
    // Try to find a meaningful quote from the reflection
    const sentences = reflectionText.split(/[.!?]+/).filter(s => s.trim().length > 20);

    // Look for sentences with quotes or meaningful content
    const meaningfulSentence = sentences.find(s =>
      s.includes('"') ||
      s.includes('Jesus') ||
      s.includes('God') ||
      s.includes('Gospel') ||
      s.length > 50
    );

    if (meaningfulSentence) {
      return meaningfulSentence.trim().substring(0, 120) + (meaningfulSentence.length > 120 ? '...' : '');
    }

    // Fallback to first meaningful sentence
    return sentences[0]?.trim().substring(0, 120) + '...' || 'Reflect on today\'s Gospel reading.';
  }

  function formatReflectionText(text) {
    if (!text) return '';

    return text
      .split('\n\n')
      .filter(p => p.trim())
      .map(paragraph => {
        const content = paragraph.trim().replace(/\n/g, '<br>');
        return content ? `<p style="margin:0 0 18px 0;">${content}</p>` : '';
      })
      .filter(p => p)
      .join('');
  }

  async function loadTemplates() {
    isLoading = true;

    // Load both templates and real DGR data in parallel
    const [templatesResult, _] = await Promise.all([
      supabase
        .from('dgr_templates')
        .select('*')
        .order('template_key', { ascending: true })
        .order('version', { ascending: false }),
      loadLatestDGRData()
    ]);

    if (templatesResult.error) {
      toast = {
        message: 'Error loading templates: ' + templatesResult.error.message,
        type: 'error'
      };
    } else {
      templates = templatesResult.data || [];
      // Auto-select the first active template
      const activeTemplate = templates.find(t => t.is_active);
      if (activeTemplate) {
        selectTemplate(activeTemplate);
      }
    }
    isLoading = false;
  }

  function selectTemplate(template) {
    selectedTemplate = template;
    selectedTemplateId = template.id;
    editingHtml = template.html;
    templateName = template.name;
    templateDescription = template.description || '';
  }

  async function saveAsNewVersion() {
    if (!selectedTemplate) return;

    isSaving = true;

    // Get the next version number
    const { data: versionData, error: versionError } = await supabase
      .rpc('get_next_template_version', {
        p_template_key: selectedTemplate.template_key
      });

    if (versionError) {
      toast = {
        message: 'Error getting version: ' + versionError.message,
        type: 'error'
      };
      isSaving = false;
      return;
    }

    // Create new version
    const { data, error } = await supabase
      .from('dgr_templates')
      .insert({
        template_key: selectedTemplate.template_key,
        version: versionData,
        name: templateName,
        description: templateDescription,
        html: editingHtml,
        variables: selectedTemplate.variables,
        config: selectedTemplate.config,
        is_active: false
      })
      .select()
      .single();

    if (error) {
      toast = {
        message: 'Error saving template: ' + error.message,
        type: 'error'
      };
    } else {
      toast = {
        message: `Saved as version ${versionData}`,
        type: 'success'
      };
      await loadTemplates();
      selectTemplate(data);
    }

    isSaving = false;
  }

  async function activateTemplate() {
    if (!selectedTemplate) return;

    const { error } = await supabase
      .rpc('activate_template_version', { p_id: selectedTemplate.id });

    if (error) {
      toast = {
        message: 'Error activating template: ' + error.message,
        type: 'error'
      };
    } else {
      toast = {
        message: 'Template activated successfully',
        type: 'success'
      };
      await loadTemplates();
    }
  }

  async function createNewTemplate() {
    const newKey = prompt('Enter a unique key for the new template (e.g., "minimal", "hero"):');
    if (!newKey) return;

    const { data, error } = await supabase
      .from('dgr_templates')
      .insert({
        template_key: newKey.toLowerCase().replace(/\s+/g, '-'),
        version: 1,
        name: `New ${newKey} Template`,
        description: 'A new DGR template',
        html: '<div style="padding: 20px;">\n  <h1>{{title}}</h1>\n  <p>Date: {{formattedDate}}</p>\n  <div>{{{reflectionText}}}</div>\n  <p>By {{authorName}}</p>\n</div>',
        is_active: false
      })
      .select()
      .single();

    if (error) {
      toast = {
        message: 'Error creating template: ' + error.message,
        type: 'error'
      };
    } else {
      toast = {
        message: 'Template created successfully',
        type: 'success'
      };
      await loadTemplates();
      selectTemplate(data);
    }
  }

  onMount(() => {
    loadTemplates();
  });
</script>

<!-- Full Screen Layout -->
<div class="h-screen flex flex-col bg-gray-900">
  <!-- Top Bar -->
  <div class="bg-white border-b border-gray-200 px-6 py-4 flex-none">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold text-gray-900">DGR Template Editor</h1>

        <!-- Template Selector -->
        {#if templates.length > 0}
          <select
            bind:value={selectedTemplateId}
            onchange={() => {
              const template = templates.find(t => t.id === selectedTemplateId);
              if (template) selectTemplate(template);
            }}
            class="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select template...</option>
            {#each templates as template}
              <option value={template.id}>
                {template.name} v{template.version} {template.is_active ? '(ACTIVE)' : ''}
              </option>
            {/each}
          </select>
        {/if}

        <!-- Template Info -->
        {#if selectedTemplate}
          <div class="text-sm text-gray-600">
            {selectedTemplate.template_key} v{selectedTemplate.version}
            {#if selectedTemplate.is_active}
              <span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                ACTIVE
              </span>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        {#if selectedTemplate}
          <input
            type="text"
            bind:value={templateName}
            class="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Template Name"
          >

          {#if !selectedTemplate.is_active}
            <button
              onclick={activateTemplate}
              class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Activate
            </button>
          {/if}

          <button
            onclick={saveAsNewVersion}
            disabled={isSaving}
            class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Version'}
          </button>
        {/if}

        <button
          onclick={createNewTemplate}
          class="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
        >
          New Template
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

  {#if isLoading}
    <div class="flex-1 flex items-center justify-center text-gray-400">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        Loading templates...
      </div>
    </div>
  {:else}
    <!-- Main Content Area -->
    <div class="flex-1 flex min-h-0">
      <!-- Preview Area (Left Side) -->
      <div class="flex-1 bg-white flex flex-col">
        <div class="bg-gray-50 border-b border-gray-200 px-4 py-2 flex-none">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-700">Live Preview</h3>
              <p class="text-xs text-gray-500">
                Updates as you type • Using: {sampleData.title !== 'Loading...' ? `"${sampleData.title}" by ${sampleData.authorName}` : 'sample data'}
              </p>
            </div>
            <button
              onclick={loadLatestDGRData}
              class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-auto p-6">
          {#if previewHtml}
            <div class="prose prose-lg max-w-none">
              {@html previewHtml}
            </div>
          {:else}
            <div class="flex items-center justify-center h-full text-gray-400">
              <div class="text-center">
                <div class="text-4xl mb-4">📄</div>
                <p>Select a template to see preview</p>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Code Editor (Right Sidebar) -->
      <div class="w-[600px] bg-gray-900 flex flex-col border-l border-gray-700">
        <div class="bg-gray-800 border-b border-gray-700 px-4 py-2 flex-none">
          <h3 class="font-medium text-gray-200">HTML Template</h3>
          <p class="text-xs text-gray-400">Use {'{{variable}}'} for text, {'{{{variable}}}'} for HTML</p>
        </div>

        {#if selectedTemplate}
          <div class="flex-1 flex flex-col min-h-0">
            <textarea
              bind:value={editingHtml}
              class="flex-1 bg-gray-900 text-gray-100 font-mono text-sm p-4 resize-none focus:outline-none border-none"
              style="tab-size: 2;"
              spellcheck="false"
              placeholder="Select a template or create a new one..."
            ></textarea>
          </div>
        {:else}
          <div class="flex-1 flex items-center justify-center text-gray-500">
            <div class="text-center">
              <div class="text-3xl mb-4">⚡</div>
              <p>Select a template to start editing</p>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if toast}
  <Toast bind:toast />
{/if}

