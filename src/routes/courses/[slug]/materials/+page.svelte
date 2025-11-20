<script>
	import { Download, ChevronDown, ChevronRight, FileText, Play, Book } from 'lucide-svelte';

	let { data } = $props();

	// Extract data from server load
	const { materialsBySession, currentSession, materials, courseName } = data;

	// Find a default material to show (first material from current session)
	const defaultMaterial = materialsBySession[currentSession]?.[0] || null;
	let selectedMaterial = $state(defaultMaterial);
	let expandedSessions = $state(new Set([currentSession]));

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
</script>

<div class="min-h-screen flex">
	<!-- Left Sidebar - Document Tree -->
	<div class="w-80 bg-white/10 backdrop-blur-sm flex flex-col border-r border-white/20 sticky top-0 h-screen">
		<!-- Sidebar Header -->
		<div class="p-6 border-b border-white/20">
			<h3 class="text-lg font-bold text-white">Course Materials</h3>
			<p class="text-sm text-white/70 mt-1">{courseName}</p>
		</div>

		<!-- Document Tree -->
		<div class="flex-1 overflow-y-auto p-4 space-y-2">
			{#each Object.entries(materialsBySession) as [sessionNum, sessionMaterials]}
				<div class="mb-3">
					<!-- Session Header -->
					<button
						class="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-white/10 transition-colors text-left"
						onclick={() => toggleSession(parseInt(sessionNum))}
					>
						{#if expandedSessions.has(parseInt(sessionNum))}
							<ChevronDown size="16" class="text-white/70" />
						{:else}
							<ChevronRight size="16" class="text-white/70" />
						{/if}
						<span class="font-semibold text-white">Session {sessionNum}</span>
					</button>

					<!-- Material List -->
					{#if expandedSessions.has(parseInt(sessionNum))}
						<div class="ml-6 mt-1 space-y-1">
							{#each sessionMaterials as mat}
								{@const IconComponent = getIcon(mat.type)}
								{@const isSelected = selectedMaterial?.id === mat.id}
								<button
									class="flex items-center gap-2 w-full p-2 rounded-lg text-sm transition-colors {isSelected ? 'bg-white/20 shadow-sm' : 'hover:bg-white/10'}"
									onclick={() => selectMaterial(mat)}
								>
									<IconComponent size="14" class="text-white/70" />
									<span class="text-white/90 text-left flex-1 line-clamp-2">
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

	<!-- Main Content Area -->
	<div class="flex-1 bg-white">
		<!-- Page Header -->
		<div class="px-8 py-6 border-b border-gray-200 bg-gray-50">
			<div class="max-w-5xl mx-auto">
				<h1 class="text-2xl font-bold text-gray-900">
					{selectedMaterial ? selectedMaterial.title : 'Select a Material'}
				</h1>
				{#if selectedMaterial}
					<div class="flex items-center gap-4 mt-2">
						<p class="text-sm text-gray-600">
							{selectedMaterial.type === 'video' ? 'Video Content' :
							 selectedMaterial.type === 'native' ? 'Text Document' :
							 selectedMaterial.type === 'document' ? 'PDF Document' : 'External Link'}
						</p>
						{#if selectedMaterial.type === 'document' || selectedMaterial.type === 'link'}
							<a
								href={selectedMaterial.content}
								target="_blank"
								class="flex items-center gap-2 px-3 py-1.5 text-sm text-white rounded-lg hover:opacity-90 transition-opacity"
								style="background-color: var(--course-accent-dark, #334642);"
							>
								<Download size="14" />
								Open External
							</a>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Content Display -->
		<div class="overflow-y-auto">
			<div class="max-w-5xl mx-auto px-8 py-8">
				{#if selectedMaterial?.type === 'video'}
					<!-- YouTube Video Embed -->
					{@const videoId = getYouTubeId(selectedMaterial.content)}
					{#if videoId}
						<div class="aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
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
						<div class="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
							<p class="text-gray-600 mb-4">Invalid video URL</p>
							<a href={selectedMaterial.content} target="_blank" class="text-blue-600 hover:underline">
								Open in new tab →
							</a>
						</div>
					{/if}
				{:else if selectedMaterial?.type === 'native'}
					<!-- Native HTML Content -->
					<div class="bg-white rounded-xl border border-gray-200 p-8 content-html">
						{@html selectedMaterial.content}
					</div>
				{:else if selectedMaterial?.type === 'document'}
					<!-- PDF/Document Link -->
					<div class="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
						<FileText size="64" class="mx-auto mb-4 text-gray-400" />
						<h3 class="text-xl font-semibold mb-2 text-gray-900">{selectedMaterial.title}</h3>
						<p class="text-gray-600 mb-6">This document is hosted externally</p>
						<a
							href={selectedMaterial.content}
							target="_blank"
							class="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-opacity"
							style="background-color: var(--course-accent-dark, #334642);"
						>
							<Download size="18" />
							Open Document
						</a>
					</div>
				{:else if selectedMaterial}
					<!-- Generic link -->
					<div class="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
						<h3 class="text-xl font-semibold mb-4 text-gray-900">{selectedMaterial.title}</h3>
						<a
							href={selectedMaterial.content}
							target="_blank"
							class="inline-flex items-center gap-2 px-6 py-3 text-white rounded-lg hover:opacity-90 transition-opacity"
							style="background-color: var(--course-accent-dark, #334642);"
						>
							Open Link →
						</a>
					</div>
				{:else}
					<!-- No Content Selected -->
					<div class="flex flex-col items-center justify-center py-32 text-gray-400">
						<FileText size="64" class="mb-4" />
						<p class="text-xl font-medium">Select a material to view</p>
						<p class="text-sm">Choose from the tree on the left</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* Custom HTML content styling */
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