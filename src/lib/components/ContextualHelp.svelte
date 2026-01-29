<script>
	import { onMount } from 'svelte';
	import { HelpCircle, X, ChevronLeft, ChevronRight, BookOpen, PlayCircle } from '$lib/icons';

	let {
		helpContent = [],
		mode = 'sidebar', // 'sidebar' | 'popup' | 'floating'
		autoShow = false,
		position = 'right', // 'left' | 'right' for sidebar, 'top-right' | 'bottom-right' etc for floating
		onClose = () => {},
		pageTitle = 'Page Guide',
		buttonLabel = '', // Optional text label next to the help icon
		videoUrl = '', // Optional Loom/video embed URL
		videoTitle = 'Watch Tutorial', // Title for video section
		open = $bindable(false), // External control for open state
		showTriggerButton = true // Whether to show the floating trigger button
	} = $props();

	let showVideo = $state(false);

	let isOpen = $state(false);

	// Sync with external open prop
	$effect(() => {
		if (open !== isOpen) {
			isOpen = open;
		}
	});
	let currentSection = $state(0);
	let collapsed = $state(false);

	// Auto-show logic
	onMount(() => {
		if (autoShow && helpContent.length > 0) {
			// Check if user has seen help for this page before
			const pageKey = `help_seen_${window.location.pathname}`;
			const hasSeenHelp = localStorage.getItem(pageKey);

			if (!hasSeenHelp) {
				isOpen = true;
			}
		}
	});

	function toggleHelp() {
		isOpen = !isOpen;
		open = isOpen;
		if (!isOpen) {
			onClose();
		}
	}

	function closeHelp() {
		isOpen = false;
		open = false;
		onClose();

		// Mark as seen
		const pageKey = `help_seen_${window.location.pathname}`;
		localStorage.setItem(pageKey, 'true');
	}

	function nextSection() {
		if (currentSection < helpContent.length - 1) {
			currentSection += 1;
		}
	}

	function prevSection() {
		if (currentSection > 0) {
			currentSection -= 1;
		}
	}

	function goToSection(index) {
		currentSection = index;
	}

	function toggleCollapsed() {
		collapsed = !collapsed;
	}

	// Style classes for different modes
	let modeClasses = $derived({
		sidebar: `fixed top-0 ${position === 'right' ? 'right-0' : 'left-0'} h-full bg-white shadow-xl border-l border-gray-200 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : position === 'right' ? 'translate-x-full' : '-translate-x-full'} z-40`,
		popup: 'fixed inset-0 z-50 overflow-y-auto',
		floating: `fixed ${position} bg-white rounded-lg shadow-xl border border-gray-200 transform transition-all duration-300 ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'} z-40`
	}[mode]);

	let widthClass = $derived(mode === 'sidebar' ? (collapsed ? 'w-12' : 'w-80') : mode === 'floating' ? 'w-80' : '');
</script>

<!-- Trigger Button (always visible for sidebar/floating modes) -->
{#if mode !== 'popup' && showTriggerButton}
	{@const bottomMatch = position.match(/bottom-(\d+)/)}
	{@const bottomClass = bottomMatch ? `bottom-${bottomMatch[1]}` : 'bottom-4'}
	<button
		onclick={toggleHelp}
		class="fixed {position.includes('right') ? 'right-4' : 'left-4'} {bottomClass} bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors z-30 {isOpen && mode === 'sidebar' ? 'hidden' : ''} {buttonLabel ? 'px-4 py-2.5 rounded-full flex items-center gap-2' : 'p-3 rounded-full'}"
		title="Show page help"
	>
		<HelpCircle class="w-5 h-5" />
		{#if buttonLabel}
			<span class="text-sm font-medium">{buttonLabel}</span>
		{/if}
	</button>
{/if}

<!-- Help Content -->
{#if mode === 'popup'}
	<!-- Popup Modal -->
	{#if isOpen}
		<div class={modeClasses}>
			<div class="flex min-h-full items-center justify-center p-4">
				<div class="fixed inset-0 bg-gray-500 bg-opacity-50 transition-opacity" onmousedown={closeHelp} role="presentation"></div>

				<div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
					<!-- Modal Header -->
					<div class="flex items-center justify-between p-6 border-b border-gray-200">
						<div class="flex items-center gap-3">
							<BookOpen class="w-6 h-6 text-blue-600" />
							<h2 class="text-xl font-semibold text-gray-900">{pageTitle}</h2>
						</div>
						<button onclick={closeHelp} class="text-gray-400 hover:text-gray-600 transition-colors">
							<X class="w-5 h-5" />
						</button>
					</div>

					<!-- Modal Content -->
					<div class="p-6 overflow-y-auto max-h-[60vh]">
						{#if helpContent.length > 0}
							<div class="space-y-6">
								{#each helpContent as section, index}
									<div class="border-b border-gray-100 pb-6 last:border-b-0">
										<h3 class="text-lg font-medium text-gray-900 mb-3">{section.title}</h3>
										<div class="prose prose-sm max-w-none">
											{@html section.content}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-gray-500 text-center py-8">No help content available for this page.</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/if}
{:else}
	<!-- Sidebar/Floating -->
	<div class="{modeClasses} {widthClass}">
		{#if isOpen}
			<div class="h-full flex flex-col">
				<!-- Header -->
				<div class="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
					{#if !collapsed}
						<div class="flex items-center gap-2">
							<BookOpen class="w-5 h-5 text-blue-600" />
							<h2 class="font-semibold text-gray-900 text-sm">{pageTitle}</h2>
						</div>
					{/if}

					<div class="flex items-center gap-1">
						{#if mode === 'sidebar'}
							<button
								onclick={toggleCollapsed}
								class="p-1 hover:bg-gray-200 rounded"
								title={collapsed ? 'Expand' : 'Collapse'}
							>
								{#if collapsed}
									<ChevronLeft class="w-4 h-4" />
								{:else}
									<ChevronRight class="w-4 h-4" />
								{/if}
							</button>
						{/if}
						<button
							onclick={closeHelp}
							class="p-1 hover:bg-gray-200 rounded"
							title="Close help"
						>
							<X class="w-4 h-4" />
						</button>
					</div>
				</div>

				{#if !collapsed}
					<!-- Video Tutorial Button (if video URL provided) -->
					{#if videoUrl}
						<div class="border-b border-gray-200 p-3">
							{#if showVideo}
								<div class="space-y-2">
									<div class="flex items-center justify-between">
										<span class="text-sm font-medium text-gray-700">{videoTitle}</span>
										<button
											onclick={() => showVideo = false}
											class="text-xs text-gray-500 hover:text-gray-700"
										>
											Hide
										</button>
									</div>
									<div style="position: relative; padding-bottom: 56.25%; height: 0;">
										<iframe
											src={videoUrl}
											frameborder="0"
											webkitallowfullscreen
											mozallowfullscreen
											allowfullscreen
											style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 6px;"
											title={videoTitle}
										></iframe>
									</div>
								</div>
							{:else}
								<button
									onclick={() => showVideo = true}
									class="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
								>
									<PlayCircle class="w-5 h-5" />
									<span class="text-sm font-medium">{videoTitle}</span>
								</button>
							{/if}
						</div>
					{/if}

					<!-- Navigation (if multiple sections) -->
					{#if helpContent.length > 1}
						<div class="border-b border-gray-200">
							<nav class="p-2">
								<div class="space-y-1">
									{#each helpContent as section, index}
										<button
											onclick={() => goToSection(index)}
											class="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 {currentSection === index ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}"
										>
											{section.title}
										</button>
									{/each}
								</div>
							</nav>
						</div>
					{/if}

					<!-- Content -->
					<div class="flex-1 overflow-y-auto p-4">
						{#if helpContent.length > 0 && helpContent[currentSection]}
							<div class="space-y-4">
								<h3 class="font-medium text-gray-900">{helpContent[currentSection].title}</h3>
								<div class="prose prose-sm max-w-none text-gray-700">
									{@html helpContent[currentSection].content}
								</div>
							</div>
						{:else}
							<p class="text-gray-500 text-sm">No help content available.</p>
						{/if}
					</div>

					<!-- Navigation Footer (if multiple sections) -->
					{#if helpContent.length > 1}
						<div class="border-t border-gray-200 p-3">
							<div class="flex items-center justify-between">
								<button
									onclick={prevSection}
									disabled={currentSection === 0}
									class="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<ChevronLeft class="w-4 h-4" />
									Previous
								</button>

								<span class="text-xs text-gray-500">
									{currentSection + 1} of {helpContent.length}
								</span>

								<button
									onclick={nextSection}
									disabled={currentSection === helpContent.length - 1}
									class="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Next
									<ChevronRight class="w-4 h-4" />
								</button>
							</div>
						</div>
					{/if}
				{:else}
					<!-- Collapsed state - just show section indicators -->
					{#if helpContent.length > 1}
						<div class="p-2 space-y-2">
							{#each helpContent as section, index}
								<button
									onclick={() => goToSection(index)}
									class="w-full h-8 rounded {currentSection === index ? 'bg-blue-100' : 'bg-gray-100'}"
									title={section.title}
								></button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	@reference "../../app.css";
	:global(.prose ul) {
		@apply list-disc pl-5 space-y-1;
	}

	:global(.prose ol) {
		@apply list-decimal pl-5 space-y-1;
	}

	:global(.prose li) {
		@apply text-sm;
	}

	:global(.prose strong) {
		@apply font-semibold;
	}

	:global(.prose code) {
		@apply bg-gray-100 px-1 py-0.5 rounded text-xs font-mono;
	}

	:global(.prose a) {
		@apply text-blue-600 hover:text-blue-800 underline;
	}
</style>
