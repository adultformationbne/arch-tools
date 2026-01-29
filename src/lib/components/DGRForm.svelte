<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { extractGospelReference } from '$lib/utils/scripture.js';
	import { formatDGRDate } from '$lib/utils/dgr-common.js';

	// Props
	let {
		formData = $bindable(),
		publishing = $bindable(false),
		result = $bindable(null),
		useNewDesign = $bindable(true),
		fetchingGospel = $bindable(false),
		gospelFullText = $bindable(''),
		gospelReference = $bindable(''),
		onPasteFromWord = () => {}
	} = $props();

	/** @param {string} dateStr */
	function formatDateDisplay(dateStr) {
		if (!dateStr) return '';
		return formatDGRDate(dateStr + 'T00:00:00');
	}
</script>

<div class="space-y-4">
	<!-- Header Actions -->
	<div class="space-y-4">
		<div class="flex gap-2">
			<button
				type="button"
				onclick={onPasteFromWord}
				class="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
			>
				Paste from Word
			</button>
		</div>

		<div class="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
			<label class="flex items-center cursor-pointer">
				<input
					type="checkbox"
					bind:checked={useNewDesign}
					class="mr-2 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
				/>
				<span class="text-xs font-medium text-gray-700">
					Use new design
				</span>
			</label>
		</div>
	</div>

	<div class="space-y-4">
		<!-- Date & Basic Info -->
		<div class="space-y-3 rounded-lg bg-white p-4 shadow-sm border">
			<h3 class="text-sm font-semibold text-gray-800">Details</h3>

			<div>
				<label for="dgr-date" class="mb-1 block text-xs font-medium text-gray-700">Date</label>
				<input
					id="dgr-date"
					type="date"
					bind:value={formData.date}
					required
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-xs text-gray-500">
					{formatDateDisplay(formData.date)}
				</p>
			</div>

			<div>
				<label for="dgr-liturgical-date" class="mb-1 block text-xs font-medium text-gray-700">Liturgical Date</label>
				<input
					id="dgr-liturgical-date"
					type="text"
					bind:value={formData.liturgicalDate}
					placeholder="e.g., Memorial St Augustine"
					required
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="dgr-readings" class="mb-1 block text-xs font-medium text-gray-700">Readings</label>
				<textarea
					id="dgr-readings"
					bind:value={formData.readings}
					placeholder="e.g., 1 Thess 3:7-13; Ps 89:3-4, 12-14, 17; Mt 24:42-51"
					required
					rows="2"
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				></textarea>
			</div>

			<div>
				<label for="dgr-title" class="mb-1 block text-xs font-medium text-gray-700">Title</label>
				<input
					id="dgr-title"
					type="text"
					bind:value={formData.title}
					placeholder="e.g., Faithful and Wise Servant"
					required
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label for="dgr-author" class="mb-1 block text-xs font-medium text-gray-700">Author</label>
				<input
					id="dgr-author"
					type="text"
					bind:value={formData.authorName}
					placeholder="e.g., Sr. Theresa Maria Dao, SPC"
					required
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>
		</div>

		<!-- Gospel Content -->
		<div class="space-y-3 rounded-lg bg-white p-4 shadow-sm border">
			<h3 class="text-sm font-semibold text-gray-800">Gospel</h3>

			{#if gospelReference}
				<div class="rounded-lg bg-green-50 p-3 border border-green-200">
					<div class="flex items-center justify-between mb-2">
						<h4 class="text-xs font-semibold text-green-900">Gospel Reading</h4>
						<span class="text-xs text-green-600">
							{fetchingGospel ? 'Loading...' : 'Auto-loaded'}
						</span>
					</div>
					<p class="text-xs text-green-800 font-medium mb-2">
						{gospelReference}
					</p>
					{#if gospelFullText}
						<div class="bg-white p-2 rounded border border-green-100 max-h-32 overflow-y-auto">
							<div class="text-xs text-gray-700">
								{@html gospelFullText}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<div>
				<label for="dgr-gospel-quote" class="mb-1 block text-xs font-medium text-gray-700">Gospel Quote</label>
				<textarea
					id="dgr-gospel-quote"
					bind:value={formData.gospelQuote}
					placeholder="Enter the specific gospel quote chosen by the author..."
					rows="3"
					required
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				></textarea>
			</div>
		</div>

		<!-- Reflection -->
		<div class="space-y-3 rounded-lg bg-white p-4 shadow-sm border">
			<h3 class="text-sm font-semibold text-gray-800">Reflection</h3>

			<div>
				<label for="dgr-reflection" class="mb-1 block text-xs font-medium text-gray-700">Reflection Text</label>
				<textarea
					id="dgr-reflection"
					bind:value={formData.reflectionText}
					placeholder="Enter the reflection text (separate paragraphs with blank lines)..."
					rows="8"
					required
					class="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
				></textarea>
			</div>
		</div>

	</div>

	<!-- Result Display -->
	{#if result}
		<div
			class="rounded-lg p-3 text-sm {result.success
				? 'border border-green-200 bg-green-50'
				: 'border border-red-200 bg-red-50'}"
		>
			{#if result.success}
				<div class="flex items-center text-green-800">
					<svg class="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						></path>
					</svg>
					<span class="font-medium">Published!</span>
					<a href={result.link} target="_blank" class="ml-2 underline hover:no-underline">
						View
					</a>
				</div>
			{:else}
				<div class="flex items-center text-red-800">
					<svg class="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						></path>
					</svg>
					<span class="font-medium">Error:</span>
					<span class="ml-1">{result.error}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>
