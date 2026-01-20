<script>
  import { FileText, Settings, Play, Edit3, Copy, Trash2, Check, Camera, Image } from '$lib/icons';

  let {
    template,
    versions = [],
    showVersions = false,
    generatingThumbnail = false,
    onEdit,
    onActivate,
    onDuplicate,
    onDelete,
    onGenerateThumbnail,
    onToggleVersions
  } = $props();
</script>

<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
  <!-- Template Header -->
  <div class="{template.is_active ? 'bg-green-50' : 'bg-white'}">
    <div class="flex">
      <!-- Thumbnail -->
      <div class="w-32 h-24 flex-shrink-0 bg-gray-100 border-r border-gray-200 relative">
        {#if template.thumbnail_url}
          <img
            src={template.thumbnail_url}
            alt="{template.name} preview"
            class="w-full h-full object-cover"
          />
        {:else}
          <div class="w-full h-full flex items-center justify-center text-gray-400">
            <Image class="w-6 h-6" />
          </div>
        {/if}

        <!-- Active indicator overlay -->
        {#if template.is_active}
          <div class="absolute top-1 left-1">
            <Check class="w-4 h-4 text-green-600 bg-white rounded-full p-0.5" />
          </div>
        {/if}
      </div>

      <!-- Template Info -->
      <div class="flex-1 p-4">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <h3 class="font-medium text-gray-900">{template.name}</h3>
            <span class="text-sm text-gray-500">v{template.version}</span>
            {#if template.is_active}
              <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
            {/if}
          </div>

          <div class="flex items-center gap-1">
            <button
              onclick={onToggleVersions}
              class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              {versions.length} version{versions.length !== 1 ? 's' : ''}
              <Settings class="w-3 h-3" />
            </button>
          </div>
        </div>

        <div class="text-sm text-gray-600 mb-3">
          <span class="font-medium">{template.template_key}</span> •
          Last modified {new Date(template.created_at).toLocaleDateString()}
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-1">
          <button
            onclick={onEdit}
            class="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Edit3 class="w-3 h-3" />
            Edit
          </button>

          {#if !template.is_active}
            <button
              onclick={onActivate}
              class="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              <Play class="w-3 h-3" />
              Activate
            </button>
          {/if}

          <button
            onclick={onGenerateThumbnail}
            disabled={generatingThumbnail}
            class="flex items-center gap-1 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
            title="Generate Thumbnail"
          >
            {#if generatingThumbnail}
              <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            {:else}
              <Camera class="w-3 h-3" />
            {/if}
            Thumbnail
          </button>

          <button
            onclick={onDuplicate}
            class="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Duplicate"
          >
            <Copy class="w-3 h-3" />
          </button>

          <button
            onclick={onDelete}
            class="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Version List (collapsed by default) -->
  {#if showVersions}
    <div class="border-t border-gray-100">
      {#each versions as version, i}
        {#if i > 0}
          <div class="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm text-gray-600">{version.name} v{version.version}</span>
              {#if version.is_active}
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              {/if}
            </div>
            <div class="flex items-center gap-1">
              <button
                onclick={() => onEdit(version)}
                class="p-1 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit"
              >
                <Edit3 class="w-3 h-3" />
              </button>
              {#if !version.is_active}
                <button
                  onclick={() => onActivate(version)}
                  class="p-1 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                  title="Activate"
                >
                  <Play class="w-3 h-3" />
                </button>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>