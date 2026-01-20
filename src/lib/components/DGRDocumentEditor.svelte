<script>
	import { Clock, FileText, ChevronDown, Pencil, Eye, EyeOff } from '$lib/icons';
	import { formatReading } from '$lib/utils/dgr-helpers';

	let {
		// Bindable form fields
		title = $bindable(''),
		gospelQuote = $bindable(''),
		content = $bindable(''),

		// Readings display
		readings = null,
		gospelText = null,
		loadingReadings = false,
		loadingGospelText = false,

		// Callbacks
		onchange = () => {},
		onEditReadings = null,

		// Options
		showWordCount = true,
		readonly = false,
		wordCountTarget = 250
	} = $props();

	// Auto-resize textarea refs
	let textareaEl = $state(null);
	let quoteTextareaEl = $state(null);

	// Mobile readings toggle
	let readingsExpanded = $state(false);

	// Desktop gospel text visibility toggle
	let gospelTextVisible = $state(true);

	// Auto-resize textarea to fit content
	function autoResize(el) {
		if (el) {
			el.style.height = 'auto';
			el.style.height = el.scrollHeight + 'px';
		}
	}

	// Resize on content change
	$effect(() => {
		if (content !== undefined && textareaEl) {
			requestAnimationFrame(() => autoResize(textareaEl));
		}
	});

	// Resize quote on change
	$effect(() => {
		if (gospelQuote !== undefined && quoteTextareaEl) {
			requestAnimationFrame(() => autoResize(quoteTextareaEl));
		}
	});

	// Word count
	let wordCount = $derived(content?.trim() ? content.trim().split(/\s+/).length : 0);

	function handleChange() {
		onchange();
	}
</script>

<div class="rounded-lg bg-white shadow-sm">
	<!-- Readings Section -->
	{#if readings}
		<!-- Mobile: Collapsible readings -->
		<div class="border-b border-gray-100 md:hidden">
			<button
				onclick={() => readingsExpanded = !readingsExpanded}
				class="flex w-full items-center justify-between px-4 py-3"
				type="button"
			>
				<div class="flex items-center gap-2 min-w-0">
					<FileText class="h-4 w-4 text-indigo-500 shrink-0" />
					<span class="font-medium text-gray-900 truncate">
						{formatReading(readings.gospel_reading) || 'Readings'}{#if readings.liturgical_day} · {readings.liturgical_day}{/if}
					</span>
				</div>
				<ChevronDown class="h-4 w-4 text-gray-400 shrink-0 transition-transform {readingsExpanded ? 'rotate-180' : ''}" />
			</button>

			{#if readingsExpanded}
				<div class="border-t border-gray-100 px-4 py-3 space-y-3">
					<!-- All readings -->
					<div class="space-y-1.5 text-sm">
						{#if readings.first_reading}
							<div class="flex gap-2">
								<span class="text-gray-400 w-12 shrink-0">1st:</span>
								<span class="text-gray-700">{formatReading(readings.first_reading)}</span>
							</div>
						{/if}
						{#if readings.psalm}
							<div class="flex gap-2">
								<span class="text-gray-400 w-12 shrink-0">Psalm:</span>
								<span class="text-gray-700">{formatReading(readings.psalm)}</span>
							</div>
						{/if}
						{#if readings.second_reading}
							<div class="flex gap-2">
								<span class="text-gray-400 w-12 shrink-0">2nd:</span>
								<span class="text-gray-700">{formatReading(readings.second_reading)}</span>
							</div>
						{/if}
						{#if readings.gospel_reading}
							<div class="flex gap-2">
								<span class="text-gray-400 w-12 shrink-0">Gospel:</span>
								<span class="text-gray-700 font-medium">{formatReading(readings.gospel_reading)}</span>
							</div>
						{/if}
					</div>

					<!-- Gospel text -->
					{#if gospelText}
						<div class="rounded-lg bg-indigo-50 p-3">
							<div class="prose prose-sm max-w-none text-gray-700">
								{@html gospelText}
							</div>
						</div>
					{:else if loadingGospelText}
						<div class="flex items-center gap-2 text-sm text-gray-500">
							<Clock class="h-4 w-4 animate-spin" />
							Loading Gospel text...
						</div>
					{/if}

					<!-- Edit button -->
					{#if onEditReadings}
						<button
							onclick={onEditReadings}
							class="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600"
							type="button"
						>
							<Pencil class="h-3 w-3" />
							Edit readings
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Desktop: Always expanded readings -->
		<div class="hidden md:block border-b border-gray-100 px-8 py-4">
			<!-- Header with actions -->
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-2 text-sm text-gray-600">
					<FileText class="h-4 w-4 text-indigo-500" />
					<span class="font-medium">{readings.liturgical_day || 'Readings'}</span>
				</div>
				<div class="flex items-center gap-3">
					{#if gospelText}
						<button
							onclick={() => gospelTextVisible = !gospelTextVisible}
							class="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600"
							type="button"
						>
							{#if gospelTextVisible}
								<EyeOff class="h-3 w-3" />
								Hide Gospel
							{:else}
								<Eye class="h-3 w-3" />
								Show Gospel
							{/if}
						</button>
					{/if}
					{#if onEditReadings}
						<button
							onclick={onEditReadings}
							class="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600"
							type="button"
						>
							<Pencil class="h-3 w-3" />
							Edit
						</button>
					{/if}
				</div>
			</div>

			<!-- All readings list -->
			<div class="grid grid-cols-2 gap-2 text-sm">
				{#if readings.first_reading}
					<div class="flex items-start gap-2">
						<span class="text-gray-400 shrink-0">1st:</span>
						<span class="text-gray-700">{formatReading(readings.first_reading)}</span>
					</div>
				{/if}
				{#if readings.psalm}
					<div class="flex items-start gap-2">
						<span class="text-gray-400 shrink-0">Psalm:</span>
						<span class="text-gray-700">{formatReading(readings.psalm)}</span>
					</div>
				{/if}
				{#if readings.second_reading}
					<div class="flex items-start gap-2">
						<span class="text-gray-400 shrink-0">2nd:</span>
						<span class="text-gray-700">{formatReading(readings.second_reading)}</span>
					</div>
				{/if}
				{#if readings.gospel_reading}
					<div class="flex items-start gap-2">
						<span class="text-gray-400 shrink-0">Gospel:</span>
						<span class="text-gray-700 font-medium">{formatReading(readings.gospel_reading)}</span>
					</div>
				{/if}
			</div>

			<!-- Gospel text (desktop) - toggleable -->
			{#if gospelText && gospelTextVisible}
				<div class="mt-3 rounded-lg bg-indigo-50 p-4">
					<div class="prose prose-sm max-w-none text-gray-700">
						{@html gospelText}
					</div>
				</div>
			{:else if loadingGospelText}
				<div class="mt-3 flex items-center gap-2 text-sm text-gray-500">
					<Clock class="h-4 w-4 animate-spin" />
					Loading Gospel text...
				</div>
			{/if}
		</div>
	{:else if loadingReadings}
		<div class="border-b border-gray-100 px-6 py-4 sm:px-8">
			<div class="flex items-center gap-2 text-sm text-gray-500">
				<Clock class="h-4 w-4 animate-spin" />
				Loading readings...
			</div>
		</div>
	{/if}

	<!-- Document-style Editor -->
	<div class="px-6 py-6 sm:px-8">
		<!-- Title -->
		<div class="mb-4">
			<span class="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">Title</span>
			<input
				type="text"
				bind:value={title}
				oninput={handleChange}
				placeholder="Enter a compelling title..."
				class="w-full border-0 bg-transparent text-2xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-3xl"
				disabled={readonly}
			/>
		</div>

		<!-- Gospel Quote -->
		<div class="mb-6">
			<span class="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">Gospel Quote</span>
			<textarea
				bind:this={quoteTextareaEl}
				bind:value={gospelQuote}
				oninput={() => { handleChange(); autoResize(quoteTextareaEl); }}
				placeholder={'"Quote from the Gospel" (Book 1:23)'}
				rows="1"
				class="w-full resize-none overflow-hidden border-0 bg-transparent text-base italic text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-lg"
				disabled={readonly}
			></textarea>
		</div>

		<!-- Main Content -->
		<div>
			<span class="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">Reflection</span>
			<textarea
				bind:this={textareaEl}
				bind:value={content}
				oninput={() => { handleChange(); autoResize(textareaEl); }}
				placeholder="Begin writing your reflection..."
				rows="12"
				class="w-full resize-none overflow-hidden border-0 bg-transparent text-base leading-relaxed text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-lg"
				disabled={readonly}
			></textarea>
		</div>

		<!-- Word Count -->
		{#if showWordCount}
			<div class="mt-4 border-t border-gray-100 pt-4 text-right text-sm text-gray-400">
				{wordCount} words
				{#if wordCount > 0 && wordCount < wordCountTarget - 25}
					<span class="text-amber-500">· Aim for ~{wordCountTarget} words</span>
				{:else if wordCount >= wordCountTarget - 25 && wordCount <= wordCountTarget + 25}
					<span class="text-green-500">· Good length</span>
				{:else if wordCount > wordCountTarget + 25}
					<span class="text-amber-500">· Consider trimming (aim for ~{wordCountTarget})</span>
				{/if}
			</div>
		{/if}
	</div>
</div>
