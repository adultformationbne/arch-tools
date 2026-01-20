<script>
	/**
	 * MuxVideoUploader Component
	 *
	 * Handles video upload to Mux using Direct Upload.
	 * Shows drop zone immediately - no click to initialize.
	 * Falls back gracefully if Mux SDK fails to load.
	 */
	import { onMount } from 'svelte';
	import { Loader2, CheckCircle, AlertCircle, Upload } from '$lib/icons';
	import { toastError } from '$lib/utils/toast-helpers.js';

	let muxLoaded = $state(false);
	let muxLoadError = $state(false);

	onMount(async () => {
		try {
			await import('@mux/mux-uploader');
			muxLoaded = true;
		} catch (err) {
			console.warn('Mux uploader failed to load:', err.message);
			muxLoadError = true;
		}
	});

	let {
		sessionId = null,
		onUploadStart = (data) => {},
		onProgress = (percent) => {},
		onUploadComplete = (data) => {},
		onError = (error) => {},
		disabled = false
	} = $props();

	let uploadUrl = $state(null);
	let uploadId = $state(null);
	let isLoading = $state(true);
	let uploadProgress = $state(0);
	let uploadComplete = $state(false);
	let uploadError = $state(null);
	let uploaderElement = $state(null);

	// Initialize upload URL immediately when sessionId is available
	$effect(() => {
		if (sessionId && !uploadUrl && !uploadComplete) {
			initUpload();
		}
	});

	const initUpload = async () => {
		if (!sessionId) {
			uploadError = 'Session ID is required';
			isLoading = false;
			return;
		}

		isLoading = true;
		uploadError = null;

		try {
			const response = await fetch('/api/courses/mux/upload-url', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ session_id: sessionId })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to get upload URL');
			}

			const data = await response.json();
			uploadUrl = data.uploadUrl;
			uploadId = data.uploadId;
			onUploadStart({ uploadId: data.uploadId });
		} catch (error) {
			uploadError = error.message;
			onError(error);
			toastError(error.message);
		} finally {
			isLoading = false;
		}
	};

	const handleUploadSuccess = (e) => {
		uploadComplete = true;
		uploadProgress = 100;
		onUploadComplete({ uploadId });
	};

	const handleProgress = (e) => {
		// mux-uploader reports progress as a decimal (0-1)
		const percent = Math.round((e.detail || 0) * 100);
		uploadProgress = percent;
		onProgress(percent);
	};

	const handleError = (e) => {
		const errorMessage = e.detail?.message || 'Upload failed';
		uploadError = errorMessage;
		onError(new Error(errorMessage));
		toastError(errorMessage);
	};

	const retryInit = () => {
		uploadError = null;
		initUpload();
	};
</script>

<div class="mux-uploader-container">
	{#if muxLoadError}
		<!-- Fallback when Mux uploader fails to load -->
		<div class="w-full p-8 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50">
			<div class="flex flex-col items-center gap-3">
				<Upload size="32" class="text-amber-500" />
				<span class="font-medium text-amber-700">Video upload unavailable</span>
				<span class="text-sm text-amber-600">Please try refreshing the page or contact support</span>
			</div>
		</div>
	{:else if !muxLoaded}
		<!-- Loading Mux SDK -->
		<div class="w-full p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
			<div class="flex flex-col items-center gap-3">
				<Loader2 size="32" class="animate-spin text-gray-400" />
				<span class="font-medium text-gray-600">Loading uploader...</span>
			</div>
		</div>
	{:else if isLoading}
		<!-- Loading upload URL -->
		<div class="w-full p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
			<div class="flex flex-col items-center gap-3">
				<Loader2 size="32" class="animate-spin text-amber-500" />
				<span class="font-medium text-gray-700">Preparing upload...</span>
			</div>
		</div>
	{:else if uploadComplete}
		<!-- Upload complete -->
		<div class="w-full p-6 border-2 border-green-300 rounded-xl bg-green-50">
			<div class="flex flex-col items-center gap-2">
				<CheckCircle size="28" class="text-green-500" />
				<span class="font-medium text-green-700">Upload complete!</span>
				<span class="text-sm text-green-600">Video is now processing...</span>
			</div>
		</div>
	{:else if uploadError}
		<!-- Error state -->
		<div class="w-full p-6 border-2 border-red-300 rounded-xl bg-red-50">
			<div class="flex flex-col items-center gap-2">
				<AlertCircle size="28" class="text-red-500" />
				<span class="font-medium text-red-700">{uploadError}</span>
				<button
					onclick={retryInit}
					class="mt-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-800 underline"
				>
					Try again
				</button>
			</div>
		</div>
	{:else if uploadUrl}
		<!-- Mux uploader active - ready for drag and drop -->
		<div class="w-full">
			<mux-uploader
				bind:this={uploaderElement}
				endpoint={uploadUrl}
				onsuccess={handleUploadSuccess}
				onprogress={handleProgress}
				onerror={handleError}
				class="w-full"
			></mux-uploader>

			<!-- Progress indicator (only show during active upload) -->
			{#if uploadProgress > 0 && uploadProgress < 100}
				<div class="mt-3">
					<div class="flex justify-between text-sm text-gray-600 mb-1">
						<span>Uploading...</span>
						<span>{uploadProgress}%</span>
					</div>
					<div class="h-2 bg-gray-200 rounded-full overflow-hidden">
						<div
							class="h-full bg-amber-500 transition-all duration-300"
							style="width: {uploadProgress}%"
						></div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Style the Mux uploader web component */
	:global(mux-uploader) {
		--uploader-background: #f9fafb;
		--uploader-border: 2px dashed #d1d5db;
		--uploader-border-radius: 0.75rem;
		--button-background-color: #c59a6b;
		--button-hover-background-color: #b08958;
		--progress-bar-fill-color: #c59a6b;
	}

	:global(mux-uploader::part(drop-zone)) {
		padding: 1.5rem;
	}

	:global(mux-uploader::part(file-select-button)) {
		font-weight: 500;
	}
</style>
