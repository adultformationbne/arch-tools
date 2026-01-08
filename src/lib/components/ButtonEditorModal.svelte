<script>
	import { X } from 'lucide-svelte';
	import { normalizeUrl } from '$lib/utils/form-validator.js';

	let {
		show = false,
		buttonText = '',
		buttonUrl = '',
		onSave = () => {},
		onCancel = () => {},
		onRemove = null, // Optional: only show remove button if provided
		availableVariables = [] // For showing variable suggestions
	} = $props();

	let text = $state(buttonText);
	let url = $state(buttonUrl);
	let textInput = $state(null);

	// Reset when modal opens
	$effect(() => {
		if (show) {
			text = buttonText;
			url = buttonUrl;
			// Focus input after modal renders
			setTimeout(() => textInput?.focus(), 100);
		}
	});

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
			// Cmd/Ctrl + Enter to save
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
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
		onmousedown={(e) => e.target === e.currentTarget && onCancel()}
		onkeydown={(e) => e.key === 'Escape' && onCancel()}
		role="presentation"
	>
		<div
			class="max-h-[95vh] w-full max-w-md overflow-auto rounded-xl bg-white shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleKeydown}
			role="dialog"
			aria-modal="true"
			aria-labelledby="button-modal-title"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 p-6">
				<h2 id="button-modal-title" class="text-xl font-semibold text-gray-900">
					{buttonText ? 'Edit Button' : 'Insert Button'}
				</h2>
				<button
					onclick={onCancel}
					class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
					aria-label="Close modal"
				>
					<X class="h-5 w-5" />
				</button>
			</div>

			<!-- Body -->
			<div class="p-6 space-y-4">
				<div>
					<label for="button-text" class="mb-2 block text-sm font-medium text-gray-700">
						Button Text
					</label>
					<input
						id="button-text"
						bind:this={textInput}
						type="text"
						bind:value={text}
						placeholder="Click here"
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
				</div>

				<div>
					<label for="button-url" class="mb-2 block text-sm font-medium text-gray-700">
						Button URL
					</label>
					<input
						id="button-url"
						type="text"
						bind:value={url}
						placeholder="example.com or {`{{variableName}}`}"
						class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>
					<p class="mt-2 text-xs text-gray-500">
						https:// added automatically. Use {'{{variableName}}'} for dynamic links.
					</p>
				</div>

				{#if availableVariables.length > 0}
					<div>
						<p class="mb-2 text-xs font-medium text-gray-600">Quick Insert Variables:</p>
						<div class="flex flex-wrap gap-2">
							{#each availableVariables.slice(0, 6) as variable}
								<button
									type="button"
									onclick={() => insertVariable(variable.name)}
									class="inline-flex items-center rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
									title={variable.description}
								>
									{variable.name}
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
				{#if onRemove}
					<button
						onclick={onRemove}
						class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
					>
						Remove Button
					</button>
				{/if}
				<div class="flex-1"></div>
				<button
					onclick={onCancel}
					class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={!text.trim() || !url.trim()}
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{buttonText ? 'Update' : 'Insert'}
				</button>
			</div>
		</div>
	</div>
{/if}
