<script>
	import Modal from './Modal.svelte';
	import SimplifiedRichTextEditor from './SimplifiedRichTextEditor.svelte';
	import DocumentUpload from './DocumentUpload.svelte';
	import MuxVideoUploader from './MuxVideoUploader.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';
	import { Video, Upload, Link, BookOpen, FileText, ArrowLeft, Loader2 } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { normalizeUrl } from '$lib/utils/form-validator.js';

	let {
		supabase,
		isOpen = false,
		sessionId = null,
		courseId = null,
		sessionNumber = 1,
		materialsCount = 0,
		onClose = () => {},
		onMaterialAdded = (material) => {}
	} = $props();

	// Step state: 'select' or 'form'
	let step = $state(/** @type {'select' | 'form'} */ ('select'));
	let selectedType = $state(/** @type {string | null} */ (null));
	let saving = $state(false);

	// Unsaved changes confirmation
	let showUnsavedConfirm = $state(false);

	// Form state
	let title = $state('');
	let url = $state('');
	let content = $state('');
	let description = $state('');
	let coordinatorOnly = $state(false);

	// YouTube preview
	let fetchingVideoInfo = $state(false);
	let videoPreviewId = $state(null);
	let urlDebounceTimer;

	// Material type cards
	const materialTypes = [
		{
			value: 'video',
			label: 'YouTube Video',
			icon: Video,
			description: 'Embed a YouTube video'
		},
		{
			value: 'mux_video',
			label: 'Upload Video',
			icon: Upload,
			description: 'Upload your own video'
		},
		{
			value: 'link',
			label: 'Link',
			icon: Link,
			description: 'Link to external resource'
		},
		{
			value: 'native',
			label: 'Document',
			icon: BookOpen,
			description: 'Create rich text content'
		},
		{
			value: 'upload',
			label: 'Upload File',
			icon: FileText,
			description: 'Upload PDF, Word, etc.'
		}
	];

	// Reset form when modal opens/closes
	$effect(() => {
		if (isOpen) {
			resetForm();
		}
	});

	function resetForm() {
		step = 'select';
		selectedType = null;
		title = '';
		url = '';
		content = '';
		description = '';
		coordinatorOnly = false;
		videoPreviewId = null;
		saving = false;
	}

	function selectType(type) {
		selectedType = type;
		step = 'form';
	}

	function goBack() {
		step = 'select';
		// Keep form data in case user comes back
	}

	// Check if user has entered any data that would be lost
	function hasUnsavedChanges() {
		if (step === 'select') return false;

		// Check if any form fields have content
		if (title.trim()) return true;
		if (url.trim()) return true;
		if (description.trim()) return true;
		if (content.replace(/<[^>]*>/g, '').trim()) return true; // Strip HTML tags for native content

		return false;
	}

	function handleClose() {
		if (saving) return;

		if (hasUnsavedChanges()) {
			showUnsavedConfirm = true;
		} else {
			onClose();
		}
	}

	function confirmClose() {
		showUnsavedConfirm = false;
		onClose();
	}

	function cancelClose() {
		showUnsavedConfirm = false;
	}

	// Extract YouTube video ID from various URL formats
	const getYouTubeVideoId = (urlStr) => {
		if (!urlStr) return null;
		const patterns = [
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([^&\n?#]+)/,
			/youtube\.com\/shorts\/([^&\n?#]+)/
		];
		for (const pattern of patterns) {
			const match = urlStr.match(pattern);
			if (match) return match[1];
		}
		return null;
	};

	// Fetch YouTube video info using oEmbed API
	const fetchYouTubeInfo = async (urlStr) => {
		try {
			const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(urlStr)}&format=json`);
			if (response.ok) {
				const data = await response.json();
				return { title: data.title, author: data.author_name };
			}
		} catch (error) {
			console.error('Error fetching YouTube info:', error);
		}
		return null;
	};

	// Handle URL change for YouTube
	const handleUrlChange = async () => {
		clearTimeout(urlDebounceTimer);

		if (selectedType === 'video' && url) {
			const videoId = getYouTubeVideoId(url);
			if (videoId) {
				videoPreviewId = videoId;

				// Auto-fetch title if empty
				if (!title.trim()) {
					urlDebounceTimer = setTimeout(async () => {
						fetchingVideoInfo = true;
						const info = await fetchYouTubeInfo(url);
						if (info) {
							title = info.title;
						}
						fetchingVideoInfo = false;
					}, 500);
				}
			} else {
				videoPreviewId = null;
			}
		} else {
			videoPreviewId = null;
		}
	};

	// Check if form is valid
	const isFormValid = () => {
		if (!title.trim() && selectedType !== 'mux_video' && selectedType !== 'upload') return false;

		if (selectedType === 'native') {
			const textContent = content.replace(/<[^>]*>/g, '').trim();
			if (!textContent) return false;
		}

		if (selectedType === 'video' || selectedType === 'link') {
			if (!url.trim()) return false;
		}

		return true;
	};

	// Save the material
	async function saveMaterial() {
		if (!isFormValid()) return;

		saving = true;

		try {
			// Normalize URL for video and link types
			const materialContent = selectedType === 'native' ? content : normalizeUrl(url);

			const response = await fetch('/api/courses/module-materials', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionId,
					type: selectedType,
					title: title.trim(),
					content: materialContent,
					description: selectedType === 'link' ? description.trim() : null,
					display_order: materialsCount + 1,
					coordinator_only: coordinatorOnly
				})
			});

			if (response.ok) {
				const { material } = await response.json();

				const newMaterial = {
					id: material.id,
					type: material.type,
					title: material.title,
					url: selectedType === 'native' ? '' : material.content,
					content: selectedType === 'native' ? material.content : '',
					description: material.description || '',
					order: material.display_order,
					coordinatorOnly: material.coordinator_only || false
				};

				onMaterialAdded(newMaterial);
				toastSuccess('Material added successfully');
				onClose();
			} else {
				const errorData = await response.json();
				toastError(`Failed to add material: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error adding material:', error);
			toastError('Failed to add material');
		} finally {
			saving = false;
		}
	}

	// Handle document upload
	async function handleDocumentUpload(uploadResults) {
		for (const uploadResult of uploadResults) {
			const materialTitle = title.trim() || uploadResult.name.replace(/\.[^/.]+$/, '');

			try {
				const response = await fetch('/api/courses/module-materials', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						session_id: sessionId,
						type: 'link',
						title: materialTitle,
						content: uploadResult.url,
						display_order: materialsCount + 1,
						coordinator_only: coordinatorOnly
					})
				});

				if (response.ok) {
					const { material } = await response.json();

					const newMaterial = {
						id: material.id,
						type: 'link',
						title: material.title,
						url: material.content,
						content: '',
						order: material.display_order,
						coordinatorOnly: material.coordinator_only || false
					};

					onMaterialAdded(newMaterial);
				}
			} catch (error) {
				console.error('Error creating material from upload:', error);
			}
		}

		toastSuccess('File(s) uploaded successfully');
		onClose();
	}

	// Handle Mux video upload complete
	async function handleMuxUploadComplete({ uploadId }) {
		const videoTitle = title.trim() || 'Untitled Video';

		try {
			const response = await fetch('/api/courses/module-materials', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionId,
					type: 'mux_video',
					title: videoTitle,
					content: '',
					display_order: materialsCount + 1,
					coordinator_only: coordinatorOnly,
					mux_upload_id: uploadId,
					mux_status: 'processing'
				})
			});

			if (response.ok) {
				const { material } = await response.json();

				const newMaterial = {
					id: material.id,
					type: 'mux_video',
					title: material.title,
					url: '',
					content: '',
					mux_status: 'processing',
					mux_playback_id: null,
					coordinatorOnly: material.coordinator_only || false
				};

				onMaterialAdded(newMaterial);
				toastSuccess('Video uploaded! Processing will complete shortly.');
				onClose();
			} else {
				const errorData = await response.json();
				toastError(`Failed to create material: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error creating mux_video material:', error);
			toastError('Failed to create video material');
		}
	}
</script>

<Modal {isOpen} onClose={handleClose} title={step === 'select' ? 'Add Material' : `Add ${materialTypes.find(t => t.value === selectedType)?.label}`} size="md">
	{#if step === 'select'}
		<!-- Step 1: Type Selection Cards -->
		<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
			{#each materialTypes as type}
				{@const IconComponent = type.icon}
				<button
					onclick={() => selectType(type.value)}
					class="type-card flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-white transition-all"
				>
					<div class="icon-wrapper p-3 rounded-full bg-white shadow-sm">
						<IconComponent size={28} style="color: var(--course-accent-light, #c59a6b);" />
					</div>
					<div class="text-center">
						<p class="font-semibold text-gray-800">{type.label}</p>
						<p class="text-xs text-gray-500 mt-1">{type.description}</p>
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<!-- Step 2: Type-Specific Form -->
		<form onsubmit={(e) => { e.preventDefault(); saveMaterial(); }} class="space-y-4">
			<!-- Back Button -->
			<button
				type="button"
				onclick={goBack}
				class="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 mb-4"
			>
				<ArrowLeft size={16} />
				Back to type selection
			</button>

			<!-- Title Field (not shown for upload types until after upload) -->
			{#if selectedType !== 'upload'}
				<div>
					<label for="material-title" class="block text-sm font-semibold mb-2 text-gray-700">
						Title {selectedType === 'mux_video' ? '(optional)' : '*'}
					</label>
					<input
						id="material-title"
						type="text"
						bind:value={title}
						placeholder={selectedType === 'mux_video' ? 'Defaults to "Untitled Video"' : 'Material title'}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white"
					/>
				</div>
			{/if}

			<!-- Type-Specific Content -->
			{#if selectedType === 'video'}
				<!-- YouTube URL -->
				<div>
					<label for="material-url" class="block text-sm font-semibold mb-2 text-gray-700">
						YouTube URL *
					</label>
					<input
						id="material-url"
						type="url"
						bind:value={url}
						oninput={handleUrlChange}
						placeholder="https://youtube.com/watch?v=..."
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white"
					/>
					{#if fetchingVideoInfo}
						<p class="text-xs text-gray-500 mt-1 flex items-center gap-1">
							<Loader2 size={12} class="animate-spin" />
							Fetching video info...
						</p>
					{/if}
				</div>

				<!-- YouTube Preview -->
				{#if videoPreviewId}
					<div class="rounded-lg overflow-hidden bg-gray-100">
						<div class="aspect-video">
							<iframe
								src="https://www.youtube.com/embed/{videoPreviewId}"
								title="YouTube video preview"
								frameborder="0"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowfullscreen
								class="w-full h-full"
							></iframe>
						</div>
					</div>
				{/if}

			{:else if selectedType === 'mux_video'}
				<!-- Mux Video Upload -->
				<MuxVideoUploader
					{sessionId}
					onUploadStart={({ uploadId }) => {
					}}
					onUploadComplete={handleMuxUploadComplete}
					onError={(error) => {
						toastError(`Upload failed: ${error.message}`);
					}}
				/>
				{#if title.trim()}
					<p class="text-xs text-gray-500">
						Video will be saved as: <span class="font-medium">{title}</span>
					</p>
				{/if}

			{:else if selectedType === 'link'}
				<!-- Link URL -->
				<div>
					<label for="material-url" class="block text-sm font-semibold mb-2 text-gray-700">
						URL *
					</label>
					<input
						id="material-url"
						type="text"
						bind:value={url}
						placeholder="example.com or https://example.com"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white"
					/>
				</div>

				<!-- Description (optional) -->
				<div>
					<label for="material-description" class="block text-sm font-semibold mb-2 text-gray-700">
						Description <span class="font-normal text-gray-500">(optional)</span>
					</label>
					<textarea
						id="material-description"
						bind:value={description}
						placeholder="Brief description of this link..."
						rows="2"
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 bg-white resize-none"
					></textarea>
				</div>

			{:else if selectedType === 'native'}
				<!-- Rich Text Editor -->
				<div>
					<label id="material-content-label" class="block text-sm font-semibold mb-2 text-gray-700">
						Content *
					</label>
					<SimplifiedRichTextEditor
						editorId="material-content"
						labelledBy="material-content-label"
						bind:content={content}
						placeholder="Enter your content..."
					/>
				</div>

			{:else if selectedType === 'upload'}
				<!-- Document Upload -->
				<div>
					<label class="block text-sm font-semibold mb-2 text-gray-700">
						Upload File
					</label>
					<div class="mb-3">
						<label for="upload-title" class="block text-xs text-gray-500 mb-1">
							Title (optional - defaults to filename)
						</label>
						<input
							id="upload-title"
							type="text"
							bind:value={title}
							placeholder="Custom title for uploaded file"
							class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
						/>
					</div>
					<DocumentUpload
						{supabase}
						onUpload={handleDocumentUpload}
						accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.ppt,.pptx"
						multiple={true}
						cohortId={courseId || '1'}
						{sessionNumber}
					/>
				</div>
			{/if}

			<!-- Coordinator Only Checkbox -->
			{#if selectedType !== 'upload' && selectedType !== 'mux_video'}
				<div class="pt-2">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={coordinatorOnly}
							class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
						/>
						<span class="text-sm font-medium text-gray-700">Hub Coordinator Only</span>
						<span class="text-xs text-gray-500">(Only visible to coordinators and admins)</span>
					</label>
				</div>
			{/if}

			<!-- Actions -->
			{#if selectedType !== 'upload' && selectedType !== 'mux_video'}
				<div class="flex justify-end gap-3 pt-4 border-t">
					<button
						type="button"
						onclick={handleClose}
						disabled={saving}
						class="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={saving || !isFormValid()}
						class="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50"
					>
						{#if saving}
							<Loader2 size={18} class="animate-spin" />
							Saving...
						{:else}
							Add Material
						{/if}
					</button>
				</div>
			{/if}
		</form>
	{/if}
</Modal>

<!-- Unsaved Changes Confirmation -->
<ConfirmationModal
	show={showUnsavedConfirm}
	onConfirm={confirmClose}
	onCancel={cancelClose}
>
	<p class="text-gray-800 font-medium">You have unsaved changes</p>
	<p class="text-sm text-gray-600 mt-2">Are you sure you want to close? Your changes will be lost.</p>
</ConfirmationModal>

<style>
	.type-card:hover {
		border-color: var(--course-accent-light, #c59a6b);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	.type-card:hover .icon-wrapper {
		background-color: var(--course-accent-light, #c59a6b);
	}

	.type-card:hover .icon-wrapper :global(svg) {
		color: white !important;
	}

	.btn-primary {
		background-color: var(--course-accent-light, #c59a6b);
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
	}
</style>
