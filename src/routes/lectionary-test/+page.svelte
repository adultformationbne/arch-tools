<script>
	import { Calendar, BookOpen, Search } from '$lib/icons';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let selectedDate = $state(new Date().toISOString().split('T')[0]);
	let loading = $state(false);
	let result = $state(null);
	let error = $state(null);

	async function lookupReadings() {
		loading = true;
		error = null;
		result = null;

		try {
			const response = await fetch('/api/dgr/readings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ date: selectedDate })
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
			} else {
				result = data.readings;
			}
		} catch (err) {
			error = 'Failed to fetch readings: ' + err.message;
		} finally {
			loading = false;
		}
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Lectionary Readings Lookup</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8">
	<div class="mx-auto max-w-4xl px-4">
		<!-- Header -->
		<div class="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
			<div class="flex items-center gap-3 mb-2">
				<BookOpen class="h-8 w-8 text-indigo-600" />
				<h1 class="text-3xl font-bold text-gray-900">Lectionary Readings Lookup</h1>
			</div>
			<p class="text-gray-600">
				Search for liturgical readings by date (2025-2030)
			</p>
		</div>

		<!-- Search Form -->
		<div class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div class="flex flex-col gap-4 sm:flex-row">
				<div class="flex-1">
					<label for="date-input" class="mb-2 block text-sm font-semibold text-gray-700">
						Select Date
					</label>
					<input
						id="date-input"
						type="date"
						bind:value={selectedDate}
						min="2025-01-01"
						max="2030-12-31"
						class="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-indigo-600 focus:outline-none"
					/>
				</div>
				<div class="flex items-end">
					<button
						onclick={lookupReadings}
						disabled={loading}
						style="background-color: #4f46e5; color: white;"
						class="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-8 py-3 text-base font-semibold shadow-md transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							<div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
							Loading...
						{:else}
							<Search class="h-5 w-5" />
							Lookup Readings
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Error Display -->
		{#if error}
			<div class="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
				<div class="flex items-start gap-3">
					<div class="rounded-full bg-red-100 p-2">
						<svg class="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</div>
					<div>
						<h3 class="font-semibold text-red-900">Error</h3>
						<p class="mt-1 text-sm text-red-700">{error}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Results Display -->
		{#if result}
			<div class="space-y-6">
				<!-- Liturgical Info Card -->
				<div class="rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
					<div class="flex items-start gap-4">
						<div class="rounded-full bg-indigo-100 p-3">
							<Calendar class="h-6 w-6 text-indigo-600" />
						</div>
						<div class="flex-1">
							<h2 class="text-2xl font-bold text-indigo-900 mb-2">
								{result.liturgical_day}
							</h2>
							{#if result.liturgical_rank}
								<div class="mb-3">
									<span class="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold {result.liturgical_rank === 'Solemnity' ? 'bg-red-100 text-red-800' : result.liturgical_rank === 'Feast' ? 'bg-amber-100 text-amber-800' : result.liturgical_rank === 'Sunday' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}">
										{result.liturgical_rank}
									</span>
								</div>
							{/if}
							<div class="space-y-1 text-sm text-indigo-700">
								<p><span class="font-semibold">Date:</span> {formatDate(result.calendar_date)}</p>
								<p><span class="font-semibold">Season:</span> {result.liturgical_season}</p>
								{#if result.liturgical_week}
									<p><span class="font-semibold">Week:</span> {result.liturgical_week}</p>
								{/if}
								<p><span class="font-semibold">Cycle:</span> Year {result.year_cycle}</p>
							</div>
						</div>
					</div>
				</div>

				<!-- Readings Card -->
				<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
						<BookOpen class="h-5 w-5 text-gray-600" />
						Readings
					</h3>

					<div class="space-y-4">
						{#if result.first_reading}
							<div class="border-l-4 border-blue-500 pl-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">First Reading</p>
								<p class="mt-1 text-lg font-medium text-gray-900">{result.first_reading}</p>
							</div>
						{/if}

						{#if result.psalm}
							<div class="border-l-4 border-green-500 pl-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Responsorial Psalm</p>
								<p class="mt-1 text-lg font-medium text-gray-900">{result.psalm}</p>
							</div>
						{/if}

						{#if result.second_reading}
							<div class="border-l-4 border-purple-500 pl-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Second Reading</p>
								<p class="mt-1 text-lg font-medium text-gray-900">{result.second_reading}</p>
							</div>
						{/if}

						{#if result.gospel_reading}
							<div class="border-l-4 border-red-500 pl-4">
								<p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Gospel</p>
								<p class="mt-1 text-lg font-bold text-gray-900">{result.gospel_reading}</p>
							</div>
						{/if}
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
					<p class="text-sm text-gray-600">
						Compare with
						<a
							href="https://bible.usccb.org/bible/readings/{result.calendar_date.replace(/-/g, '').slice(2)}.cfm"
							target="_blank"
							rel="noopener noreferrer"
							class="font-semibold text-indigo-600 hover:text-indigo-800"
						>
							USCCB Official Readings →
						</a>
					</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<ToastContainer />
