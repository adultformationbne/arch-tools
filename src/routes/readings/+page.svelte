<script>
	import { onMount } from 'svelte';
	import { Calendar, BookOpen, Share2, Printer, ChevronLeft, ChevronRight } from '$lib/icons';

	let selectedDate = $state(new Date().toISOString().split('T')[0]);
	let readings = $state(null);
	let loading = $state(true);
	let error = $state(null);
	let copied = $state(false);

	onMount(() => {
		loadReadings();
	});

	async function loadReadings() {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/v1/readings?date=${selectedDate}`);
			const data = await response.json();

			if (data.success) {
				readings = data;
			} else {
				error = data.error || 'Failed to load readings';
			}
		} catch (err) {
			error = 'Failed to connect to server';
		} finally {
			loading = false;
		}
	}

	function changeDate(days) {
		const date = new Date(selectedDate);
		date.setDate(date.getDate() + days);
		selectedDate = date.toISOString().split('T')[0];
		loadReadings();
	}

	function goToToday() {
		selectedDate = new Date().toISOString().split('T')[0];
		loadReadings();
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function getShortDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return {
			day: date.getDate(),
			month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
			weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
		};
	}

	function printPage() {
		window.print();
	}

	async function shareReadings() {
		const shareText = readings
			? `${readings.liturgical_day}\n${formatDate(readings.date)}\n\nGospel: ${readings.readings.gospel || 'N/A'}\n\n${window.location.href}`
			: '';

		if (navigator.share) {
			try {
				await navigator.share({
					title: readings?.liturgical_day || 'Daily Readings',
					text: shareText,
					url: window.location.href
				});
			} catch (err) {
				copyToClipboard();
			}
		} else {
			copyToClipboard();
		}
	}

	function copyToClipboard() {
		const url = window.location.origin + '/readings?date=' + selectedDate;
		navigator.clipboard.writeText(url).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}

	let apiGuideOpen = $state(false);
</script>

<svelte:head>
	<title>Daily Mass Readings - {readings ? formatDate(selectedDate) : 'Loading...'}</title>
	<meta name="description" content="Catholic daily Mass readings for {formatDate(selectedDate)}" />
</svelte:head>

<div class="min-h-screen bg-[#FAF8F5]">
	<div class="mx-auto max-w-4xl px-6 py-8">
		<!-- Loading State -->
		{#if loading}
			<div class="flex justify-center py-32">
				<div class="h-12 w-12 animate-spin rounded-full border-4 border-stone-300 border-t-stone-900"></div>
			</div>

		<!-- Error State -->
		{:else if error}
			<div class="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-8 text-center">
				<p class="text-lg font-semibold text-red-900">Unable to load readings</p>
				<p class="mt-2 text-sm text-red-700">{error}</p>
				<button
					onclick={loadReadings}
					class="mt-4 rounded-lg bg-red-900 px-6 py-2 text-sm font-medium text-white hover:bg-red-800"
				>
					Try Again
				</button>
			</div>

		<!-- Readings Content -->
		{:else if readings}
			<!-- Minimal Navigation Bar -->
			<div class="mb-8 flex items-center justify-between border-b border-stone-200 pb-4 print:hidden">
				<button
					onclick={() => changeDate(-1)}
					class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
					aria-label="Previous day"
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</button>

				<input
					type="date"
					bind:value={selectedDate}
					onchange={loadReadings}
					class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-900 focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
				/>

				<button
					onclick={() => changeDate(1)}
					class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
					aria-label="Next day"
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</button>
			</div>

			<!-- Central Card -->
			<div class="rounded-lg border border-stone-200 bg-white shadow-sm print:shadow-none overflow-hidden">
				<!-- Header -->
				<div class="border-b border-stone-200 px-8 py-6">
					<div class="mb-3 flex items-center justify-between">
						<p class="text-xs uppercase tracking-widest text-stone-500">
							{formatDate(readings.date)}
						</p>
						<div class="flex gap-3 print:hidden">
							<button
								onclick={printPage}
								class="text-xs font-medium text-stone-600 hover:text-stone-900"
							>
								Print
							</button>
							<button
								onclick={shareReadings}
								class="text-xs font-medium text-stone-900 hover:text-stone-700"
							>
								Share
							</button>
						</div>
					</div>

					<h1 class="mb-3 text-3xl font-bold leading-tight text-stone-900">
						{readings.liturgical_day}
					</h1>

					<div class="flex flex-wrap gap-2">
						<span class="inline-block rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
							{readings.liturgical_rank}
						</span>
						{#if readings.liturgical_season}
							<span class="inline-block rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-stone-700">
								{readings.liturgical_season}
								{#if readings.liturgical_week}
									• Week {readings.liturgical_week}
								{/if}
							</span>
						{/if}
						<span class="inline-block rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-stone-700">
							Year {readings.year_cycle}
						</span>
					</div>
				</div>

				<!-- Readings -->
				{#if readings}
					{@const readingsArray = [
						readings.readings.first_reading && { type: 'First Reading', text: readings.readings.first_reading },
						readings.readings.psalm && { type: 'Responsorial Psalm', text: readings.readings.psalm, italic: true },
						readings.readings.second_reading && { type: 'Second Reading', text: readings.readings.second_reading },
						readings.readings.gospel && { type: 'Gospel', text: readings.readings.gospel, larger: true }
					].filter(Boolean)}

					<div>
						{#each readingsArray as reading, index}
							<div class="{index % 2 === 0 ? 'bg-stone-50' : ''} px-8 py-6">
								<h2 class="mb-2 text-xs font-bold uppercase tracking-widest {reading.type === 'Gospel' ? 'text-stone-900' : 'text-stone-600'}">
									{reading.type}
								</h2>
								<p class="{reading.larger ? 'text-xl' : 'text-lg'} font-light leading-relaxed text-stone-900 {reading.italic ? 'italic' : ''}">
									{reading.text}
								</p>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Footer -->
				<div class="border-t border-stone-200 px-8 py-4 text-center text-xs text-stone-600">
					<p class="font-medium text-stone-900">Australian Catholic Liturgical Calendar</p>
					<p class="mt-1">
						For full scripture text, visit
						<a href="https://bible.usccb.org" class="font-medium text-stone-900 underline decoration-stone-400 hover:decoration-stone-900" target="_blank">
							USCCB Bible
						</a>
					</p>
				</div>

				<!-- API Guide -->
				<div class="border-t border-stone-200 print:hidden">
					<button
						onclick={() => apiGuideOpen = !apiGuideOpen}
						class="w-full px-8 py-4 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors flex items-center justify-between"
					>
						<span>🔌 Use this as an API for your website or app</span>
						<span class="text-stone-400">{apiGuideOpen ? '−' : '+'}</span>
					</button>

					{#if apiGuideOpen}
						<div class="border-t border-stone-100 bg-stone-50 px-8 py-6 text-xs text-stone-700">
							<p class="mb-4 font-medium text-stone-900">What's an API?</p>
							<p class="mb-4 leading-relaxed">
								An API lets your website or app automatically fetch the daily readings. Think of it like a phone number you can call to get today's readings in a format computers can understand.
							</p>

							<p class="mb-2 font-medium text-stone-900">How to use it:</p>
							<div class="mb-4 space-y-3">
								<div>
									<p class="mb-1 font-medium">1. Get readings for a specific date</p>
									<code class="block rounded bg-stone-900 px-3 py-2 font-mono text-xs text-stone-100">
										{window.location.origin}/api/v1/readings?date=2025-12-25
									</code>
									<p class="mt-1 text-stone-600">Replace the date with any date you want (format: YYYY-MM-DD)</p>
								</div>

								<div>
									<p class="mb-1 font-medium">2. Get today's readings</p>
									<code class="block rounded bg-stone-900 px-3 py-2 font-mono text-xs text-stone-100">
										{window.location.origin}/api/v1/readings
									</code>
									<p class="mt-1 text-stone-600">Leave out the date to automatically get today's readings</p>
								</div>
							</div>

							<p class="mb-2 font-medium text-stone-900">What you'll get back:</p>
							<p class="mb-2 leading-relaxed">
								The API returns information in JSON format (a computer-friendly format) including:
							</p>
							<ul class="mb-4 ml-4 list-disc space-y-1 text-stone-600">
								<li>The liturgical day name (e.g., "First Sunday of Advent")</li>
								<li>All scripture readings (First Reading, Psalm, Second Reading, Gospel)</li>
								<li>Liturgical information (season, rank, year cycle)</li>
							</ul>

							<p class="mb-2 font-medium text-stone-900">Who can use this?</p>
							<p class="leading-relaxed">
								Anyone! If you run a parish website, Catholic app, or digital display, you can use this API for free.
								If you need help implementing it, ask your web developer to "fetch data from this REST API endpoint."
							</p>
						</div>
					{/if}
				</div>

				{#if copied}
					<div class="border-t border-green-200 bg-green-50 px-8 py-3 text-center text-xs font-medium text-green-900">
						✓ Link copied to clipboard
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	@media print {
		@page {
			margin: 1cm;
		}


		.print\:hidden {
			display: none !important;
		}
	}
</style>
