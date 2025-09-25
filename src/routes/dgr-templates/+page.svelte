<script>
  import { onMount } from 'svelte';
  import { toast } from '$lib/stores/toast.svelte.js';
  import ToastContainer from '$lib/components/ToastContainer.svelte';
  import TemplateCard from '$lib/components/TemplateCard.svelte';
  import TemplateEditor from '$lib/components/TemplateEditor.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import { FileText, Plus, Camera, Trash2 } from 'lucide-svelte';
  import { renderTemplate } from '$lib/utils/dgr-template-renderer.js';
  import { TemplateManager, groupTemplatesByKey } from '$lib/utils/template-actions.js';
  import { generateMissingThumbnails } from '$lib/utils/thumbnail-generator.js';
  import { formatHtml } from '$lib/utils/html-formatter.js';

  let { data } = $props();
  const { supabase } = data;

  // Initialize template manager
  const templateManager = new TemplateManager(supabase);

  // State
  let templates = $state([]);
  let selectedTemplate = $state(null);
  let editingHtml = $state('');
  let previewHtml = $state('');
  let templateName = $state('');
  let templateDescription = $state('');
  let isLoading = $state(true);
  let isSaving = $state(false);
  let editingMode = $state(false);
  let showVersions = $state({});
  let generatingThumbnail = $state({});
  let deleteConfirmModal = $state({ open: false, template: null });

  // Sample data for preview
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
    gospelReference: 'Loading...',
    promoTiles: [] // Add promo tiles array
  });

  // Debounced preview update
  let previewTimeout;
  $effect(() => {
    console.log('Preview effect triggered, editingHtml length:', editingHtml?.length);
    console.log('Current editingHtml preview:', editingHtml?.substring(0, 150));

    if (editingHtml) {
      // Clear previous timeout
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }

      // Debounce the preview update by 100ms (faster for better UX)
      previewTimeout = setTimeout(() => {
        try {
          console.log('About to render with this HTML:', editingHtml.substring(0, 200));
          const newPreview = renderTemplate(editingHtml, sampleData);
          previewHtml = newPreview;
          console.log('Preview updated successfully, new preview length:', newPreview.length);
        } catch (error) {
          console.warn('Preview render error:', error);
          previewHtml = '<p class="text-red-500">Template rendering error: ' + error.message + '</p>';
        }
      }, 100);
    }
  });

  // Load templates and sample data
  async function loadTemplates() {
    isLoading = true;
    try {
      const [templatesResult, _] = await Promise.all([
        templateManager.loadTemplates(),
        loadLatestDGRData()
      ]);

      templates = templatesResult;

      // Auto-select the first active template if not in editing mode
      if (!editingMode) {
        const activeTemplate = templates.find(t => t.is_active);
        if (activeTemplate && !selectedTemplate) {
          selectTemplate(activeTemplate);
        }
      }
    } catch (error) {
      toast.error({ title: 'Error', message: 'Error loading templates: ' + error.message });
    }
    isLoading = false;
  }

  // Load latest DGR data for preview
  async function loadLatestDGRData() {
    try {
      // Fetch latest DGR data
      const { data: scheduleData, error } = await supabase
        .from('dgr_schedule')
        .select(`
          date, gospel_reference, gospel_text, reflection_title,
          reflection_content, liturgical_date, contributor_id
        `)
        .in('status', ['published', 'approved'])
        .not('reflection_content', 'is', null)
        .not('reflection_title', 'is', null)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      // Fetch active promo tiles
      const { data: promoTilesData } = await supabase
        .from('dgr_promo_tiles')
        .select('*')
        .eq('active', true)
        .order('position', { ascending: true });

      console.log('Loaded promo tiles:', promoTilesData);

      if (scheduleData && !error) {
        let contributorName = 'Anonymous';
        if (scheduleData.contributor_id) {
          const { data: contributorData } = await supabase
            .from('dgr_contributors')
            .select('name')
            .eq('id', scheduleData.contributor_id)
            .single();

          if (contributorData) contributorName = contributorData.name;
        }

        const dateObj = new Date(scheduleData.date);
        const formattedDate = dateObj.toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        sampleData = {
          title: scheduleData.reflection_title,
          date: scheduleData.date,
          formattedDate: formattedDate,
          liturgicalDate: scheduleData.liturgical_date || `Date: ${formattedDate}`,
          readings: scheduleData.gospel_reference || 'Gospel Reading',
          gospelQuote: extractGospelQuote(scheduleData.reflection_content),
          reflectionText: formatReflectionText(scheduleData.reflection_content),
          authorName: contributorName,
          gospelFullText: scheduleData.gospel_text || '',
          gospelReference: scheduleData.gospel_reference || '',
          promoTiles: promoTilesData || []
        };
      }
    } catch (err) {
      console.warn('Could not load latest DGR data:', err);
    }
  }

  // Helper functions
  function extractGospelQuote(reflectionText) {
    const sentences = reflectionText.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const meaningfulSentence = sentences.find(s =>
      s.includes('"') || s.includes('Jesus') || s.includes('God') ||
      s.includes('Gospel') || s.length > 50
    );

    if (meaningfulSentence) {
      return meaningfulSentence.trim().substring(0, 120) +
        (meaningfulSentence.length > 120 ? '...' : '');
    }

    return sentences[0]?.trim().substring(0, 120) + '...' ||
      'Reflect on today\'s Gospel reading.';
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

  function selectTemplate(template, preserveEditing = false) {
    selectedTemplate = template;
    if (!preserveEditing) {
      editingHtml = template.html;
    }
    templateName = template.name;
    templateDescription = template.description || '';
  }


  // Template actions
  function enterEditMode(template) {
    selectTemplate(template);
    editingMode = true;
  }

  function exitEditMode() {
    editingMode = false;
    selectedTemplate = null;
    editingHtml = '';
    templateName = '';
    templateDescription = '';
  }

  async function handleActivateTemplate(template) {
    try {
      await templateManager.activateTemplate(template);
      toast.success({ title: 'Success', message: 'Template activated successfully', duration: 3000 });
      await loadTemplates();
    } catch (error) {
      toast.error({ title: 'Error', message: error.message });
    }
  }

  async function handleSaveTemplate() {
    if (!selectedTemplate) return;

    console.log('Saving template with HTML length:', editingHtml?.length);
    console.log('HTML preview:', editingHtml?.substring(0, 200));

    isSaving = true;
    try {
      // Auto-format HTML before saving
      let htmlToSave = editingHtml;
      try {
        htmlToSave = await formatHtml(editingHtml);
        editingHtml = htmlToSave; // Update the editor with formatted HTML
        toast.success({ title: 'Formatted', message: 'HTML formatted and saved', duration: 3000 });
      } catch (formatError) {
        console.warn('Auto-formatting failed, saving unformatted:', formatError);
      }

      const result = await templateManager.saveAsNewVersion({
        selectedTemplate,
        templateName,
        templateDescription,
        editingHtml: htmlToSave
      });

      console.log('Template saved successfully:', result);
      if (htmlToSave === editingHtml) {
        toast.success({ title: 'Saved', message: `Saved as version ${result.version}`, duration: 3000 });
      } else {
        toast.success({ title: 'Saved', message: `Saved as version ${result.version} (formatted)`, duration: 3000 });
      }

      // Auto-generate thumbnail from preview
      await templateManager.generateThumbnailFromPreview(result.template);

      await loadTemplates();
      selectTemplate(result.template, true); // Preserve current editing content
    } catch (error) {
      console.error('Save error:', error);
      toast.error({ title: 'Error', message: error.message });
    }
    isSaving = false;
  }

  async function handleCreateTemplate() {
    const newKey = prompt('Enter a unique key for the new template (e.g., "minimal", "hero"):');
    if (!newKey) return;

    try {
      const template = await templateManager.createTemplate(newKey);
      toast.success({ title: 'Created', message: 'Template created successfully', duration: 3000 });
      await loadTemplates();
      enterEditMode(template);
    } catch (error) {
      toast.error({ title: 'Error', message: error.message });
    }
  }

  async function handleDuplicateTemplate(template) {
    try {
      await templateManager.duplicateTemplate(template);
      toast.success({ title: 'Duplicated', message: 'Template duplicated successfully', duration: 3000 });
      await loadTemplates();
    } catch (error) {
      toast.error({ title: 'Error', message: error.message });
    }
  }

  function openDeleteConfirm(template) {
    deleteConfirmModal = { open: true, template };
  }

  function closeDeleteConfirm() {
    deleteConfirmModal = { open: false, template: null };
  }

  async function confirmDeleteTemplate() {
    const template = deleteConfirmModal.template;
    if (!template) return;

    closeDeleteConfirm();

    try {
      await templateManager.deleteTemplate(template);
      toast.success({ title: 'Deleted', message: 'Template deleted successfully', duration: 3000 });
      if (selectedTemplate?.id === template.id) {
        exitEditMode();
      }
      await loadTemplates();
    } catch (error) {
      toast.error({ title: 'Error', message: error.message });
    }
  }

  async function handleGenerateThumbnail(template) {
    generatingThumbnail[template.id] = true;

    try {
      const previewCaptured = await templateManager.generateThumbnailFromPreview(template);

      if (!previewCaptured) {
        const result = await templateManager.generateThumbnail(template);
        if (!result) throw new Error('Failed to generate thumbnail');
      }

      toast.success({ title: 'Generated', message: 'Thumbnail generated successfully', duration: 3000 });
      await loadTemplates();
    } catch (error) {
      toast.error({ title: 'Error', message: error.message });
    }

    generatingThumbnail[template.id] = false;
  }

  async function handleGenerateAllThumbnails() {
    try {
      const results = await generateMissingThumbnails(supabase, templates);
      const successCount = results.filter(r => r.success).length;
      if (successCount === results.length) {
        toast.success({ title: 'Complete', message: `Generated ${successCount} thumbnails`, duration: 3000 });
      } else {
        toast.warning({ title: 'Partial Success', message: `Generated ${successCount} of ${results.length} thumbnails`, duration: 4000 });
      }
      await loadTemplates();
    } catch (error) {
      toast.error({ title: 'Error', message: 'Error generating thumbnails: ' + error.message });
    }
  }

  function toggleVersions(templateKey) {
    showVersions[templateKey] = !showVersions[templateKey];
  }

  // Initialize
  onMount(() => {
    loadTemplates();
  });

  // Computed values
  let groupedTemplates = $state({});

  // Update grouped templates when templates change
  $effect(() => {
    if (templates.length > 0) {
      // Convert Svelte 5 proxy to regular array and group templates
      const templatesArray = Array.from(templates);
      groupedTemplates = groupTemplatesByKey(templatesArray);
    } else {
      groupedTemplates = {};
    }
  });
</script>

<!-- Template Editor Layout -->
<div class="bg-gray-50">
  <!-- Header -->
  <div class="bg-white border-b border-gray-200 px-6 py-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <FileText class="w-6 h-6 text-blue-600" />
        <h1 class="text-xl font-semibold text-gray-900">DGR Template Editor</h1>
      </div>

      {#if editingMode}
        <button
          onclick={exitEditMode}
          class="px-4 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          ← Back to Templates
        </button>
      {/if}
    </div>
  </div>

  {#if isLoading}
    <div class="h-96 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p class="text-gray-600">Loading templates...</p>
      </div>
    </div>
  {:else if !editingMode}
    <!-- Template Management View -->
    <div class="p-6">
      <div class="max-w-6xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Your Templates</h2>
            <p class="text-sm text-gray-600 mt-1">Only one template can be active at a time - this is what the publish API uses</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              onclick={handleGenerateAllThumbnails}
              class="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Camera class="w-4 h-4" />
              Generate All Thumbnails
            </button>
            <button
              onclick={handleCreateTemplate}
              class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus class="w-4 h-4" />
              New Template
            </button>
          </div>
        </div>

        <div class="space-y-4">
          {#each Object.entries(groupedTemplates) as [templateKey, templateVersions]}
            {@const latestTemplate = templateVersions[0]}
            <TemplateCard
              template={latestTemplate}
              versions={templateVersions}
              showVersions={showVersions[templateKey]}
              generatingThumbnail={generatingThumbnail[latestTemplate.id]}
              onEdit={() => enterEditMode(latestTemplate)}
              onActivate={() => handleActivateTemplate(latestTemplate)}
              onDuplicate={() => handleDuplicateTemplate(latestTemplate)}
              onDelete={() => openDeleteConfirm(latestTemplate)}
              onGenerateThumbnail={() => handleGenerateThumbnail(latestTemplate)}
              onToggleVersions={() => toggleVersions(templateKey)}
            />
          {/each}
        </div>
      </div>
    </div>
  {:else}
    <!-- Template Editor View -->
    <div class="bg-gray-50 min-h-[calc(100vh-5rem)]">
      <TemplateEditor
        {selectedTemplate}
        bind:templateName
        bind:editingHtml
        {previewHtml}
        {sampleData}
        {isSaving}
        onBack={exitEditMode}
        onActivate={() => handleActivateTemplate(selectedTemplate)}
        onSave={handleSaveTemplate}
        onRefreshData={loadLatestDGRData}
      />
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<Modal
  isOpen={deleteConfirmModal.open}
  title="Delete Template"
  onClose={closeDeleteConfirm}
  size="sm"
>
  {#if deleteConfirmModal.template}
    <div class="flex items-start gap-4">
      <div class="flex-shrink-0">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
          <Trash2 class="h-5 w-5 text-red-600" />
        </div>
      </div>
      <div class="flex-1">
        <p class="text-sm text-gray-500">
          Are you sure you want to delete <strong>"{deleteConfirmModal.template.name}"</strong>?
        </p>
        <p class="mt-2 text-sm text-gray-400">
          This action cannot be undone.
        </p>
      </div>
    </div>
  {/if}

  {#snippet footer()}
    <div class="flex gap-3">
      <button
        onclick={closeDeleteConfirm}
        class="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        onclick={confirmDeleteTemplate}
        class="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
      >
        Delete
      </button>
    </div>
  {/snippet}
</Modal>

<ToastContainer />