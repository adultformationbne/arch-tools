<script>
	import { onMount } from 'svelte';
	import { Plus, Edit3, Trash2, Save, X, FileText, Video, Link, BookOpen, Upload, FileSpreadsheet, Presentation, Archive, Image, ChevronDown, ChevronRight, Loader2, GripVertical } from '$lib/icons';
	import SimplifiedRichTextEditor from './SimplifiedRichTextEditor.svelte';
	import MuxVideoPlayer from './MuxVideoPlayer.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';
	import AddMaterialModal from './AddMaterialModal.svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { normalizeUrl } from '$lib/utils/form-validator.js';
	import { getDndzone, noopDndzone } from '$lib/utils/resilient-dnd.js';
	import { flip } from 'svelte/animate';

	// Dynamic DnD loading - falls back to static list if unavailable
	let dndzone = $state(noopDndzone);
	let dndAvailable = $state(false);

	onMount(async () => {
		const loadedDnd = await getDndzone();
		if (loadedDnd) {
			dndzone = loadedDnd;
			dndAvailable = true;
		}
	});

	let {
		materials = [],
		onMaterialsChange = () => {},
		allowNativeContent = true,
		allowDocumentUpload = true,
		moduleId = '1',
		sessionNumber = 1,
		sessionId = null,
		courseId = null,
		onSaveStatusChange = () => {}
	} = $props();

	let editingMaterial = $state(null);
	let showDeleteConfirm = $state(false);
	let materialToDelete = $state(null);
	let showAddModal = $state(false);
	let expandedMaterialId = $state(null);

	// Drag-and-drop configuration
	const DND_FLIP_DURATION = 200;
	let draggableItems = $state([]);

	// Sync draggable items when materials prop changes
	$effect(() => {
		draggableItems = materials.map(m => ({ ...m }));
	});

	// Track which material was expanded before drag (to restore after)
	let expandedBeforeDrag = $state(null);

	// Drag-and-drop handlers
	const handleDndConsider = (e) => {
		// Close expanded accordion on drag start for cleaner UX
		if (e.detail.info.trigger === 'dragStarted' && expandedMaterialId) {
			expandedBeforeDrag = expandedMaterialId;
			expandedMaterialId = null;
		}
		draggableItems = e.detail.items;
	};

	const handleDndFinalize = async (e) => {
		draggableItems = e.detail.items;

		// Restore expanded accordion after drop
		if (expandedBeforeDrag) {
			expandedMaterialId = expandedBeforeDrag;
			expandedBeforeDrag = null;
		}

		// Update order numbers
		const reorderedMaterials = draggableItems.map((m, i) => ({
			...m,
			order: i + 1
		}));

		// Update parent immediately for responsiveness
		onMaterialsChange(reorderedMaterials);

		// Persist to database using batch endpoint
		try {
			const materialOrder = reorderedMaterials.map(m => m.id);

			const response = await fetch('/api/courses/module-materials/reorder', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionId,
					material_order: materialOrder
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				toastError(`Failed to save order: ${errorData.message || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('Error updating material order:', error);
			toastError('Failed to save new order');
		}
	};

	// Material types for editing (without embed)
	const materialTypes = [
		{ value: 'video', label: 'YouTube Video', icon: Video },
		{ value: 'mux_video', label: 'Video Upload', icon: Upload },
		{ value: 'link', label: 'Link', icon: Link },
		...(allowNativeContent ? [{ value: 'native', label: 'Document', icon: BookOpen }] : []),
		...(allowDocumentUpload ? [{ value: 'upload', label: 'Upload File', icon: Upload }] : [])
	];

	// Detect file type from URL and return appropriate icon
	const getFileTypeIcon = (url) => {
		if (!url) return Link;
		const urlLower = url.toLowerCase();

		if (urlLower.endsWith('.pdf')) return FileText;
		if (urlLower.match(/\.(doc|docx)$/)) return FileText;
		if (urlLower.match(/\.(xls|xlsx|csv)$/)) return FileSpreadsheet;
		if (urlLower.match(/\.(ppt|pptx)$/)) return Presentation;
		if (urlLower.match(/\.(zip|rar|7z|tar|gz)$/)) return Archive;
		if (urlLower.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp)$/)) return Image;

		return Link;
	};

	const getMaterialIcon = (type, url = '') => {
		if (type === 'video') return Video;
		if (type === 'mux_video') return Video;
		if (type === 'native') return BookOpen;
		if (type === 'embed') return FileText; // Legacy support
		if (type === 'upload') return Upload;
		if (type === 'link') return getFileTypeIcon(url);
		if (type === 'document') return getFileTypeIcon(url);
		return Link;
	};

	// Get type badge - use consistent course styling
	const getTypeBadgeClass = () => {
		return 'type-badge';
	};

	// Get type label
	const getTypeLabel = (type) => {
		switch (type) {
			case 'video': return 'YouTube';
			case 'mux_video': return 'Video';
			case 'native': return 'Document';
			case 'embed': return 'Embed';
			case 'link': return 'Link';
			case 'upload': return 'File';
			default: return 'Link';
		}
	};

	const getFieldId = (prefix, unique) => `${prefix}-${unique ?? 'value'}`;

	// Extract YouTube video ID from various URL formats
	const getYouTubeVideoId = (url) => {
		if (!url) return null;
		const patterns = [
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([^&\n?#]+)/,
			/youtube\.com\/shorts\/([^&\n?#]+)/
		];
		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) return match[1];
		}
		return null;
	};

	const toggleExpanded = (materialId) => {
		expandedMaterialId = expandedMaterialId === materialId ? null : materialId;
	};

	const startEditMaterial = (material) => {
		editingMaterial = { ...material };
		expandedMaterialId = material.id; // Ensure material is expanded to show edit form
	};

	const saveEditMaterial = async () => {
		if (!editingMaterial) return;

		try {
			onSaveStatusChange(true, 'Updating material...');

			// Normalize URLs for video and link types
			const content = (editingMaterial.type === 'native' || editingMaterial.type === 'embed')
				? editingMaterial.content
				: normalizeUrl(editingMaterial.url);

			const response = await fetch('/api/courses/module-materials', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editingMaterial.id,
					type: editingMaterial.type,
					title: editingMaterial.title,
					content: content,
					display_order: editingMaterial.order,
					coordinator_only: editingMaterial.coordinatorOnly
				})
			});

			if (response.ok) {
				const { material } = await response.json();

				const updatedMaterialForUI = {
					id: material.id,
					type: material.type,
					title: material.title,
					url: (material.type === 'native' || material.type === 'embed') ? '' : material.content,
					content: (material.type === 'native' || material.type === 'embed') ? material.content : '',
					description: editingMaterial.description,
					order: material.display_order,
					coordinatorOnly: material.coordinator_only || false,
					mux_status: editingMaterial.mux_status,
					mux_playback_id: editingMaterial.mux_playback_id,
					mux_asset_id: editingMaterial.mux_asset_id
				};

				const updatedMaterials = materials.map(m =>
					m.id === editingMaterial.id ? updatedMaterialForUI : m
				);
				onMaterialsChange(updatedMaterials);
				editingMaterial = null;

				onSaveStatusChange(false, 'Saved');
				setTimeout(() => onSaveStatusChange(false, ''), 1000);
				toastSuccess('Material updated');
			} else {
				const errorData = await response.json();
				toastError(`Failed to update material: ${errorData.error}`);
				onSaveStatusChange(false, 'Save failed');
			}
		} catch (error) {
			console.error('Error updating material:', error);
			toastError('Failed to update material');
			onSaveStatusChange(false, 'Save failed');
		}
	};

	const cancelEditMaterial = () => {
		editingMaterial = null;
	};

	const confirmDelete = (materialId) => {
		materialToDelete = materialId;
		showDeleteConfirm = true;
	};

	const deleteMaterial = async () => {
		const materialId = materialToDelete;
		showDeleteConfirm = false;
		materialToDelete = null;

		if (!materialId) return;

		try {
			onSaveStatusChange(true, 'Deleting material...');

			const response = await fetch('/api/courses/module-materials', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: materialId })
			});

			if (response.ok) {
				const updatedMaterials = materials.filter(m => m.id !== materialId);
				onMaterialsChange(updatedMaterials);
				onSaveStatusChange(false, 'Deleted');
				setTimeout(() => onSaveStatusChange(false, ''), 1000);
			} else {
				const errorData = await response.json();
				toastError(`Failed to delete material: ${errorData.error}`);
				onSaveStatusChange(false, 'Delete failed');
			}
		} catch (error) {
			console.error('Error deleting material:', error);
			toastError('Failed to delete material');
			onSaveStatusChange(false, 'Delete failed');
		}
	};


	// Track which materials are being polled
	let pollingMaterials = $state(new Set());

	// Auto-poll for processing videos
	$effect(() => {
		const processingMaterials = materials.filter(
			m => m.type === 'mux_video' && m.mux_status === 'processing'
		);

		for (const material of processingMaterials) {
			if (!pollingMaterials.has(material.id)) {
				pollingMaterials.add(material.id);
				pollingMaterials = new Set(pollingMaterials);
				pollMuxStatus(material.id);
			}
		}
	});

	const pollMuxStatus = async (materialId) => {
		let attempts = 0;
		const maxAttempts = 60;

		const poll = async () => {
			attempts++;

			try {
				const response = await fetch('/api/courses/mux/sync', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ material_id: materialId })
				});
				if (response.ok) {
					const { material: updated } = await response.json();
					if (updated) {
						const updatedMaterials = materials.map(m => {
							if (m.id === materialId) {
								return {
									...m,
									mux_status: updated.mux_status,
									mux_playback_id: updated.mux_playback_id,
									mux_asset_id: updated.mux_asset_id
								};
							}
							return m;
						});
						onMaterialsChange(updatedMaterials);

						if (updated.mux_status === 'ready') {
							toastSuccess('Video is ready!');
							pollingMaterials.delete(materialId);
							pollingMaterials = new Set(pollingMaterials);
							return;
						} else if (updated.mux_status === 'errored') {
							toastError('Video processing failed');
							pollingMaterials.delete(materialId);
							pollingMaterials = new Set(pollingMaterials);
							return;
						}
					}
				}
			} catch (error) {
				console.error('Failed to poll status:', error);
			}

			if (attempts < maxAttempts) {
				setTimeout(poll, 5000);
			} else {
				pollingMaterials.delete(materialId);
				pollingMaterials = new Set(pollingMaterials);
			}
		};

		poll();
	};

	const handleMaterialAdded = (newMaterial) => {
		onMaterialsChange([...materials, newMaterial]);
	};
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<div class="flex items-center justify-between mb-6">
		<h2 class="text-xl font-bold text-gray-800">Materials</h2>
		<button
			onclick={() => showAddModal = true}
			class="btn-primary flex items-center gap-2 px-4 py-2 font-semibold rounded-lg text-white transition-colors hover:opacity-90"
		>
			<Plus size="18" />
			Add Material
		</button>
	</div>

	<!-- Materials List (Accordion Style with Drag-and-Drop) -->
	<!-- key block forces re-render when DnD loads -->
	{#key dndAvailable}
	<div
		class="space-y-2"
		use:dndzone={{
			items: draggableItems,
			flipDurationMs: DND_FLIP_DURATION,
			dropTargetStyle: { outline: 'none', background: 'rgba(0,0,0,0.02)', borderRadius: '0.5rem' },
			dragDisabled: !dndAvailable
		}}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each draggableItems as material, index (material.id)}
			{@const MaterialIcon = getMaterialIcon(material.type, material.url)}
			{@const isExpanded = expandedMaterialId === material.id}
			{@const isEditing = editingMaterial && editingMaterial.id === material.id}
			{@const isProcessing = material.type === 'mux_video' && material.mux_status === 'processing'}

			<div
				class="material-item border border-gray-200 rounded-lg overflow-hidden transition-shadow hover:shadow-sm bg-white"
				animate:flip={{ duration: DND_FLIP_DURATION }}
			>
				<!-- Material Row (Collapsed) -->
				<div
					class="flex items-center gap-2 p-3 cursor-pointer hover:bg-gray-50 transition-colors group"
					onclick={() => !isEditing && toggleExpanded(material.id)}
					onkeydown={(e) => e.key === 'Enter' && !isEditing && toggleExpanded(material.id)}
					role="button"
					tabindex="0"
				>
					<!-- Drag Handle (only shown when DnD is available) -->
					{#if dndAvailable}
					<div
						class="drag-handle flex-shrink-0 cursor-grab active:cursor-grabbing p-1 text-gray-400 opacity-40 group-hover:opacity-100 hover:text-gray-600 transition-opacity"
						onclick={(e) => e.stopPropagation()}
						title="Drag to reorder"
					>
						<GripVertical size="16" />
					</div>
					{/if}

					<!-- Expand/Collapse Icon -->
					<div class="text-gray-400">
						{#if isExpanded}
							<ChevronDown size="18" />
						{:else}
							<ChevronRight size="18" />
						{/if}
					</div>

					<!-- Material Icon -->
					<div class="flex-shrink-0 material-icon">
						{#if isProcessing}
							<Loader2 size="20" class="animate-spin" style="color: var(--course-accent-light, #c59a6b);" />
						{:else}
							<MaterialIcon size="20" style="color: var(--course-accent-light, #c59a6b);" />
						{/if}
					</div>

					<!-- Title & Type Badge -->
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2">
							<span class="font-medium text-gray-800 truncate">{material.title}</span>
							<span class="px-2 py-0.5 text-xs font-medium rounded-full {getTypeBadgeClass()}">
								{getTypeLabel(material.type)}
							</span>
							{#if material.coordinatorOnly}
								<span class="px-2 py-0.5 text-xs font-medium rounded-full coordinator-badge">
									Coordinator
								</span>
							{/if}
						</div>
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-1" onclick={(e) => e.stopPropagation()}>
						<button
							onclick={() => startEditMaterial(material)}
							class="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
							title="Edit"
						>
							<Edit3 size="16" />
						</button>
						<button
							onclick={() => confirmDelete(material.id)}
							class="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
							title="Delete"
						>
							<Trash2 size="16" />
						</button>
					</div>
				</div>

				<!-- Expanded Content -->
				{#if isExpanded}
					<div class="border-t border-gray-100 bg-gray-50 p-4">
						{#if isEditing}
							<!-- Edit Form -->
							<div class="space-y-4 bg-white p-4 rounded-lg">
								<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<label
											for={getFieldId('edit-material-type', material.id)}
											class="block text-sm font-semibold text-gray-700 mb-1"
										>Type</label>
										<select
											id={getFieldId('edit-material-type', material.id)}
											bind:value={editingMaterial.type}
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
										>
											{#each materialTypes as type}
												<option value={type.value}>{type.label}</option>
											{/each}
										</select>
									</div>
									<div>
										<label
											for={getFieldId('edit-material-title', material.id)}
											class="block text-sm font-semibold text-gray-700 mb-1"
										>Title</label>
										<input
											id={getFieldId('edit-material-title', material.id)}
											bind:value={editingMaterial.title}
											type="text"
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
										/>
									</div>
								</div>

								{#if editingMaterial.type === 'native'}
									<div>
										<label
											id={getFieldId('edit-material-content-label', material.id)}
											class="block text-sm font-semibold text-gray-700 mb-1"
										>Content</label>
										<SimplifiedRichTextEditor
											editorId={getFieldId('edit-material-content', material.id)}
											labelledBy={getFieldId('edit-material-content-label', material.id)}
											bind:content={editingMaterial.content}
											placeholder="Enter your content..."
										/>
									</div>
								{:else if editingMaterial.type !== 'mux_video'}
									<div>
										<label
											for={getFieldId('edit-material-url', material.id)}
											class="block text-sm font-semibold text-gray-700 mb-1"
										>URL</label>
										<input
											id={getFieldId('edit-material-url', material.id)}
											bind:value={editingMaterial.url}
											type="text"
											placeholder="example.com or https://example.com"
											class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
										/>
									</div>
								{/if}

								<div>
									<label class="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											bind:checked={editingMaterial.coordinatorOnly}
											class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
										/>
										<span class="text-sm font-medium text-gray-700">Hub Coordinator Only</span>
									</label>
								</div>

								<div class="flex gap-2 pt-2">
									<button
										onclick={saveEditMaterial}
										class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
									>
										<Save size="16" />
										Save
									</button>
									<button
										onclick={cancelEditMaterial}
										class="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600"
									>
										<X size="16" />
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<!-- Preview Content -->
							{#if material.type === 'video' && material.url}
								{@const videoId = getYouTubeVideoId(material.url)}
								{#if videoId}
									<div class="aspect-video max-w-2xl rounded-lg overflow-hidden bg-black">
										<iframe
											src="https://www.youtube.com/embed/{videoId}"
											title={material.title}
											frameborder="0"
											allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
											allowfullscreen
											class="w-full h-full"
										></iframe>
									</div>
								{/if}
							{:else if material.type === 'mux_video'}
								{#if material.mux_status === 'ready' && material.mux_playback_id}
									<div class="max-w-2xl">
										<MuxVideoPlayer
											playbackId={material.mux_playback_id}
											title={material.title}
											status={material.mux_status}
										/>
									</div>
								{:else if material.mux_status === 'processing'}
									<div class="flex items-center gap-3 text-amber-600">
										<Loader2 size="20" class="animate-spin" />
										<span>Video is processing...</span>
									</div>
								{:else if material.mux_status === 'errored'}
									<div class="text-red-600">Video processing failed</div>
								{/if}
							{:else if material.type === 'native' && material.content}
								<div class="content-preview max-w-none">
									{@html material.content}
								</div>
							{:else if material.type === 'embed' && material.content}
								<div class="aspect-video max-w-2xl rounded-lg overflow-hidden">
									{@html material.content}
								</div>
							{:else if material.url}
								<a
									href={material.url}
									target="_blank"
									rel="noopener noreferrer"
									class="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline"
								>
									<Link size="16" />
									{material.url}
								</a>
							{/if}

							{#if material.description}
								<p class="text-sm text-gray-500 mt-3">{material.description}</p>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/each}

		{#if materials.length === 0}
			<div class="text-center py-12 text-gray-500">
				<FileText size="48" class="mx-auto mb-3 opacity-50" />
				<p class="text-lg font-medium">No materials added yet</p>
				<p class="text-sm mt-1">Click "Add Material" to get started</p>
			</div>
		{/if}
	</div>
	{/key}
</div>

<!-- Add Material Modal -->
<AddMaterialModal
	isOpen={showAddModal}
	{sessionId}
	{courseId}
	{sessionNumber}
	materialsCount={materials.length}
	onClose={() => showAddModal = false}
	onMaterialAdded={handleMaterialAdded}
/>

<!-- Delete Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Delete Material"
	confirmText="Delete"
	cancelText="Cancel"
	onConfirm={deleteMaterial}
	onCancel={() => {
		showDeleteConfirm = false;
		materialToDelete = null;
	}}
>
	<p>Are you sure you want to delete this material? This action cannot be undone.</p>
</ConfirmationModal>

<style>
	.btn-primary {
		background-color: var(--course-accent-light, #c59a6b);
	}

	.type-badge {
		background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 15%, white);
		color: var(--course-accent-dark, #334642);
	}

	.coordinator-badge {
		background-color: color-mix(in srgb, var(--course-accent-dark, #334642) 15%, white);
		color: var(--course-accent-dark, #334642);
	}

	/* Native content preview styling */
	.content-preview :global(h1) {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.75rem;
		margin-top: 1rem;
		color: #111827;
		line-height: 1.3;
	}

	.content-preview :global(h2) {
		font-size: 1.25rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
		margin-top: 1rem;
		color: #374151;
		line-height: 1.3;
	}

	.content-preview :global(h3) {
		font-size: 1.125rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		margin-top: 0.75rem;
		color: #374151;
	}

	.content-preview :global(p) {
		font-size: 0.95rem;
		line-height: 1.6;
		margin-bottom: 0.75rem;
		color: #374151;
	}

	.content-preview :global(ul),
	.content-preview :global(ol) {
		margin-bottom: 0.75rem;
		margin-left: 1.25rem;
		padding: 0;
	}

	.content-preview :global(ul) {
		list-style-type: disc;
	}

	.content-preview :global(ol) {
		list-style-type: decimal;
	}

	.content-preview :global(li) {
		font-size: 0.95rem;
		color: #374151;
		line-height: 1.6;
		margin-bottom: 0.25rem;
	}

	.content-preview :global(strong) {
		font-weight: 600;
		color: var(--course-accent-dark, #334642);
	}

	.content-preview :global(em) {
		font-style: italic;
	}

	.content-preview :global(blockquote) {
		border-left: 3px solid var(--course-accent-dark, #334642);
		padding-left: 0.75rem;
		margin: 0.75rem 0;
		color: #6b7280;
		font-style: italic;
	}

	.content-preview :global(a) {
		color: #2563eb;
		text-decoration: underline;
	}

	.content-preview :global(a:hover) {
		color: #1d4ed8;
	}

	/* Drag-and-drop styles */
	.material-item {
		touch-action: none;
	}

	:global(.material-item[aria-grabbed="true"]) {
		opacity: 0.9;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	:global(.material-item.svelte-dnd-zone-dragged) {
		opacity: 0.4;
	}
</style>
