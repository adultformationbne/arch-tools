<script>
	import { page } from '$app/stores';
	import { Download, ChevronDown, ChevronRight, FileText, Play, Book, Printer } from 'lucide-svelte';
	import MuxVideoPlayer from '$lib/components/MuxVideoPlayer.svelte';

	let { data } = $props();

	// Extract data from server load
	const { materialsBySession, currentSession, materials, courseName, courseTheme, courseBranding, courseInfo } = data;

	// Check for material ID in URL params
	const urlMaterialId = $page.url.searchParams.get('material');

	// Find the material from URL param, or default to first material from current session
	const findMaterialById = (id) => {
		if (!id) return null;
		return materials.find(m => m.id === id) || null;
	};

	const urlMaterial = findMaterialById(urlMaterialId);
	const defaultMaterial = urlMaterial || materialsBySession[currentSession]?.[0] || null;

	// Find which session the URL material belongs to
	const findSessionForMaterial = (materialId) => {
		for (const [sessionNum, sessionMaterials] of Object.entries(materialsBySession)) {
			if (sessionMaterials.some(m => m.id === materialId)) {
				return parseInt(sessionNum);
			}
		}
		return currentSession;
	};

	// Initialize with URL material's session expanded, or current session
	const initialSession = urlMaterial ? findSessionForMaterial(urlMaterial.id) : currentSession;

	let selectedMaterial = $state(defaultMaterial);
	let expandedSessions = $state(new Set([initialSession]));
	let mobileSelectedSession = $state(initialSession);

	// Get sorted session numbers for navigation
	const sessionNumbers = Object.keys(materialsBySession).map(Number).sort((a, b) => a - b);

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

	const selectMobileSession = (sessionNum) => {
		mobileSelectedSession = sessionNum;
	};

	// Get materials for currently selected mobile session
	const mobileMaterials = $derived(materialsBySession[mobileSelectedSession] || []);

	// Get icon for material type
	const getIcon = (type) => {
		switch(type) {
			case 'video': return Play;
			case 'mux_video': return Play;
			case 'embed': return Play;
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

	// Print native document with course branding
	const handlePrint = () => {
		if (!selectedMaterial || selectedMaterial.type !== 'native') return;

		// Get theme colors with fallbacks
		const accentColor = courseTheme?.accentDark || '#334642';
		const logoUrl = courseBranding?.logoUrl || '';
		const showLogo = courseBranding?.showLogo !== false && logoUrl;

		// Build CSS with color values injected
		// Use margin: 0 on first page for header, add top margin on subsequent pages
		const printStyles = [
			'@page { size: A4; margin: 15mm 0 15mm 0; }',
			'@page :first { margin: 0 0 15mm 0; }',
			'* { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }',
			'html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
			'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #374151; background: white; }',
			'.print-header { background-color: ' + accentColor + ' !important; background: ' + accentColor + ' !important; color: white !important; padding: 24px 20mm; display: flex; align-items: center; gap: 20px; }',
			'.print-logo { height: 48px; width: auto; object-fit: contain; }',
			'.print-header-text { flex: 1; }',
			'.print-course-name { font-size: 12px; color: rgba(255,255,255,0.85) !important; font-weight: 500; margin: 0; text-transform: uppercase; letter-spacing: 1px; }',
			'.print-document-title { font-size: 20px; font-weight: 700; color: white !important; margin: 4px 0 0 0; }',
			'.print-content { padding: 20mm; padding-top: 8mm; }',
			'.print-content h1 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.75rem 0; color: #111827; line-height: 1.3; }',
			'.print-content h2 { font-size: 1.25rem; font-weight: 700; margin: 1rem 0 0.5rem 0; color: #374151; line-height: 1.3; }',
			'.print-content h3 { font-size: 1.125rem; font-weight: 600; margin: 0.75rem 0 0.5rem 0; color: #374151; }',
			'.print-content p { font-size: 0.95rem; line-height: 1.7; margin: 0 0 0.75rem 0; color: #374151; }',
			'.print-content ul, .print-content ol { margin: 0 0 0.75rem 1.25rem; padding: 0; }',
			'.print-content li { font-size: 0.95rem; line-height: 1.7; margin-bottom: 0.35rem; color: #374151; }',
			'.print-content strong { font-weight: 600; color: ' + accentColor + '; }',
			'.print-content em { font-style: italic; }',
			'.print-content blockquote { border-left: 3px solid ' + accentColor + ' !important; padding-left: 0.75rem; margin: 0.75rem 0; color: #6b7280; font-style: italic; }',
			'.print-footer { padding: 16px 20mm; margin-top: 24px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }'
		].join('\n');

		// Get current year for copyright
		const currentYear = new Date().getFullYear();

		// Build logo HTML
		const logoHtml = showLogo
			? '<img src="' + logoUrl + '" alt="Course Logo" class="print-logo" />'
			: '';

		// Build print document HTML (use array join to avoid PostCSS parsing)
		const styleTag = ['<', 'style>', printStyles, '</', 'style>'].join('');
		const printContent = [
			'<!DOCTYPE html>',
			'<html>',
			'<head>',
			'<meta charset="UTF-8">',
			'<title>' + selectedMaterial.title + ' - ' + courseName + '</title>',
			styleTag,
			'</head>',
			'<body>',
			'<header class="print-header">',
			logoHtml,
			'<div class="print-header-text">',
			'<p class="print-course-name">' + courseName + '</p>',
			'<h1 class="print-document-title">' + selectedMaterial.title + '</h1>',
			'</div>',
			'</header>',
			'<main class="print-content">',
			selectedMaterial.content,
			'</main>',
			'<footer class="print-footer">',
			'&copy; ' + currentYear + ' ' + (courseInfo?.name || courseName || 'This organization') + '. All rights reserved. This material is for personal use only and may not be reproduced, distributed, or transmitted without prior written permission.',
			'</footer>',
			'</body>',
			'</html>'
		].join('\n');

		// Open print window
		const printWindow = window.open('', '_blank', 'width=800,height=600');
		if (printWindow) {
			printWindow.document.write(printContent);
			printWindow.document.close();

			// Wait for images to load before printing
			printWindow.onload = () => {
				setTimeout(() => {
					printWindow.print();
				}, 250);
			};
		}
	};
</script>

<div class="min-h-screen flex flex-col lg:flex-row">
	<!-- Mobile Navigation - Session Pills + Material List -->
	<div class="lg:hidden bg-white border-b border-gray-200">
		<!-- Session Pills -->
		<div class="px-4 py-3 border-b border-gray-100">
			<div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
				{#each sessionNumbers as sessionNum}
					<button
						onclick={() => selectMobileSession(sessionNum)}
						class="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap {mobileSelectedSession === sessionNum ? 'text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						style={mobileSelectedSession === sessionNum ? 'background-color: var(--course-accent-dark, #334642);' : ''}
					>
						{sessionNum === 0 ? 'Pre-Start' : `Session ${sessionNum}`}
					</button>
				{/each}
			</div>
		</div>

		<!-- Material List for Selected Session -->
		<div class="px-4 py-3 max-h-48 overflow-y-auto">
			<div class="space-y-1">
				{#each mobileMaterials as mat}
					{@const IconComponent = getIcon(mat.type)}
					{@const isSelected = selectedMaterial?.id === mat.id}
					<button
						onclick={() => selectMaterial(mat)}
						class="flex items-center gap-3 w-full p-3 rounded-xl text-left transition-colors {isSelected ? 'bg-gray-100 ring-2 ring-gray-300' : 'hover:bg-gray-50'}"
					>
						<div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background-color: {isSelected ? 'var(--course-accent-dark, #334642)' : 'var(--course-accent-light, #c59a6b)'}20;">
							<IconComponent size="16" style="color: var(--course-accent-dark, #334642);" />
						</div>
						<span class="text-sm font-medium text-gray-900 line-clamp-1">{mat.title}</span>
					</button>
				{/each}
				{#if mobileMaterials.length === 0}
					<p class="text-sm text-gray-500 italic py-2">No materials for this session</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Desktop Sidebar - Hidden on mobile -->
	<div class="hidden lg:flex lg:sticky top-0 left-0 h-screen w-80 bg-white/10 backdrop-blur-sm flex-col border-r border-white/20">
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
						<span class="font-semibold text-white">
							{parseInt(sessionNum) === 0 ? 'Pre-Start' : `Session ${sessionNum}`}
						</span>
					</button>

					<!-- Material List -->
					{#if expandedSessions.has(parseInt(sessionNum))}
						<div class="ml-6 mt-1 space-y-1">
							{#each sessionMaterials as mat}
								{@const IconComponent = getIcon(mat.type)}
								{@const isSelected = selectedMaterial?.id === mat.id}
								<div class="group flex items-center gap-1">
									<button
										class="flex items-center gap-2 flex-1 p-2 rounded-lg text-sm transition-colors {isSelected ? 'bg-white/20 shadow-sm' : 'hover:bg-white/10'}"
										onclick={() => selectMaterial(mat)}
									>
										<IconComponent size="14" class="text-white/70" />
										<span class="text-white/90 text-left flex-1 line-clamp-2">
											{mat.title}
										</span>
									</button>
									{#if mat.type === 'native'}
										<button
											onclick={(e) => { e.stopPropagation(); selectMaterial(mat); setTimeout(handlePrint, 100); }}
											class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-all"
											title="Download PDF"
										>
											<Printer size="14" class="text-white/70" />
										</button>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 bg-white">
		<!-- Page Header - Hidden for embed theatre mode -->
		{#if selectedMaterial?.type !== 'embed'}
		<div class="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-b border-gray-200 bg-gray-50">
			<div class="max-w-5xl mx-auto flex items-start justify-between gap-4">
				<div>
					<h1 class="text-xl sm:text-2xl font-bold text-gray-900">
						{selectedMaterial ? selectedMaterial.title : 'Select a Material'}
					</h1>
					{#if selectedMaterial}
						<p class="text-sm text-gray-600 mt-1">
							{selectedMaterial.type === 'video' ? 'YouTube Video' :
							 selectedMaterial.type === 'mux_video' ? 'Video Content' :
							 selectedMaterial.type === 'native' ? 'Text Document' :
							 selectedMaterial.type === 'document' ? 'PDF Document' : 'External Link'}
						</p>
					{/if}
				</div>
				{#if selectedMaterial?.type === 'native'}
					<button
						onclick={handlePrint}
						class="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl hover:opacity-90 transition-opacity shadow-md"
						style="background-color: var(--course-accent-dark, #334642);"
					>
						<Printer size="18" />
						<span class="font-medium">Download PDF</span>
					</button>
				{/if}
				{#if selectedMaterial?.type === 'document' || selectedMaterial?.type === 'link'}
					<a
						href={selectedMaterial.content}
						target="_blank"
						class="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl hover:opacity-90 transition-opacity shadow-md"
						style="background-color: var(--course-accent-dark, #334642);"
					>
						<Download size="18" />
						<span class="font-medium">Open External</span>
					</a>
				{/if}
			</div>
		</div>
		{/if}

		<!-- Content Display -->
		<div class="overflow-y-auto">
			<div class="{selectedMaterial?.type === 'embed' ? 'px-4 py-4' : 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'}">
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
				{:else if selectedMaterial?.type === 'mux_video'}
					<!-- Mux Video Player -->
					<MuxVideoPlayer
						playbackId={selectedMaterial.mux_playback_id}
						title={selectedMaterial.title}
						status={selectedMaterial.mux_status}
					/>
				{:else if selectedMaterial?.type === 'embed'}
					<!-- Embedded Video (SharePoint/Stream) - Theatre Mode -->
					<div class="embed-theatre">
						{@html selectedMaterial.content}
					</div>
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
					<div class="flex flex-col items-center justify-center py-16 sm:py-32 text-gray-400">
						<FileText size="64" class="mb-4" />
						<p class="text-xl font-medium">Select a material to view</p>
						<p class="text-sm hidden lg:block">Choose from the tree on the left</p>
						<p class="text-sm lg:hidden">Choose from the list above</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* Hide scrollbar but allow scrolling */
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}

	/* Embed Theatre Mode - override hardcoded sizes */
	.embed-theatre {
		width: 100%;
		max-width: 100%;
	}

	.embed-theatre :global(div) {
		max-width: 100% !important;
		width: 100% !important;
	}

	.embed-theatre :global(iframe) {
		width: 100% !important;
		max-width: 100% !important;
	}

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