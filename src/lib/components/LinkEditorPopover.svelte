<script>
	import { onMount } from 'svelte';
	import { computePosition, flip, shift, offset, arrow } from '@floating-ui/dom';
	import { X } from '$lib/icons';
	import { normalizeUrl } from '$lib/utils/form-validator.js';

	let {
		show = false,
		url = '',
		anchorElement = null,
		onSave = () => {},
		onCancel = () => {},
		onRemove = null
	} = $props();

	let editUrl = $state('');
	let popoverElement = $state(null);
	let urlInput = $state(null);
	let arrowElement = $state(null);

	// Reset when modal opens
	$effect(() => {
		if (show) {
			editUrl = url;
			// Focus input and update position after popover renders
			setTimeout(() => {
				urlInput?.focus();
				updatePosition();
			}, 10);
		}
	});

	async function updatePosition() {
		if (!popoverElement || !anchorElement) return;

		const { x, y, placement, middlewareData } = await computePosition(anchorElement, popoverElement, {
			placement: 'bottom',
			middleware: [
				offset(8),
				flip(),
				shift({ padding: 8 }),
				arrow({ element: arrowElement })
			]
		});

		Object.assign(popoverElement.style, {
			left: `${x}px`,
			top: `${y}px`
		});

		// Position arrow
		if (middlewareData.arrow && arrowElement) {
			const { x: arrowX, y: arrowY } = middlewareData.arrow;
			const staticSide = {
				top: 'bottom',
				right: 'left',
				bottom: 'top',
				left: 'right'
			}[placement.split('-')[0]];

			Object.assign(arrowElement.style, {
				left: arrowX != null ? `${arrowX}px` : '',
				top: arrowY != null ? `${arrowY}px` : '',
				right: '',
				bottom: '',
				[staticSide]: '-4px'
			});
		}
	}

	function handleSave() {
		const trimmedUrl = editUrl.trim();
		if (trimmedUrl) {
			onSave(normalizeUrl(trimmedUrl));
		} else {
			onCancel();
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSave();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}
</script>

{#if show}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-40"
		onclick={onCancel}
		onkeydown={(e) => e.key === 'Enter' && onCancel()}
		role="presentation"
	></div>

	<!-- Popover -->
	<div
		bind:this={popoverElement}
		class="link-popover"
		onclick={(e) => e.stopPropagation()}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="link-popover-title"
		tabindex="-1"
	>
		<!-- Arrow -->
		<div bind:this={arrowElement} class="popover-arrow"></div>

		<!-- Header -->
		<div class="popover-header">
			<h3 id="link-popover-title" class="popover-title">
				{url ? 'Edit Link' : 'Add Link'}
			</h3>
			<button onclick={onCancel} class="popover-close" aria-label="Close">
				<X size={16} />
			</button>
		</div>

		<!-- Body -->
		<div class="popover-body">
			<label for="link-url-input" class="popover-label">URL</label>
			<input
				id="link-url-input"
				bind:this={urlInput}
				type="text"
				bind:value={editUrl}
				placeholder="example.com or https://example.com"
				class="popover-input"
			/>
		</div>

		<!-- Footer -->
		<div class="popover-footer">
			{#if onRemove}
				<button onclick={onRemove} class="btn-remove">Remove</button>
			{/if}
			<div class="flex-1"></div>
			<button onclick={onCancel} class="btn-secondary-sm">Cancel</button>
			<button onclick={handleSave} class="btn-primary-sm">
				{url ? 'Update' : 'Add'}
			</button>
		</div>
	</div>
{/if}

<style>
	.link-popover {
		position: absolute;
		z-index: 50;
		width: 320px;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
		animation: popIn 0.15s ease-out;
	}

	@keyframes popIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(-4px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.popover-arrow {
		position: absolute;
		width: 8px;
		height: 8px;
		background: white;
		border: 1px solid #e5e7eb;
		transform: rotate(45deg);
		z-index: -1;
	}

	.popover-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 14px;
		border-bottom: 1px solid #f3f4f6;
	}

	.popover-title {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #111827;
	}

	.popover-close {
		background: none;
		border: none;
		color: #6b7280;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}

	.popover-close:hover {
		background: #f3f4f6;
		color: #111827;
	}

	.popover-body {
		padding: 14px;
	}

	.popover-label {
		display: block;
		margin-bottom: 6px;
		font-size: 12px;
		font-weight: 500;
		color: #374151;
	}

	.popover-input {
		width: 100%;
		padding: 8px 10px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 13px;
		transition: all 0.15s;
	}

	.popover-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.popover-footer {
		display: flex;
		gap: 8px;
		padding: 12px 14px;
		border-top: 1px solid #f3f4f6;
		background: #fafafa;
		border-radius: 0 0 12px 12px;
	}

	.btn-remove {
		padding: 6px 12px;
		border: 1px solid #fca5a5;
		background: white;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		color: #dc2626;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-remove:hover {
		background: #fef2f2;
	}

	.btn-secondary-sm {
		padding: 6px 12px;
		border: 1px solid #d1d5db;
		background: white;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-secondary-sm:hover {
		background: #f9fafb;
	}

	.btn-primary-sm {
		padding: 6px 16px;
		border: none;
		background: #3b82f6;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		color: white;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-primary-sm:hover {
		background: #2563eb;
	}

	.flex-1 {
		flex: 1;
	}
</style>
