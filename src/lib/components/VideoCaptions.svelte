<script>
	/**
	 * Captions panel for a Mux video in the material editor.
	 *
	 * New uploads get automatic captions, and Mux Player shows captions by default. Automatic
	 * captions mishear names and theological terms, so the fix is: download the .vtt, correct
	 * the words (keep the timings), and upload it back. The corrected file replaces the
	 * automatic one.
	 */
	import { onMount } from 'svelte';
	import { apiGet, apiPost } from '$lib/utils/api-handler.js';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import { Download, Upload, Loader2, RefreshCw } from '$lib/icons';

	let { material } = $props();

	/** @typedef {{ id: string, name: string, source: string, status: string, vttUrl: string | null }} Track */
	let tracks = $state(/** @type {Track[] | null} */ (null));
	let busy = $state(false);
	/** @type {HTMLInputElement | undefined} */
	let fileInput = $state();
	/** @type {ReturnType<typeof setTimeout> | undefined} */
	let pollTimer;

	const preparing = $derived(tracks?.some((t) => t.status === 'preparing') ?? false);
	const ready = $derived(tracks?.find((t) => t.status === 'ready') ?? null);
	const errored = $derived(!ready && !preparing && (tracks?.some((t) => t.status === 'errored') ?? false));

	/** @param {{ tracks: any[] }} result */
	function apply(result) {
		tracks = result.tracks;
		clearTimeout(pollTimer);
		if (tracks.some((t) => t.status === 'preparing')) pollTimer = setTimeout(load, 15000);
	}

	async function load() {
		try {
			apply(await apiGet(`/api/courses/mux/captions?material_id=${material.id}`, { showToast: false }));
		} catch {
			tracks = tracks ?? [];
		}
	}

	async function generate() {
		busy = true;
		try {
			apply(
				await apiPost(
					'/api/courses/mux/captions',
					{ material_id: material.id, action: 'generate' },
					{ loadingMessage: 'Asking Mux for captions...', successMessage: 'Captions are being generated (a few minutes)' }
				)
			);
		} catch {
			// toast already shown
		} finally {
			busy = false;
		}
	}

	/** @param {Event & { currentTarget: HTMLInputElement }} event */
	async function upload(event) {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (!file) return;
		if (!/\.(vtt|srt)$/i.test(file.name)) {
			toastError('Choose a .vtt or .srt caption file');
			return;
		}
		busy = true;
		try {
			apply(
				await apiPost(
					'/api/courses/mux/captions',
					{ material_id: material.id, action: 'upload', text: await file.text() },
					{ loadingMessage: 'Uploading captions...', successMessage: 'Corrected captions uploaded' }
				)
			);
		} catch {
			// toast already shown
		} finally {
			busy = false;
		}
	}

	onMount(() => {
		load();
		return () => clearTimeout(pollTimer);
	});
</script>

<div class="mt-3 max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-3">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div>
			<span class="block text-sm font-semibold text-gray-800">Captions</span>
			<span class="block text-xs text-gray-500">
				{#if tracks === null}
					Checking...
				{:else if preparing}
					Being prepared by Mux. This takes a few minutes.
				{:else if ready && ready.source === 'generated'}
					Automatic captions are on. Download them, fix any misheard words, and upload the corrected file.
				{:else if ready}
					Corrected captions are on.
				{:else if errored}
					Mux could not process the captions. Upload the file again or generate automatic captions.
				{:else}
					This video has no captions yet.
				{/if}
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if preparing || busy}
				<Loader2 size="16" class="animate-spin text-gray-400" />
			{/if}
			{#if ready?.vttUrl}
				<a
					href={ready.vttUrl}
					download
					class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
				>
					<Download size="14" /> Download .vtt
				</a>
			{/if}
			{#if tracks !== null && !ready && !preparing}
				<button
					type="button"
					onclick={generate}
					disabled={busy}
					class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
				>
					<RefreshCw size="14" /> Generate automatic captions
				</button>
			{/if}
			{#if tracks !== null && !preparing}
				<button
					type="button"
					onclick={() => fileInput?.click()}
					disabled={busy}
					class="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
				>
					<Upload size="14" /> Upload corrected file
				</button>
				<input bind:this={fileInput} type="file" accept=".vtt,.srt" class="hidden" onchange={upload} />
			{/if}
		</div>
	</div>
</div>
