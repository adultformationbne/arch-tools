<script lang="ts">
	import { Loader2 } from '$lib/icons';

	let {
		show = false,
		message = 'Processing...',
		subMessage = ''
	} = $props();
</script>

{#if show}
	<div class="loading-overlay" role="dialog" aria-modal="true" aria-label={message}>
		<div class="loading-content">
			<div class="spinner-container">
				<Loader2 class="spinner" />
			</div>
			<h2 class="loading-message">{message}</h2>
			{#if subMessage}
				<p class="loading-submessage">{subMessage}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.loading-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.loading-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 2rem;
		text-align: center;
	}

	.spinner-container {
		margin-bottom: 1.5rem;
	}

	.spinner-container :global(.spinner) {
		width: 3rem;
		height: 3rem;
		color: white;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.loading-message {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: white;
	}

	.loading-submessage {
		margin: 0.5rem 0 0;
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.8);
	}
</style>
