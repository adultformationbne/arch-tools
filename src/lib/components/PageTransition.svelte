<script>
	import { navigating } from '$app/stores';

	// Show skeleton after a short delay to avoid flash on fast navigations
	let showSkeleton = $state(false);
	let timeoutId;

	$effect(() => {
		if ($navigating) {
			// Wait 150ms before showing skeleton (avoids flash on fast loads)
			timeoutId = setTimeout(() => {
				showSkeleton = true;
			}, 150);
		} else {
			// Clear timeout and hide skeleton immediately
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			showSkeleton = false;
		}

		return () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
	});
</script>

{#if showSkeleton}
	<div class="fixed inset-0 z-40 bg-gray-50/80 backdrop-blur-sm">
		<div class="mx-auto max-w-7xl p-6 pt-24">
			<!-- Page header skeleton -->
			<div class="mb-8 space-y-3">
				<div class="skeleton h-8 w-1/3"></div>
				<div class="skeleton h-4 w-1/2"></div>
			</div>

			<!-- Content skeleton -->
			<div class="space-y-4">
				<div class="skeleton h-32 w-full"></div>
				<div class="skeleton h-32 w-full"></div>
				<div class="skeleton h-32 w-full"></div>
			</div>
		</div>
	</div>
{/if}

<style>
	.skeleton {
		background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
		background-size: 200% 100%;
		animation: loading 1.5s ease-in-out infinite;
		border-radius: 0.5rem;
	}

	@keyframes loading {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}
</style>
