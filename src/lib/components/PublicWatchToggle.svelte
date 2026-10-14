<script>
	/**
	 * "Make available at a public link" for a Mux video (hub-leader courses).
	 *
	 * Saves as soon as it is ticked, like the pause points editor. Once it is on, the
	 * link is shown to copy; leaders also get a Copy link button next to the video on
	 * their own page. The page it opens shows only this video and a link to the
	 * Companion Guide, so people cannot skip ahead to other sessions.
	 */
	import { apiPut } from '$lib/utils/api-handler.js';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';

	let { material, onSaved = () => {} } = $props();

	let enabled = $state(!!material.publicWatchEnabled);
	let saving = $state(false);

	const path = $derived(`/p/watch/${material.id}`);
	const link = $derived(typeof window === 'undefined' ? path : `${window.location.origin}${path}`);

	/** @param {Event & { currentTarget: HTMLInputElement }} event */
	async function toggle(event) {
		const input = event.currentTarget;
		const next = input.checked;
		saving = true;
		try {
			await apiPut(
				'/api/courses/module-materials',
				{ id: material.id, public_watch_enabled: next },
				{ successMessage: next ? 'Public link is on' : 'Public link is off' }
			);
			enabled = next;
			onSaved(next);
		} catch {
			// apiPut has already shown the error toast; put the box back
			input.checked = enabled;
		} finally {
			saving = false;
		}
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			toastSuccess('Link copied');
		} catch {
			toastError('Could not copy the link');
		}
	}
</script>

<div class="mt-4 max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-3">
	<label class="flex items-start gap-2 cursor-pointer">
		<input
			type="checkbox"
			checked={enabled}
			disabled={saving}
			onchange={toggle}
			class="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
		/>
		<span>
			<span class="block text-sm font-semibold text-gray-800">Make available at a public link</span>
			<span class="block text-xs text-gray-500">
				Anyone with the link can watch this video without signing in. The page shows only this video and a link
				to the Companion Guide.
			</span>
		</span>
	</label>

	{#if enabled}
		<div class="mt-3 flex items-center gap-2">
			<input
				type="text"
				readonly
				value={link}
				onfocus={(e) => e.currentTarget.select()}
				class="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700"
				aria-label="Public link to this video"
			/>
			<button
				type="button"
				onclick={copy}
				class="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
			>
				Copy link
			</button>
		</div>
	{/if}
</div>
