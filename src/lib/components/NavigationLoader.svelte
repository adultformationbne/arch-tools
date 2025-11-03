<script>
	import { navigating } from '$app/stores';

	// Reactive state for progress animation
	let progress = $state(0);
	let visible = $state(false);
	let progressInterval;

	// Watch for navigation changes
	$effect(() => {
		if ($navigating) {
			// Navigation started
			visible = true;
			progress = 0;

			// Animate progress bar (fake progress for better UX)
			progressInterval = setInterval(() => {
				if (progress < 90) {
					// Slow down as we approach 90%
					const increment = Math.max(0.5, (90 - progress) / 10);
					progress = Math.min(90, progress + increment);
				}
			}, 100);
		} else if (visible) {
			// Navigation completed
			progress = 100;

			// Hide after animation completes
			setTimeout(() => {
				visible = false;
				progress = 0;
			}, 200);

			// Clear interval
			if (progressInterval) {
				clearInterval(progressInterval);
				progressInterval = null;
			}
		}

		// Cleanup on unmount
		return () => {
			if (progressInterval) {
				clearInterval(progressInterval);
			}
		};
	});
</script>

{#if visible}
	<div class="fixed left-0 right-0 top-0 z-50 h-1 bg-gray-200">
		<div class="progress-bar transition-all duration-200 ease-out" style="width: {progress}%;"></div>
	</div>
{/if}

<style>
	.progress-bar {
		height: 100%;
		background: linear-gradient(90deg, #000 0%, #666 25%, #fff 50%, #666 75%, #000 100%);
		background-size: 200% 100%;
		animation: shimmer 3s linear infinite;
		box-shadow: 0 0 8px rgba(0, 0, 0, 0.3);
	}

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>
