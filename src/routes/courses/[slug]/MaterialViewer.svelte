<script>
	import { X, Download, ChevronDown, ChevronRight, FileText, Play, Mic, Book } from 'lucide-svelte';

	let {
		material = null,
		isVisible = $bindable(false),
		currentSession = 8,
		materialsBySession = {},
		courseName = 'Course Materials',
		onClose = () => {}
	} = $props();

	let selectedMaterial = $state(null);
	let expandedSessions = $state(new Set([currentSession]));

	const handleClose = () => {
		isVisible = false;
		onClose();
	};

	const toggleSession = (sessionNum) => {
		if (expandedSessions.has(sessionNum)) {
			expandedSessions.delete(sessionNum);
		} else {
			expandedSessions.add(sessionNum);
		}
		expandedSessions = new Set(expandedSessions);
	};

	const selectMaterial = (material) => {
		selectedMaterial = material;
	};

	// Get icon for material type
	const getIcon = (type) => {
		switch(type) {
			case 'video': return Play;
			case 'document': return FileText;
			case 'native': return Book;
			case 'link': return FileText;
			default: return FileText;
		}
	};

	// Extract YouTube video ID from URL
	const getYouTubeId = (url) => {
		const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n]+)/);
		return match ? match[1] : null;
	};


	// Initialize with current material if provided
	$effect(() => {
		if (material && isVisible) {
			selectedMaterial = material;
		}
	});
</script>

{#if isVisible}
	<div class="relative z-20">
		<div class="max-w-7xl mx-auto">
			<div class="bg-white rounded-3xl shadow-lg overflow-hidden flex h-[80vh]">

				<!-- Left Sidebar - Document Tree (Cream with Dark Text) -->
				<div class="w-80 bg-gray-50 flex flex-col h-full rounded-l-3xl">
					<!-- Sidebar Header -->
					<div class="p-6 border-b border-gray-200">
						<h3 class="text-lg font-bold text-gray-800">Course Materials</h3>
						<p class="text-sm text-gray-600 mt-1">All sessions • {courseName}</p>
					</div>

					<!-- Document Tree -->
					<div class="flex-1 overflow-y-auto p-4 space-y-2">
						{#each Object.entries(materialsBySession) as [sessionNum, materials]}
							<div class="mb-3">
								<!-- Session Header -->
								<button
									class="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
									onclick={() => toggleSession(parseInt(sessionNum))}
								>
									{#if expandedSessions.has(parseInt(sessionNum))}
										<ChevronDown size="16" class="text-gray-500" />
									{:else}
										<ChevronRight size="16" class="text-gray-500" />
									{/if}
									<span class="font-semibold text-gray-800">Session {sessionNum}</span>
								</button>

								<!-- Material List -->
								{#if expandedSessions.has(parseInt(sessionNum))}
									<div class="ml-6 mt-1 space-y-1">
										{#each materials as mat}
											{@const IconComponent = getIcon(mat.type)}
											<button
												class="flex items-center gap-2 w-full p-2 rounded-lg text-sm transition-colors hover:bg-gray-100"
												class:bg-gray-200={selectedMaterial?.id === mat.id}
												class:shadow-sm={selectedMaterial?.id === mat.id}
												onclick={() => selectMaterial(mat)}
											>
												<IconComponent size="14" class="text-gray-500" />
												<span class="text-gray-700 text-left flex-1">
													{mat.title}
												</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Main Content Area (White Background) -->
				<div class="flex-1 flex flex-col h-full bg-white rounded-r-3xl">
					<!-- Header (Slightly Darker) -->
					<div class="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-tr-3xl">
						<div>
							<h3 class="text-2xl font-bold text-gray-800">
								{selectedMaterial ? selectedMaterial.title : 'Select a document'}
							</h3>
							{#if selectedMaterial}
								<p class="text-sm text-gray-600 mt-1">
									{selectedMaterial.type === 'video' ? 'Video Content' :
									 selectedMaterial.type === 'native' ? 'Text Document' :
									 selectedMaterial.type === 'document' ? 'PDF Document' : 'External Link'}
								</p>
							{/if}
						</div>
						<button
							onclick={handleClose}
							class="p-2 rounded-xl hover:bg-gray-100 transition-colors"
						>
							<X size="20" class="text-gray-600" />
						</button>
					</div>

					<!-- Content Display -->
					<div class="flex-1 p-6 overflow-y-auto min-h-0 bg-white">
						{#if selectedMaterial?.type === 'video'}
							<!-- YouTube Video Embed -->
							{@const videoId = getYouTubeId(selectedMaterial.content)}
							{#if videoId}
								<div class="aspect-video rounded-2xl overflow-hidden shadow-md max-w-4xl mx-auto">
									<iframe
										width="100%"
										height="100%"
										src="https://www.youtube.com/embed/{videoId}?rel=0&modestbranding=1"
										title={selectedMaterial.title}
										frameborder="0"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowfullscreen
										class="w-full h-full"
									></iframe>
								</div>
							{:else}
								<div class="text-center py-8">
									<p class="text-gray-600">Invalid video URL</p>
									<a href={selectedMaterial.content} target="_blank" class="text-blue-600 hover:underline mt-2 inline-block">
										Open in new tab →
									</a>
								</div>
							{/if}
						{:else if selectedMaterial?.type === 'native'}
							<!-- Native HTML Content -->
							<div class="max-w-4xl mx-auto content-html">
								{@html selectedMaterial.content}
							</div>
						{:else if selectedMaterial?.type === 'document'}
							<!-- PDF/Document Link -->
							<div class="text-center py-12">
								<FileText size="64" class="mx-auto mb-4 text-gray-400" />
								<h3 class="text-xl font-semibold mb-2">{selectedMaterial.title}</h3>
								<p class="text-gray-600 mb-6">This document is hosted externally</p>
								<a
									href={selectedMaterial.content}
									target="_blank"
									class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
								>
									<Download size="18" />
									Open Document
								</a>
							</div>
						{:else if selectedMaterial}
							<!-- Generic link -->
							<div class="text-center py-12">
								<h3 class="text-xl font-semibold mb-4">{selectedMaterial.title}</h3>
								<a
									href={selectedMaterial.content}
									target="_blank"
									class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
								>
									Open Link →
								</a>
							</div>
						{:else}
							<!-- No Content Selected -->
							<div class="flex flex-col items-center justify-center h-64 text-gray-500">
								<FileText size="48" class="mb-4" />
								<p class="text-xl font-medium">Select a document to view</p>
								<p class="text-sm">Choose from the materials tree on the left</p>
							</div>
						{/if}
					</div>

					<!-- Footer -->
					{#if selectedMaterial}
						<div class="flex items-center justify-between p-6 bg-gray-50 border-t border-gray-200 rounded-br-3xl">
							<div class="text-sm text-gray-600">
								{#if selectedMaterial.type === 'video'}
									<span>Video content • Click to expand for full screen</span>
								{:else if selectedMaterial.type === 'native'}
									<span>Text content • Formatted document</span>
								{:else if selectedMaterial.type === 'document'}
									<span>PDF document • External file</span>
								{:else}
									<span>External link</span>
								{/if}
							</div>
							{#if selectedMaterial.type === 'document' || selectedMaterial.type === 'link'}
								<a
									href={selectedMaterial.content}
									target="_blank"
									class="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100"
								>
									<Download size="16" />
									<span class="text-sm font-medium">Open</span>
								</a>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>

	/* Custom HTML content styling - using direct CSS for compatibility */
	:global(.content-html h1) {
		font-size: 2.25rem;
		font-weight: 700;
		margin-bottom: 1.5rem;
		margin-top: 2rem;
		color: #111827;
		line-height: 1.2;
	}

	:global(.content-html h2) {
		font-size: 1.875rem;
		font-weight: 700;
		margin-bottom: 1rem;
		margin-top: 2rem;
		color: #374151;
		line-height: 1.3;
	}

	:global(.content-html h3) {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		margin-top: 1.5rem;
		color: #374151;
		line-height: 1.4;
	}

	:global(.content-html p) {
		font-size: 1.125rem;
		line-height: 1.75;
		margin-bottom: 1rem;
		color: #374151;
	}

	:global(.content-html ol) {
		list-style-type: decimal;
		list-style-position: inside;
		margin-bottom: 1.5rem;
		margin-left: 1.5rem;
	}

	:global(.content-html ul) {
		list-style-type: disc;
		list-style-position: inside;
		margin-bottom: 1.5rem;
		margin-left: 1.5rem;
	}

	:global(.content-html li) {
		font-size: 1.125rem;
		color: #374151;
		line-height: 1.75;
		margin-bottom: 0.5rem;
	}

	:global(.content-html strong) {
		font-weight: 600;
		color: #c59a6b;
	}

	:global(.content-html em) {
		font-style: italic;
		color: #666;
	}
</style>