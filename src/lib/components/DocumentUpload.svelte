<script>
	import { Upload, File, X, Check, AlertCircle } from 'lucide-svelte';
	import { uploadMaterial } from '$lib/utils/storage.js';

	let {
		onUpload = () => {},
		accept = '.pdf,.doc,.docx,.txt,.md',
		maxSize = 10 * 1024 * 1024, // 10MB
		multiple = false,
		class: className = '',
		cohortId = '1',
		weekNumber = 1
	} = $props();

	let fileInput = $state(null);
	let isDragOver = $state(false);
	let uploadStatus = $state('idle'); // idle, uploading, success, error
	let uploadProgress = $state(0);
	let errorMessage = $state('');
	let uploadedFiles = $state([]);

	const validateFile = (file) => {
		// Check file size
		if (file.size > maxSize) {
			throw new Error(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
		}

		// Check file type
		const allowedTypes = accept.split(',').map(type => type.trim());
		const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

		if (!allowedTypes.includes(fileExtension)) {
			throw new Error(`File type not allowed. Accepted types: ${accept}`);
		}

		return true;
	};

	const handleFileSelect = async (files) => {
		try {
			uploadStatus = 'uploading';
			errorMessage = '';
			uploadProgress = 0;

			const fileArray = Array.from(files);

			for (const file of fileArray) {
				validateFile(file);
			}

			const results = [];

			// Upload files one by one
			for (let i = 0; i < fileArray.length; i++) {
				const file = fileArray[i];
				uploadProgress = (i / fileArray.length) * 80; // Reserve 20% for completion

				const uploadResult = await uploadMaterial(file, cohortId, weekNumber);

				if (uploadResult.error) {
					throw new Error(uploadResult.error);
				}

				results.push(uploadResult);
			}

			uploadProgress = 100;

			// Call the callback with the upload results
			await onUpload(results);

			if (results.length > 0) {
				uploadedFiles = [...uploadedFiles, ...results];
			}

			uploadStatus = 'success';

			// Reset after 2 seconds
			setTimeout(() => {
				uploadStatus = 'idle';
				uploadProgress = 0;
			}, 2000);

		} catch (error) {
			uploadStatus = 'error';
			errorMessage = error.message;
			uploadProgress = 0;

			// Reset error after 5 seconds
			setTimeout(() => {
				uploadStatus = 'idle';
				errorMessage = '';
			}, 5000);
		}
	};

	const handleDrop = (e) => {
		e.preventDefault();
		isDragOver = false;

		const files = e.dataTransfer.files;
		if (files.length > 0) {
			handleFileSelect(files);
		}
	};

	const handleDragOver = (e) => {
		e.preventDefault();
		isDragOver = true;
	};

	const handleDragLeave = (e) => {
		e.preventDefault();
		isDragOver = false;
	};

	const handleFileInputChange = (e) => {
		const files = e.target.files;
		if (files && files.length > 0) {
			handleFileSelect(files);
		}
	};

	const triggerFileSelect = () => {
		if (fileInput) {
			fileInput.click();
		}
	};

	const removeUploadedFile = (index) => {
		uploadedFiles.splice(index, 1);
		uploadedFiles = [...uploadedFiles];
	};

	const formatFileSize = (bytes) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};
</script>

<div class="document-upload {className}">
	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		{multiple}
		onchange={handleFileInputChange}
		class="hidden"
	/>

	<!-- Upload area -->
	<div
		class="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
		{isDragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
		{uploadStatus === 'uploading' ? 'pointer-events-none' : ''}"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		onclick={triggerFileSelect}
	>
		{#if uploadStatus === 'uploading'}
			<div class="space-y-4">
				<div class="mx-auto w-12 h-12 flex items-center justify-center bg-blue-100 rounded-full">
					<Upload size="24" class="text-blue-600 animate-pulse" />
				</div>
				<div>
					<p class="text-sm font-medium text-gray-900">Uploading...</p>
					<div class="mt-2 w-full bg-gray-200 rounded-full h-2">
						<div
							class="bg-blue-600 h-2 rounded-full transition-all duration-300"
							style="width: {uploadProgress}%"
						></div>
					</div>
					<p class="text-xs text-gray-500 mt-1">{uploadProgress}%</p>
				</div>
			</div>
		{:else if uploadStatus === 'success'}
			<div class="space-y-2">
				<div class="mx-auto w-12 h-12 flex items-center justify-center bg-green-100 rounded-full">
					<Check size="24" class="text-green-600" />
				</div>
				<p class="text-sm font-medium text-green-900">Upload successful!</p>
			</div>
		{:else if uploadStatus === 'error'}
			<div class="space-y-2">
				<div class="mx-auto w-12 h-12 flex items-center justify-center bg-red-100 rounded-full">
					<AlertCircle size="24" class="text-red-600" />
				</div>
				<p class="text-sm font-medium text-red-900">Upload failed</p>
				<p class="text-xs text-red-600">{errorMessage}</p>
			</div>
		{:else}
			<div class="space-y-2">
				<div class="mx-auto w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full">
					<Upload size="24" class="text-gray-600" />
				</div>
				<div>
					<p class="text-sm font-medium text-gray-900">Drop files here or click to browse</p>
					<p class="text-xs text-gray-500">Supported formats: {accept}</p>
					<p class="text-xs text-gray-500">Max size: {formatFileSize(maxSize)}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Uploaded files list -->
	{#if uploadedFiles.length > 0}
		<div class="mt-4 space-y-2">
			<h4 class="text-sm font-medium text-gray-900">Uploaded Files</h4>
			{#each uploadedFiles as file, index}
				<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
					<div class="flex items-center gap-3">
						<File size="16" class="text-gray-500" />
						<div>
							<p class="text-sm font-medium text-gray-900">{file.name}</p>
							<p class="text-xs text-gray-500">
								{file.size ? formatFileSize(file.size) : ''}
								{file.url ? '• Available' : ''}
							</p>
						</div>
					</div>
					<button
						onclick={() => removeUploadedFile(index)}
						class="p-1 text-gray-400 hover:text-red-500 transition-colors"
						title="Remove file"
					>
						<X size="16" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.document-upload {
		width: 100%;
	}
</style>