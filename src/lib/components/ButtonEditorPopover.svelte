<script>
	import { onMount } from 'svelte';
	import { computePosition, flip, shift, offset, arrow } from '@floating-ui/dom';
	import { X } from '$lib/icons';
	import { normalizeUrl } from '$lib/utils/form-validator.js';

	let {
		show = false,
		buttonText = '',
		buttonUrl = '',
		anchorElement = null,
		onSave = () => {},
		onCancel = () => {},
		onRemove = null,
		availableVariables = []
	} = $props();

	let text = $state('');
	let url = $state('');
	let popoverElement = $state(null);
	let textInput = $state(null);
	let arrowElement = $state(null);

	// Reset when modal opens
	$effect(() => {
		if (show) {
			text = buttonText;
			url = buttonUrl;
			// Focus input and update position after popover renders
			setTimeout(() => {
				textInput?.focus();
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
		const trimmedText = text.trim();
		const trimmedUrl = url.trim();

		if (trimmedText && trimmedUrl) {
			// Only normalize if it doesn't contain template variables
			const normalizedUrl = trimmedUrl.includes('{{') ? trimmedUrl : normalizeUrl(trimmedUrl);
			onSave(trimmedText, normalizedUrl);
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' && e.metaKey) {
			e.preventDefault();
			handleSave();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			onCancel();
		}
	}

	function insertVariable(varName) {
		url = url + `{{${varName}}}`;
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
		class="button-popover"
		onclick={(e) => e.stopPropagation()}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="button-popover-title"
		tabindex="-1"
	>
		<!-- Arrow -->
		<div bind:this={arrowElement} class="popover-arrow"></div>

		<!-- Header -->
		<div class="popover-header">
			<h3 id="button-popover-title" class="popover-title">
				{buttonText ? 'Edit Button' : 'Insert Button'}
			</h3>
			<button onclick={onCancel} class="popover-close" aria-label="Close">
				<X size={16} />
			</button>
		</div>

		<!-- Body -->
		<div class="popover-body">
			<div class="mb-3">
				<label for="button-text-input" class="popover-label">Button Text</label>
				<input
					id="button-text-input"
					bind:this={textInput}
					type="text"
					bind:value={text}
					placeholder="Click here"
					class="popover-input"
				/>
			</div>

			<div class="mb-3">
				<label for="button-url-input" class="popover-label">Button URL</label>
				<input
					id="button-url-input"
					type="text"
					bind:value={url}
					placeholder="example.com or https://example.com"
					class="popover-input"
				/>
				<p class="popover-hint">Use {`{{variableName}}`} for dynamic links</p>
			</div>

			{#if availableVariables.length > 0}
				<div>
					<p class="popover-label mb-2">Quick Insert:</p>
					<div class="variable-pills">
						{#each availableVariables as variable}
							<button
								type="button"
								onclick={() => insertVariable(variable.name)}
								class="variable-pill"
								title={variable.description}
							>
								{`{{${variable.name}}}`}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="popover-footer">
			{#if onRemove}
				<button onclick={onRemove} class="btn-remove">Remove</button>
			{/if}
			<div class="flex-1"></div>
			<button onclick={onCancel} class="btn-secondary-sm">Cancel</button>
			<button
				onclick={handleSave}
				disabled={!text.trim() || !url.trim()}
				class="btn-primary-sm"
			>
				{buttonText ? 'Update' : 'Insert'}
			</button>
		</div>
	</div>
{/if}

<style>
	.button-popover {
		position: absolute;
		z-index: 50;
		width: 340px;
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

	.popover-hint {
		margin-top: 4px;
		font-size: 11px;
		color: #6b7280;
	}

	.variable-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.variable-pill {
		padding: 4px 8px;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: all 0.15s;
	}

	.variable-pill:hover {
		background: #dbeafe;
		border-color: #93c5fd;
		color: #1e40af;
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

	.btn-primary-sm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.mb-2 {
		margin-bottom: 8px;
	}

	.mb-3 {
		margin-bottom: 12px;
	}

	.flex-1 {
		flex: 1;
	}
</style>
