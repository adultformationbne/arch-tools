<script>
	import RichTextEditor from './RichTextEditor.svelte';
	import { Save, X, Plus, Trash2, Tag, ChevronDown, ChevronUp } from 'lucide-svelte';

	let {
		isOpen = false,
		block = null,
		allTags = [],
		metadataOptions = [],
		onSave = () => {},
		onClose = () => {}
	} = $props();

	// Local state for editing
	let editTag = $state('');
	let editContent = $state('');
	let editMetadata = $state([]);
	let saveStatus = $state('saved');
	let newMetadataTag = $state('');
	let showMetadata = $state(false);

	// Change tracking only
	let hasUnsavedChanges = $state(false);
	let originalTag = $state('');
	let originalContent = $state('');
	let originalMetadata = $state([]);

	// Get tag color class function (copied from parent)
	function getTagColorClass(tag) {
		const colorMap = {
			// Headers
			h1: 'bg-red-100 text-red-700',
			h2: 'bg-orange-100 text-orange-700',
			h3: 'bg-amber-100 text-amber-700',
			chapter: 'bg-indigo-100 text-indigo-700',
			title: 'bg-purple-100 text-purple-700',

			// Content types
			paragraph: 'bg-gray-100 text-gray-700',
			quote: 'bg-blue-100 text-blue-700',
			scripture: 'bg-teal-100 text-teal-700',
			prayer: 'bg-green-100 text-green-700',
			callout: 'bg-sky-100 text-sky-700',

			// Lists
			ul: 'bg-lime-100 text-lime-700',
			ol: 'bg-emerald-100 text-emerald-700',

			// Meta
			author: 'bg-pink-100 text-pink-700',
			date: 'bg-slate-100 text-slate-700',
			note: 'bg-yellow-100 text-yellow-700'
		};

		// Return custom tag style if not in predefined list
		return colorMap[tag] || 'bg-violet-100 text-violet-700';
	}

	// Initialize form when block changes (only when modal opens)
	let lastBlockId = '';

	$effect(() => {
		if (block && isOpen && block.id !== lastBlockId) {
			lastBlockId = block.id;
			editTag = block.tag;
			editContent = block.content;
			editMetadata = [...(block.metadata || [])];

			// Store original values for comparison
			originalTag = block.tag;
			originalContent = block.content;
			originalMetadata = [...(block.metadata || [])];

			// Reset change tracking
			hasUnsavedChanges = false;
			saveStatus = 'saved';

			// Show metadata section if block has metadata
			showMetadata = editMetadata.length > 0;
		}
	});

	// Track changes for unsaved warning
	$effect(() => {
		if (block && isOpen) {
			// Check if anything has changed
			const tagChanged = editTag !== originalTag;
			const contentChanged = editContent !== originalContent;
			const metadataChanged = JSON.stringify(editMetadata) !== JSON.stringify(originalMetadata);

			hasUnsavedChanges = tagChanged || contentChanged || metadataChanged;
		}
	});

	async function handleSave() {
		if (!editContent.trim()) return;

		saveStatus = 'saving';

		try {
			const updatedBlock = {
				...block,
				tag: editTag,
				content: editContent.trim(),
				metadata: [...editMetadata],
				updatedAt: new Date().toISOString()
			};

			await onSave(updatedBlock);
			saveStatus = 'saved';
			hasUnsavedChanges = false;
			handleClose();
		} catch (error) {
			console.error('Error saving block:', error);
			saveStatus = 'error';
			// Don't close on error so user can retry
		}
	}

	function handleClose() {
		// Check for unsaved changes
		if (hasUnsavedChanges) {
			const confirmClose = confirm(
				'You have unsaved changes. Are you sure you want to close without saving?'
			);
			if (!confirmClose) {
				return; // Don't close
			}
		}

		onClose();
		// Reset form
		editTag = '';
		editContent = '';
		editMetadata = [];
		saveStatus = 'saved';
		newMetadataTag = '';
		showMetadata = false;
		lastBlockId = '';
		hasUnsavedChanges = false;
	}

	function addCustomMetadata() {
		if (newMetadataTag.trim() && !editMetadata.includes(newMetadataTag.trim())) {
			editMetadata = [...editMetadata, newMetadataTag.trim()];
			newMetadataTag = '';
		}
	}

	function removeMetadata(meta) {
		editMetadata = editMetadata.filter((m) => m !== meta);
	}

	// Keyboard shortcuts
	function handleKeydown(e) {
		// Ctrl+Enter or Cmd+Enter to save
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			e.preventDefault();
			if (editContent.trim()) {
				handleSave();
			}
		}
		// Escape to close (with unsaved warning)
		else if (e.key === 'Escape') {
			e.preventDefault();
			handleClose();
		}
	}
</script>

{#if isOpen && block}
	<!-- Modal Backdrop -->
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4"
		onclick={handleClose}
	>
		<!-- Modal Content -->
		<div
			class="max-h-[95vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleKeydown}
			tabindex="0"
		>
			<div class="p-6">
				<div class="mb-6 flex items-center justify-between">
					<h3 class="text-2xl font-bold text-gray-800">Edit Block</h3>
					<button
						onclick={handleClose}
						class="text-2xl leading-none text-gray-500 hover:text-gray-700"
					>
						×
					</button>
				</div>

				<!-- Tag Selector -->
				<div class="mb-6">
					<h4 class="mb-3 text-sm font-medium text-gray-700">Block Type</h4>
					<div class="flex flex-wrap gap-2">
						{#each allTags as tag}
							<button
								onclick={() => (editTag = tag)}
								class="rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 {editTag ===
								tag
									? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400'
									: getTagColorClass(tag) + ' hover:opacity-80'}"
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>

				<!-- Metadata Selector (Collapsible) -->
				<div class="mb-6">
					<button
						onclick={() => (showMetadata = !showMetadata)}
						class="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 transition-colors hover:text-gray-900"
					>
						<Tag class="h-4 w-4" />
						Metadata {editMetadata.length > 0 ? `(${editMetadata.length})` : '(Optional)'}
						{#if showMetadata}
							<ChevronUp class="h-4 w-4" />
						{:else}
							<ChevronDown class="h-4 w-4" />
						{/if}
					</button>

					{#if showMetadata}
						<div class="mb-3 grid grid-cols-2 gap-2">
							{#each metadataOptions as option}
								<label class="flex cursor-pointer items-center gap-2 text-sm">
									<input
										type="checkbox"
										value={option}
										bind:group={editMetadata}
										class="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
									/>
									<span class="text-gray-700">{option}</span>
								</label>
							{/each}
						</div>

						<!-- Add custom metadata -->
						<div class="mb-3 flex gap-2">
							<input
								type="text"
								bind:value={newMetadataTag}
								placeholder="Add custom metadata..."
								class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
								onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomMetadata())}
							/>
							<button
								onclick={addCustomMetadata}
								disabled={!newMetadataTag.trim()}
								class="rounded-lg bg-purple-600 px-3 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
								title="Add custom metadata"
							>
								<Plus class="h-4 w-4" />
							</button>
						</div>

						{#if editMetadata.length > 0}
							<div class="flex flex-wrap gap-1">
								{#each editMetadata as meta}
									<span
										class="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700"
									>
										{meta}
										<button
											onclick={() => (editMetadata = editMetadata.filter((m) => m !== meta))}
											class="text-orange-500 hover:text-orange-700"
											title="Remove metadata"
										>
											<Trash2 class="h-3 w-3" />
										</button>
									</span>
								{/each}
							</div>
						{/if}
					{/if}
				</div>

				<!-- Content Editor -->
				<div class="mb-6">
					<h4 class="mb-3 text-sm font-medium text-gray-700">Content</h4>
					<textarea
						bind:value={editContent}
						placeholder="Edit your content here..."
						class="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 leading-relaxed text-gray-800 focus:border-transparent focus:ring-2 focus:ring-purple-500"
						rows="12"
						style="height: auto; min-height: 200px;"
						oninput={(e) => {
							e.target.style.height = 'auto';
							e.target.style.height = Math.max(200, e.target.scrollHeight) + 'px';
						}}
					></textarea>
				</div>

				<!-- Action Buttons -->
				<div class="flex justify-end gap-3">
					<button
						onclick={handleClose}
						class="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300"
						disabled={saveStatus === 'saving'}
					>
						Cancel
					</button>
					<button
						onclick={handleSave}
						disabled={!editContent.trim() || saveStatus === 'saving'}
						class="flex items-center gap-2 px-4 py-2 {hasUnsavedChanges
							? 'bg-orange-600 hover:bg-orange-700'
							: 'bg-purple-600 hover:bg-purple-700'} rounded-lg text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if saveStatus === 'saving'}
							<div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
							Saving...
						{:else if saveStatus === 'error'}
							<X class="h-4 w-4" />
							Retry Save
						{:else if hasUnsavedChanges}
							<Save class="h-4 w-4" />
							Save Changes •
						{:else}
							<Save class="h-4 w-4" />
							Save Changes
						{/if}
					</button>
				</div>

				<!-- Keyboard Shortcuts and Status -->
				<div class="mt-4 text-center text-xs">
					{#if hasUnsavedChanges}
						<p class="mb-2 text-orange-600">⚠️ You have unsaved changes</p>
					{/if}
					<p class="text-gray-500">
						<kbd class="rounded bg-gray-100 px-1 py-0.5">Escape</kbd> to cancel •
						<kbd class="rounded bg-gray-100 px-1 py-0.5">Ctrl+Enter</kbd> to save
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	kbd {
		font-family: monospace;
		font-size: 0.75rem;
	}
</style>
