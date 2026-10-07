<script>
	/**
	 * MuxVideoPlayer Component
	 *
	 * Displays a Mux video player with status handling for processing/ready/error states.
	 * Uses @mux/mux-player web component for playback.
	 * Falls back gracefully if Mux SDK fails to load.
	 */
	import { onMount, tick } from 'svelte';
	import { Loader2, AlertCircle, Video } from '$lib/icons';
	import { PausePointTracker } from '$lib/utils/pause-points';
	import { readableTextOn } from '$lib/utils/theme-contrast';

	/**
	 * pausePoints: [{ id, time, prompt }]. When playback reaches one the video pauses
	 * and the prompt is shown over it. Everything is skippable: the viewer can press
	 * Continue, press play, or scrub away, and nothing is recorded.
	 *
	 * player (bindable): the <mux-player> element, so an admin editor can read currentTime.
	 */
	let {
		playbackId = null,
		title = '',
		status = 'ready',
		accentColor = '#c59a6b',
		pausePoints = [],
		player = $bindable(/** @type {any} */ (null))
	} = $props();

	let muxLoaded = $state(false);
	let muxError = $state(false);

	// The wrapper, not the player, goes fullscreen, so the prompt stays visible there.
	const wrapperId = `mux-player-${Math.random().toString(36).slice(2, 10)}`;
	let wrapper = $state(/** @type {HTMLDivElement | null} */ (null));
	let continueButton = $state(/** @type {HTMLButtonElement | null} */ (null));

	let activePoint = $state(/** @type {{ id: string, time: number, prompt: string } | null} */ (null));

	const tracker = new PausePointTracker();
	const hasPausePoints = $derived(pausePoints.length > 0);
	const onAccent = $derived(readableTextOn(accentColor));

	$effect(() => {
		tracker.setPoints(pausePoints, player?.currentTime ?? 0);
		if (activePoint && !pausePoints.some((/** @type {{ id: string }} */ p) => p.id === activePoint?.id)) activePoint = null;
	});

	async function showPoint(point) {
		if (!player) return;
		player.pause();
		// Land on the exact moment; rAF can overshoot by a frame.
		if (Math.abs(player.currentTime - point.time) > 0.05) player.currentTime = point.time;

		// iPhone Safari plays fullscreen in its own native player, which can't show our prompt.
		const nativeEl = player.media?.nativeEl;
		if (nativeEl?.webkitDisplayingFullscreen) nativeEl.webkitExitFullscreen?.();

		activePoint = point;
		await tick();
		continueButton?.focus({ preventScroll: true });
	}

	function resume() {
		activePoint = null;
		player?.play();
	}

	// Drive the tracker from the player. rAF while playing for frame-accurate stops;
	// timeupdate as a backstop, since rAF is throttled in background tabs.
	$effect(() => {
		const el = player;
		if (!el || !hasPausePoints) return;

		let frame = 0;
		const check = () => {
			const hit = tracker.advance(el.currentTime);
			if (hit) showPoint(hit);
		};
		const loop = () => {
			check();
			frame = requestAnimationFrame(loop);
		};
		const onPlay = () => {
			// Pressing play on the controls while a prompt is up is "continue".
			activePoint = null;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(loop);
		};
		const onStop = () => cancelAnimationFrame(frame);
		const onSeeked = () => tracker.seek(el.currentTime);

		el.addEventListener('play', onPlay);
		el.addEventListener('pause', onStop);
		el.addEventListener('ended', onStop);
		el.addEventListener('seeked', onSeeked);
		el.addEventListener('timeupdate', check);
		if (!el.paused) onPlay();

		return () => {
			cancelAnimationFrame(frame);
			el.removeEventListener('play', onPlay);
			el.removeEventListener('pause', onStop);
			el.removeEventListener('ended', onStop);
			el.removeEventListener('seeked', onSeeked);
			el.removeEventListener('timeupdate', check);
		};
	});

	function onOverlayKeydown(event) {
		if (event.key === 'Escape') {
			// Keep the video paused, just clear the prompt.
			activePoint = null;
		}
	}

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
		<div
			bind:this={wrapper}
			id={wrapperId}
			class="player-frame aspect-video rounded-xl overflow-hidden shadow-lg bg-black"
		>
			<mux-player
				bind:this={player}
				playback-id={playbackId}
				metadata-video-title={title}
				accent-color={accentColor}
				fullscreen-element={wrapperId}
				style="width: 100%; height: 100%;{hasPausePoints ? ' --pip-button: none;' : ''}"
			></mux-player>

			{#if activePoint}
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="pause-overlay"
					role="dialog"
					aria-labelledby="{wrapperId}-prompt"
					aria-modal="false"
					tabindex="-1"
					onkeydown={onOverlayKeydown}
					style="--pause-accent: {accentColor}; --pause-on-accent: {onAccent};"
				>
					<div class="pause-card">
						<p class="pause-eyebrow">Pause</p>
						<p class="pause-prompt" id="{wrapperId}-prompt">
							{activePoint.prompt || 'Take a moment before you go on.'}
						</p>
						<button bind:this={continueButton} type="button" class="pause-continue" onclick={resume}>
							Continue
						</button>
					</div>
				</div>
			{/if}
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

<style>
	.player-frame {
		position: relative;
	}

	/* Covers the picture but leaves the control bar free, so the viewer can always scrub or press play. */
	.pause-overlay {
		position: absolute;
		inset: 0 0 4.25rem 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		background: rgb(10 10 10 / 0.62);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		animation: pause-in 480ms ease-out both;
		z-index: 2;
	}

	.pause-card {
		max-width: 34rem;
		text-align: center;
		color: #fff;
		animation: pause-rise 600ms 120ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}

	.pause-eyebrow {
		margin: 0 0 0.75rem;
		font-size: 0.75rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		opacity: 0.7;
	}

	.pause-prompt {
		margin: 0 0 1.5rem;
		font-family: var(--pp-display-font, Georgia, 'Times New Roman', serif);
		font-size: clamp(1.15rem, 2.6vw, 1.75rem);
		line-height: 1.4;
		text-wrap: balance;
	}

	.pause-continue {
		padding: 0.6rem 1.6rem;
		border: 0;
		border-radius: 999px;
		background: var(--pause-accent);
		color: var(--pause-on-accent);
		font-weight: 600;
		cursor: pointer;
	}

	.pause-continue:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 3px;
	}

	@keyframes pause-in {
		from { opacity: 0; }
	}

	@keyframes pause-rise {
		from { opacity: 0; transform: translateY(0.5rem); }
	}

	@media (prefers-reduced-motion: reduce) {
		.pause-overlay,
		.pause-card {
			animation: none;
		}
		.pause-overlay {
			-webkit-backdrop-filter: none;
			backdrop-filter: none;
			background: rgb(10 10 10 / 0.8);
		}
	}
</style>
