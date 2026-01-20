<script>
	import { Calendar, Upload, Download, Edit, Check, X, AlertCircle, FileText } from '$lib/icons';
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let selectedYear = $state(2025);
	let availableYears = $state([]);
	let calendarData = $state([]);
	let loading = $state(false);
	let uploadMode = $state(false);
	let uploadFile = $state(null);
	let uploadPreview = $state(null);
	let uploadYear = $state(2027);
	let matchingResults = $state(null);
	let editingEntry = $state(null);

	// Load available years on mount
	$effect(() => {
		loadAvailableYears();
		loadCalendarForYear(selectedYear);
	});

	async function loadAvailableYears() {
		try {
			const response = await fetch('/api/dgr/liturgical-calendar/years');
			const data = await response.json();
			if (data.success) {
				availableYears = data.years;
			}
		} catch (error) {
			console.error('Failed to load years:', error);
		}
	}

	async function loadCalendarForYear(year) {
		loading = true;
		try {
			const response = await fetch(`/api/dgr/liturgical-calendar?year=${year}`);
			const data = await response.json();
			if (data.success) {
				calendarData = data.calendar;
			} else {
				toast.error({ title: 'Error', message: data.error || 'Failed to load calendar' });
			}
		} catch (error) {
			toast.error({ title: 'Error', message: 'Failed to load calendar data' });
		} finally {
			loading = false;
		}
	}

	function handleFileSelect(event) {
		const file = event.target.files[0];
		if (!file) return;

		if (!file.name.endsWith('.csv')) {
			toast.error({ title: 'Invalid File', message: 'Please upload a CSV file' });
			return;
		}

		uploadFile = file;

		// Preview first few lines
		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target.result;
			const lines = text.split('\n').slice(0, 10);
			uploadPreview = lines.join('\n');
		};
		reader.readAsText(file);
	}

	async function processUpload() {
		if (!uploadFile) {
			toast.error({ title: 'No File', message: 'Please select a file first' });
			return;
		}

		loading = true;
		const formData = new FormData();
		formData.append('file', uploadFile);
		formData.append('year', uploadYear.toString());

		try {
			const response = await fetch('/api/dgr/liturgical-calendar/upload', {
				method: 'POST',
				body: formData
			});

			const data = await response.json();

			if (data.success) {
				matchingResults = data.results;
				toast.success({ title: 'Success', message: `Processed ${data.results.total} entries` });
			} else {
				toast.error({ title: 'Upload Failed', message: data.error || 'Upload failed' });
			}
		} catch (error) {
			toast.error({ title: 'Error', message: 'Failed to process upload' });
		} finally {
			loading = false;
		}
	}

	async function confirmImport() {
		if (!matchingResults) return;

		loading = true;
		try {
			const response = await fetch('/api/dgr/liturgical-calendar/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					year: uploadYear,
					entries: matchingResults.entries
				})
			});

			const data = await response.json();

			if (data.success) {
				toast.success({ title: 'Success', message: `Imported ${data.imported} entries for ${uploadYear}` });
				uploadMode = false;
				uploadFile = null;
				uploadPreview = null;
				matchingResults = null;
				await loadAvailableYears();
				selectedYear = uploadYear;
				await loadCalendarForYear(uploadYear);
			} else {
				toast.error({ title: 'Import Failed', message: data.error || 'Import failed' });
			}
		} catch (error) {
			toast.error({ title: 'Error', message: 'Failed to import calendar' });
		} finally {
			loading = false;
		}
	}

	async function downloadTemplate() {
		try {
			const response = await fetch('/api/dgr/liturgical-calendar/template');
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'ordo_template.csv';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
			toast.success({ title: 'Success', message: 'Template downloaded' });
		} catch (error) {
			toast.error({ title: 'Error', message: 'Failed to download template' });
		}
	}

	async function updateEntry(entry) {
		loading = true;
		try {
			const response = await fetch('/api/dgr/liturgical-calendar/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(entry)
			});

			const data = await response.json();

			if (data.success) {
				toast.success({ title: 'Success', message: 'Entry updated' });
				editingEntry = null;
				await loadCalendarForYear(selectedYear);
			} else {
				toast.error({ title: 'Update Failed', message: data.error || 'Update failed' });
			}
		} catch (error) {
			toast.error({ title: 'Error', message: 'Failed to update entry' });
		} finally {
			loading = false;
		}
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function getRankColor(rank) {
		const colors = {
			'Solemnity': 'bg-red-100 text-red-800 border-red-200',
			'Feast': 'bg-amber-100 text-amber-800 border-amber-200',
			'Sunday': 'bg-blue-100 text-blue-800 border-blue-200',
			'Memorial': 'bg-purple-100 text-purple-800 border-purple-200',
			'Feria': 'bg-gray-100 text-gray-700 border-gray-200'
		};
		return colors[rank] || 'bg-gray-100 text-gray-700 border-gray-200';
	}
</script>

<svelte:head>
	<title>Liturgical Calendar Management - DGR Admin</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-7xl px-4">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<Calendar class="h-8 w-8 text-indigo-600" />
					<div>
						<h1 class="text-3xl font-bold text-gray-900">Liturgical Calendar</h1>
						<p class="text-sm text-gray-600">Manage Ordo calendar and readings mapping</p>
					</div>
				</div>

				<div class="flex gap-3">
					<button
						onclick={downloadTemplate}
						class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
					>
						<Download class="h-4 w-4" />
						Download Template
					</button>

					<button
						onclick={() => uploadMode = !uploadMode}
						class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
					>
						{#if uploadMode}
							<X class="h-4 w-4" />
							Cancel Upload
						{:else}
							<Upload class="h-4 w-4" />
							Upload New Year
						{/if}
					</button>
				</div>
			</div>
		</div>

		<!-- Upload Mode -->
		{#if uploadMode}
			<div class="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
				<h2 class="mb-4 text-xl font-bold text-indigo-900">Upload Ordo Calendar CSV</h2>

				<div class="space-y-4">
				<!-- Year Selection -->
				<div>
					<label class="mb-2 block text-sm font-semibold text-gray-700" for="upload-year">Year</label>
					<input
						id="upload-year"
						type="number"
						bind:value={uploadYear}
						min="2025"
						max="2050"
						class="w-32 rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
					/>
				</div>

				<!-- File Upload -->
				<div>
					<label class="mb-2 block text-sm font-semibold text-gray-700" for="upload-file">CSV File</label>
					<input
						id="upload-file"
						type="file"
						accept=".csv"
						onchange={handleFileSelect}
						class="block w-full rounded-lg border border-gray-300 px-4 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
					/>
				</div>

					{#if uploadPreview}
						<div class="rounded-lg border border-gray-300 bg-white p-4">
							<p class="mb-2 text-sm font-semibold text-gray-700">Preview (first 10 lines):</p>
							<pre class="overflow-x-auto text-xs text-gray-600">{uploadPreview}</pre>
						</div>
					{/if}

					<button
						onclick={processUpload}
						disabled={!uploadFile || loading}
						class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							<div class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
							Processing...
						{:else}
							<Upload class="h-5 w-5" />
							Process & Match
						{/if}
					</button>
				</div>

				<!-- Matching Results -->
				{#if matchingResults}
					<div class="mt-6 rounded-lg border border-gray-300 bg-white p-6">
						<h3 class="mb-4 text-lg font-bold text-gray-900">Matching Results</h3>

						<div class="mb-4 grid grid-cols-4 gap-4">
							<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
								<p class="text-sm text-gray-600">Total Entries</p>
								<p class="text-2xl font-bold text-gray-900">{matchingResults.total}</p>
							</div>
							<div class="rounded-lg border border-green-200 bg-green-50 p-4">
								<p class="text-sm text-green-700">Exact Matches</p>
								<p class="text-2xl font-bold text-green-900">{matchingResults.exact}</p>
							</div>
							<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
								<p class="text-sm text-yellow-700">Partial Matches</p>
								<p class="text-2xl font-bold text-yellow-900">{matchingResults.partial}</p>
							</div>
							<div class="rounded-lg border border-red-200 bg-red-50 p-4">
								<p class="text-sm text-red-700">No Match</p>
								<p class="text-2xl font-bold text-red-900">{matchingResults.unmatched}</p>
							</div>
						</div>

						{#if matchingResults.unmatched === 0}
							<div class="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
								<div class="flex items-center gap-2">
									<Check class="h-5 w-5 text-green-600" />
									<p class="font-semibold text-green-900">Perfect! 100% of entries matched to Lectionary readings.</p>
								</div>
							</div>
						{:else}
							<div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
								<div class="flex items-center gap-2">
									<AlertCircle class="h-5 w-5 text-amber-600" />
									<p class="font-semibold text-amber-900">{matchingResults.unmatched} entries could not be matched automatically.</p>
								</div>
							</div>
						{/if}

						<div class="flex gap-3">
							<button
								onclick={confirmImport}
								disabled={loading}
								class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Check class="h-5 w-5" />
								Confirm & Import {uploadYear}
							</button>

							<button
								onclick={() => matchingResults = null}
								class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
							>
								<X class="h-5 w-5" />
								Cancel
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

	<!-- Year Selector -->
	<div class="mb-6 flex items-center gap-4">
		<label class="text-sm font-semibold text-gray-700" for="year-selector">View Year:</label>
		<select
			id="year-selector"
			bind:value={selectedYear}
			onchange={() => loadCalendarForYear(selectedYear)}
			class="rounded-lg border border-gray-300 px-4 py-2 font-semibold focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600"
		>
				{#each availableYears as year}
					<option value={year}>{year}</option>
				{/each}
			</select>

			<span class="text-sm text-gray-600">
				{calendarData.length} days loaded
			</span>
		</div>

		<!-- Calendar Grid -->
		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
			</div>
		{:else}
			<div class="rounded-xl border border-gray-200 bg-white shadow-sm">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="border-b border-gray-200 bg-gray-50">
							<tr>
								<th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Date</th>
								<th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Liturgical Day</th>
								<th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Rank</th>
								<th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">First Reading</th>
								<th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Psalm</th>
								<th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Second Reading</th>
								<th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Gospel</th>
								<th class="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200">
							{#each calendarData as entry}
								<tr class="hover:bg-gray-50">
									<td class="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
										{formatDate(entry.calendar_date)}
									</td>
									<td class="px-3 py-3 text-sm text-gray-900">
										{entry.liturgical_name}
									</td>
									<td class="px-3 py-3 text-sm">
										<span class="inline-flex rounded-full border px-2 py-1 text-xs font-semibold {getRankColor(entry.liturgical_rank)}">
											{entry.liturgical_rank || 'N/A'}
										</span>
									</td>
									<td class="px-3 py-3 text-xs text-gray-600">
										{entry.first_reading || '—'}
									</td>
									<td class="px-3 py-3 text-xs text-gray-600">
										{entry.psalm || '—'}
									</td>
									<td class="px-3 py-3 text-xs text-gray-600">
										{entry.second_reading || '—'}
									</td>
									<td class="px-3 py-3 text-xs text-gray-600">
										{entry.gospel_reading || '—'}
									</td>
									<td class="px-3 py-3 text-right text-sm whitespace-nowrap">
										<button
											onclick={() => editingEntry = entry}
											class="inline-flex items-center gap-1 rounded-lg px-3 py-1 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
										>
											<Edit class="h-3 w-3" />
											Edit
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Edit Modal -->
{#if editingEntry}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
		<div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
			<h3 class="mb-4 text-xl font-bold text-gray-900">Edit Calendar Entry</h3>

			<div class="space-y-4">
			<div>
				<label class="mb-1 block text-sm font-semibold text-gray-700" for="entry-date">Date</label>
				<input
					id="entry-date"
					type="text"
					value={editingEntry.calendar_date}
					disabled
					class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-semibold text-gray-700" for="entry-name">Liturgical Name</label>
				<input
					id="entry-name"
					type="text"
					bind:value={editingEntry.liturgical_name}
					class="w-full rounded-lg border border-gray-300 px-4 py-2"
				/>
			</div>

				<div class="grid grid-cols-2 gap-4">
				<div>
					<label class="mb-1 block text-sm font-semibold text-gray-700" for="entry-rank">Rank</label>
					<select
						id="entry-rank"
						bind:value={editingEntry.liturgical_rank}
						class="w-full rounded-lg border border-gray-300 px-4 py-2"
					>
							<option value="Solemnity">Solemnity</option>
							<option value="Feast">Feast</option>
							<option value="Sunday">Sunday</option>
							<option value="Memorial">Memorial</option>
							<option value="Feria">Feria</option>
						</select>
					</div>

				<div>
					<label class="mb-1 block text-sm font-semibold text-gray-700" for="entry-season">Season</label>
					<input
						id="entry-season"
						type="text"
						bind:value={editingEntry.liturgical_season}
						placeholder="e.g., Ordinary Time, Lent"
						class="w-full rounded-lg border border-gray-300 px-4 py-2"
					/>
				</div>
				</div>

			<div>
				<label class="mb-1 block text-sm font-semibold text-gray-700" for="entry-week">Week</label>
				<input
					id="entry-week"
					type="number"
					bind:value={editingEntry.liturgical_week}
					class="w-full rounded-lg border border-gray-300 px-4 py-2"
				/>
			</div>
			</div>

			<div class="mt-6 flex gap-3">
				<button
					onclick={() => updateEntry(editingEntry)}
					class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
				>
					Save Changes
				</button>
				<button
					onclick={() => editingEntry = null}
					class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<ToastContainer />
