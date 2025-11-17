<script>
	import { navigating } from '$app/stores';
	import { Loader2 } from 'lucide-svelte';
</script>

{#if $navigating}
	<div class="loading-bar">
		<div class="loading-progress"></div>
	</div>
{/if}

<style>
	.loading-bar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		background: transparent;
		z-index: 9999;
		pointer-events: none;
	}

	.loading-progress {
		height: 100%;
		background: linear-gradient(
			90deg,
			var(--course-accent-light, #c59a6b) 0%,
			var(--course-accent-dark, #334642) 100%
		);
		width: 0%;
		animation: loading 1s ease-in-out infinite;
	}

	@keyframes loading {
		0% {
			width: 0%;
		}
		50% {
			width: 70%;
		}
		100% {
			width: 100%;
		}
	}
</style>
