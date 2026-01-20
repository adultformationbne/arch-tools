<script>
	/**
	 * MuxVideoPlayer Component
	 *
	 * Displays a Mux video player with status handling for processing/ready/error states.
	 * Uses @mux/mux-player web component for playback.
	 * Falls back gracefully if Mux SDK fails to load.
	 */
	import { onMount } from 'svelte';
	import { Loader2, AlertCircle, Video } from '$lib/icons';

	let {
		playbackId = null,
		title = '',
		status = 'ready'
	} = $props();

	let muxLoaded = $state(false);
	let muxError = $state(false);

	onMount(async () => {
		try {
			await import('@mux/mux-player');
			muxLoaded = true;
		} catch (err) {
			console.warn('Mux player failed to load:', err.message);
			muxError = true;
		}
	});
</script>

{#if status === 'ready' && playbackId}
	{#if muxError}
		<!-- Fallback when Mux player fails to load -->
		<div class="aspect-video rounded-xl overflow-hidden shadow-lg bg-gray-900 flex flex-col items-center justify-center">
			<Video size="48" class="text-gray-500 mb-3" />
			<p class="text-gray-400 font-medium">Video player unavailable</p>
			<p class="text-sm text-gray-500 mt-1">Please try refreshing the page</p>
		</div>
	{:else if muxLoaded}
		<div class="aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
			<mux-player
				playback-id={playbackId}
				metadata-video-title={title}
				accent-color="#c59a6b"
				style="width: 100%; height: 100%;"
			></mux-player>
		</div>
	{:else}
		<!-- Loading state -->
		<div class="aspect-video rounded-xl overflow-hidden shadow-lg bg-gray-900 flex items-center justify-center">
			<Loader2 size="32" class="animate-spin text-gray-400" />
		</div>
	{/if}
{:else if status === 'processing'}
	<div class="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
		<Loader2 size="48" class="animate-spin text-gray-400 mb-4" />
		<p class="text-gray-600 font-medium">Video is processing...</p>
		<p class="text-sm text-gray-500 mt-1">This typically takes a few minutes</p>
	</div>
{:else if status === 'uploading'}
	<div class="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
		<Loader2 size="48" class="animate-spin text-gray-400 mb-4" />
		<p class="text-gray-600 font-medium">Upload in progress...</p>
	</div>
{:else if status === 'errored'}
	<div class="flex flex-col items-center justify-center py-16 bg-red-50 rounded-xl border-2 border-dashed border-red-200">
		<AlertCircle size="48" class="text-red-400 mb-4" />
		<p class="text-red-600 font-medium">Video processing failed</p>
		<p class="text-sm text-red-500 mt-1">Please try uploading again or contact support</p>
	</div>
{:else}
	<div class="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
		<Video size="48" class="text-gray-300 mb-4" />
		<p class="text-gray-500">No video available</p>
	</div>
{/if}
