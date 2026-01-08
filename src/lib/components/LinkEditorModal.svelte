<script>
	import { X } from 'lucide-svelte';
	import { normalizeUrl } from '$lib/utils/form-validator.js';

	let {
		show = false,
		url = '',
		onSave = () => {},
		onCancel = () => {},
		onRemove = null // Optional: only show remove button if provided
	} = $props();

	let editUrl = $state(url);
	let urlInput = $state(null);

	// Reset when modal opens
	$effect(() => {
		if (show) {
			editUrl = url;
			// Focus input after modal renders
			setTimeout(() => urlInput?.focus(), 100);
		}
	});

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
			aria-labelledby="link-modal-title"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 p-6">
				<h2 id="link-modal-title" class="text-xl font-semibold text-gray-900">
					{url ? 'Edit Link' : 'Add Link'}
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
			<div class="p-6">
				<label for="link-url" class="mb-2 block text-sm font-medium text-gray-700">
					URL
				</label>
				<input
					id="link-url"
					bind:this={urlInput}
					type="text"
					bind:value={editUrl}
					placeholder="example.com or https://example.com"
					class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
				/>
				<p class="mt-2 text-xs text-gray-500">
					https:// will be added automatically if not provided
				</p>
			</div>

			<!-- Footer -->
			<div class="flex gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
				{#if onRemove}
					<button
						onclick={onRemove}
						class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
					>
						Remove Link
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
					class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
				>
					{url ? 'Update' : 'Add'} Link
				</button>
			</div>
		</div>
	</div>
{/if}
