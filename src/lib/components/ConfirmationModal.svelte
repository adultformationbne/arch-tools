<script>
	import { X, Loader2 } from 'lucide-svelte';

	let {
		show = false,
		title = 'Confirm Action',
		loading = false,
		loadingMessage = 'Processing...',
		confirmText = 'Confirm',
		confirmIcon = null,
		cancelText = 'Cancel',
		onConfirm = () => {},
		onCancel = () => {},
		children
	} = $props();

	function handleOverlayClick() {
		if (!loading) {
			onCancel();
		}
	}
</script>

{#if show}
	<div class="modal-overlay" onclick={handleOverlayClick}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			{#if loading}
				<div class="modal-loading">
					<Loader2 size={48} class="spinner" />
					<h3>{loadingMessage}</h3>
				</div>
			{:else}
				<div class="modal-header">
					<h3>{title}</h3>
					<button onclick={onCancel} class="modal-close">
						<X size={20} />
					</button>
				</div>
				<div class="modal-body">
					{@render children()}
				</div>
				<div class="modal-actions">
					<button onclick={onCancel} class="btn-secondary">
						{cancelText}
					</button>
					<button onclick={onConfirm} class="btn-primary">
						{#if confirmIcon}
							<svelte:component this={confirmIcon} size={18} />
						{/if}
						<span>{confirmText}</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.modal-content {
		background: rgba(30, 35, 34, 0.98);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 16px;
		width: 90%;
		max-width: 600px;
		box-shadow: 0 24px 48px rgba(0, 0, 0, 0.5);
		animation: slideUp 0.3s ease;
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.modal-loading {
		padding: 48px 32px;
		text-align: center;
	}

	.modal-loading :global(.spinner) {
		animation: spin 1s linear infinite;
		color: var(--accf-accent, #c59a6b);
		margin: 0 auto 24px;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.modal-loading h3 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: white;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px 24px 20px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.modal-header h3 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: white;
	}

	.modal-close {
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.7);
		cursor: pointer;
		padding: 4px;
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.modal-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.modal-body {
		padding: 24px;
	}

	.modal-body :global(p) {
		margin: 0 0 16px 0;
		color: rgba(255, 255, 255, 0.8);
		font-size: 0.9375rem;
		line-height: 1.6;
	}

	.modal-body :global(p:last-child) {
		margin-bottom: 0;
	}

	.modal-body :global(strong) {
		color: white;
		font-weight: 600;
	}

	.modal-body :global(.modal-note) {
		background: rgba(197, 154, 107, 0.1);
		border-left: 3px solid var(--accf-accent, #c59a6b);
		padding: 12px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		padding: 20px 24px 24px;
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.btn-secondary {
		flex: 1;
		padding: 12px 20px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 10px;
		color: white;
		font-weight: 600;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.btn-primary {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 20px;
		background: var(--accf-accent, #c59a6b);
		border: none;
		border-radius: 10px;
		color: var(--accf-darkest, #1e2322);
		font-weight: 700;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.btn-primary:hover {
		background: #d4a876;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(197, 154, 107, 0.3);
	}

	@media (max-width: 768px) {
		.modal-content {
			margin: 20px;
		}

		.modal-actions {
			flex-direction: column;
		}

		.btn-secondary,
		.btn-primary {
			width: 100%;
		}
	}
</style>