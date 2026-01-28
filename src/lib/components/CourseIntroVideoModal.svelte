<script>
	import { X } from '$lib/icons';
	import { browser } from '$app/environment';

	let {
		show = false,
		videoUrl = '',
		courseTitle = 'Your Course',
		onClose = () => {}
	} = $props();

	// Extract Loom video ID from URL
	const getLoomEmbedUrl = (url) => {
		if (!url) return null;
		// Handle various Loom URL formats:
		// https://www.loom.com/share/abc123
		// https://www.loom.com/embed/abc123
		const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
		if (match) {
			return `https://www.loom.com/embed/${match[1]}?hideEmbedTopBar=true`;
		}
		return url;
	};

	const embedUrl = $derived(getLoomEmbedUrl(videoUrl));

	// Handle escape key
	function handleKeydown(e) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	// Prevent body scroll when modal is open
	$effect(() => {
		if (browser && show) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div
		class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
		onclick={onClose}
		role="dialog"
		aria-modal="true"
		aria-labelledby="intro-video-title"
	>
		<div
			class="bg-white rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
				<div>
					<h2 id="intro-video-title" class="text-lg font-bold text-gray-900">
						Welcome to {courseTitle}
					</h2>
					<p class="text-sm text-gray-500">A quick introduction to get you started</p>
				</div>
				<button
					onclick={onClose}
					class="p-2 rounded-full hover:bg-gray-100 transition-colors"
					aria-label="Close video"
				>
					<X size={24} class="text-gray-500" />
				</button>
			</div>

			<!-- Video -->
			<div class="relative bg-black" style="padding-bottom: 56.25%;">
				{#if embedUrl}
					<iframe
						src={embedUrl}
						title="Course Introduction Video"
						class="absolute inset-0 w-full h-full"
						frameborder="0"
						allowfullscreen
						allow="autoplay; fullscreen; picture-in-picture"
					></iframe>
				{:else}
					<div class="absolute inset-0 flex items-center justify-center text-white">
						<p>Video not available</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 bg-gray-50 flex items-center justify-between">
				<p class="text-sm text-gray-500">
					You can always find help in the course materials
				</p>
				<button
					onclick={onClose}
					class="px-6 py-2 text-white font-medium rounded-lg transition-colors hover:opacity-90"
					style="background-color: var(--course-accent-dark, #334642);"
				>
					Get Started
				</button>
			</div>
		</div>
	</div>
{/if}
