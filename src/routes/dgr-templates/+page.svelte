<script>
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import Toast from '$lib/components/Toast.svelte';

  let templates = $state([]);
  let selectedTemplate = $state(null);
  let editingHtml = $state('');
  let previewHtml = $state('');
  let showPreview = $state(false);
  let isSaving = $state(false);
  let isLoading = $state(true);
  let templateName = $state('');
  let templateDescription = $state('');
  let toast = $state(null);

  // Sample data for preview
  const sampleData = {
    title: 'Finding Hope in Daily Struggles',
    date: '2025-01-23',
    formattedDate: 'Thursday, 23 January 2025',
    liturgicalDate: '2nd Week in Ordinary Time',
    readings: 'Heb 7:25-8:6; Mark 3:7-12',
    gospelQuote: 'You are the Son of God!',
    reflectionText: `<p>In today's Gospel, we witness the profound recognition of Jesus' divinity by those possessed by unclean spirits. It's striking that while religious authorities questioned and doubted, these tormented souls immediately recognized the Son of God.</p>

    <p>This paradox invites us to reflect on our own spiritual sight. Sometimes we become so comfortable in our faith practices that we fail to recognize Christ's presence in our daily encounters. The marginalized, the suffering, and the broken often have a clearer vision of their need for God.</p>

    <p>Jesus' command for silence reminds us that true faith isn't about proclamation alone, but about transformation. Before we can effectively witness to others, we must allow Christ to heal and transform us from within.</p>`,
    authorName: 'Fr. Michael Johnson',
    gospelFullText: '<p>Jesus departed with his disciples to the sea, and a great multitude from Galilee followed him; hearing all that he was doing, they came to him in great numbers from Judea, Jerusalem, Idumea, beyond the Jordan, and the region around Tyre and Sidon.</p>',
    gospelReference: 'Mark 3:7-12'
  };

  // Simple template variable replacement
  function processTemplate(template, data) {
    let processed = template;

    // Replace Handlebars-style variables
    Object.entries(data).forEach(([key, value]) => {
      // Handle {{variable}} syntax
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, value || '');

      // Handle {{{variable}}} for unescaped HTML
      const regexTriple = new RegExp(`{{{${key}}}}`, 'g');
      processed = processed.replace(regexTriple, value || '');
    });

    // Handle conditionals {{#if variable}}...{{/if}}
    processed = processed.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
      return data[variable] ? content : '';
    });

    return processed;
  }

  // Update preview when HTML changes
  $effect(() => {
    if (editingHtml) {
      previewHtml = processTemplate(editingHtml, sampleData);
    }
  });

  async function loadTemplates() {
    isLoading = true;
    const { data, error } = await supabase
      .from('dgr_templates')
      .select('*')
      .order('template_key', { ascending: true })
      .order('version', { ascending: false });

    if (error) {
      toast = {
        message: 'Error loading templates: ' + error.message,
        type: 'error'
      };
    } else {
      templates = data || [];
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

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="bg-white rounded-lg shadow">
      <div class="border-b border-gray-200 px-6 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-gray-900">DGR Template Editor</h1>
          <div class="flex gap-2">
            <button
              onclick={() => showPreview = !showPreview}
              class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
            <button
              onclick={createNewTemplate}
              class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              New Template
            </button>
          </div>
        </div>
      </div>

      {#if isLoading}
        <div class="p-12 text-center text-gray-500">Loading templates...</div>
      {:else}
        <div class="flex h-[calc(100vh-200px)]">
          <!-- Template List -->
          <div class="w-64 border-r border-gray-200 overflow-y-auto">
            <div class="p-4">
              <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Templates</h3>
              {#each templates as template}
                <button
                  onclick={() => selectTemplate(template)}
                  class="w-full text-left px-3 py-2 rounded mb-1 hover:bg-gray-100 {selectedTemplate?.id === template.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}"
                >
                  <div class="text-sm font-medium">{template.name}</div>
                  <div class="text-xs text-gray-500">
                    {template.template_key} v{template.version}
                    {#if template.is_active}
                      <span class="ml-1 text-green-600 font-semibold">ACTIVE</span>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          </div>

          <!-- Editor Area -->
          <div class="flex-1 flex">
            <div class="{showPreview ? 'w-1/2' : 'w-full'} flex flex-col">
              {#if selectedTemplate}
                <div class="px-6 py-4 border-b border-gray-200">
                  <div class="flex items-center justify-between mb-3">
                    <input
                      type="text"
                      bind:value={templateName}
                      class="text-lg font-semibold bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none"
                      placeholder="Template Name"
                    >
                    <div class="flex gap-2">
                      {#if !selectedTemplate.is_active}
                        <button
                          onclick={activateTemplate}
                          class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Activate
                        </button>
                      {/if}
                      <button
                        onclick={saveAsNewVersion}
                        disabled={isSaving}
                        class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save New Version'}
                      </button>
                    </div>
                  </div>
                  <div class="text-sm text-gray-600">
                    Available variables:
                    <code class="text-xs bg-gray-100 px-1 rounded">
                      {selectedTemplate.variables?.join(', ')}
                    </code>
                  </div>
                </div>

                <div class="flex-1 p-4">
                  <textarea
                    bind:value={editingHtml}
                    class="w-full h-full font-mono text-sm p-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    spellcheck="false"
                    placeholder="Enter your HTML template here..."
                  ></textarea>
                </div>
              {:else}
                <div class="flex-1 flex items-center justify-center text-gray-500">
                  Select a template to edit
                </div>
              {/if}
            </div>

            <!-- Preview Panel -->
            {#if showPreview}
              <div class="w-1/2 border-l border-gray-200 flex flex-col">
                <div class="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <h3 class="font-semibold text-gray-700">Preview</h3>
                  <p class="text-sm text-gray-500">Using sample data</p>
                </div>
                <div class="flex-1 overflow-auto p-4 bg-white">
                  <div class="prose max-w-none">
                    {@html previewHtml}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if toast}
  <Toast bind:toast />
{/if}

<style>
  textarea {
    resize: none;
    tab-size: 2;
  }
</style>