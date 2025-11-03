<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { Calendar, Edit, Check, Clock, FileText, BookOpen } from 'lucide-svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import { fetchScripturePassage } from '$lib/utils/scripture.js';

	const { data } = $props();
	const token = data.token;

	let contributor = $state(null);
	let dates = $state([]);
	let loading = $state(true);
	let selectedDate = $state(null);
let modalOpen = $state(false);
let modalContent = $state(null);

	// Reflection form state
	let reflectionTitle = $state('');
	let gospelQuote = $state('');
	let reflectionContent = $state('');
	let saving = $state(false);
	let saveDebounceTimeout = null;

	// Readings state
	let readings = $state(null);
	let loadingReadings = $state(false);
	let gospelText = $state(null);
	let loadingGospelText = $state(false);
	let showGospelText = $state(false);

	$effect(() => {
		loadContributorData();
	});

	async function loadContributorData() {
		loading = true;
		try {
			const response = await fetch(`/api/dgr/contributor/${token}`);
			const result = await response.json();

			if (result.error) {
				toast.error({
					title: 'Access Denied',
					message: result.error,
					duration: 0
				});
				return;
			}

			contributor = result.contributor;
			dates = result.dates;
		} catch (error) {
			toast.error({
				title: 'Error',
				message: 'Failed to load your assignments',
				duration: 5000
			});
		} finally {
			loading = false;
		}
	}

	async function openReflectionModal(dateEntry) {
		selectedDate = dateEntry;
		reflectionTitle = dateEntry.reflection_title || '';
		gospelQuote = dateEntry.gospel_quote || '';
		reflectionContent = dateEntry.reflection_content || '';
		readings = null;
		gospelText = null;
		showGospelText = false;
		modalOpen = true;

		// Fetch readings for this date
		await fetchReadings(dateEntry);
	}

	async function fetchReadings(dateEntry) {
		loadingReadings = true;
		try {
			const response = await fetch('/api/dgr/readings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date: dateEntry.date,
					contributor_id: contributor?.id,
					schedule_id: dateEntry.schedule_id
				})
			});

			const result = await response.json();

			if (result.error) {
				toast.warning({
					title: 'Readings Not Available',
					message: result.error,
					duration: 3000
				});
				return;
			}

			readings = result.readings;

			// Update schedule entry in local state if it was just created
			if (result.schedule && !dateEntry.schedule_id) {
				const dateIndex = dates.findIndex((d) => d.date === dateEntry.date);
				if (dateIndex !== -1) {
					dates[dateIndex].schedule_id = result.schedule.id;
					selectedDate = dates[dateIndex];
				}
			}

			// Automatically fetch gospel text if we have a gospel reading reference
			if (readings?.gospel_reading) {
				await fetchGospelText(readings.gospel_reading);
			}
		} catch (error) {
			console.error('Failed to fetch readings:', error);
			toast.error({
				title: 'Error',
				message: 'Failed to load readings for this date',
				duration: 3000
			});
		} finally {
			loadingReadings = false;
		}
	}

	async function fetchGospelText(gospelReference) {
		if (!gospelReference?.trim()) return;

		loadingGospelText = true;
		try {
			const result = await fetchScripturePassage(gospelReference, 'NRSVAE');
			gospelText = result.content;
		} catch (error) {
			console.error('Failed to fetch gospel text:', error);
			toast.error({
				title: 'Gospel Text Unavailable',
				message: 'Could not load the full gospel text',
				duration: 3000
			});
		} finally {
			loadingGospelText = false;
		}
	}

	function closeModal() {
		modalOpen = false;
		selectedDate = null;
		reflectionTitle = '';
		gospelQuote = '';
		reflectionContent = '';
		readings = null;
		gospelText = null;
		showGospelText = false;
	}

	async function saveReflection(action = 'save') {
		if (!selectedDate || !reflectionTitle.trim() || !gospelQuote.trim() || !reflectionContent.trim()) {
			if (action === 'submit') {
				toast.warning({
					title: 'Required Fields Missing',
					message: 'Please fill in the Title, Gospel Quote, and Reflection before submitting',
					duration: 3000
				});
			}
			return;
		}

		saving = true;

		try {
			const response = await fetch(`/api/dgr/contributor/${token}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date: selectedDate.date,
					title: reflectionTitle.trim() || null,
					gospel_quote: gospelQuote.trim() || null,
					content: reflectionContent.trim(),
					action: action
				})
			});

			const result = await response.json();

			if (result.error) throw new Error(result.error);

			// Update the dates array with new data
			const dateIndex = dates.findIndex((d) => d.date === selectedDate.date);
			if (dateIndex !== -1) {
				dates[dateIndex] = {
					...dates[dateIndex],
					schedule_id: result.schedule.id,
					has_content: true,
					status: result.schedule.status,
					reflection_title: result.schedule.reflection_title,
					gospel_quote: result.schedule.gospel_quote,
					reflection_content: result.schedule.reflection_content
				};
			}

			if (action === 'submit') {
				toast.success({
					title: 'Submitted!',
					message: 'Your reflection has been submitted for review',
					duration: 3000
				});
				// Close modal after successful submission
				closeModal();
			} else {
				toast.success({
					title: 'Draft Saved',
					message: 'Your reflection has been saved as a draft',
					duration: 2000
				});
			}
		} catch (error) {
			toast.error({
				title: 'Save Failed',
				message: error.message,
				duration: 3000
			});
		} finally {
			saving = false;
		}
	}

	// Autosave on content change (debounced)
	function handleContentChange() {
		clearTimeout(saveDebounceTimeout);
		saveDebounceTimeout = setTimeout(() => {
			// Only autosave if all required fields are filled
			if (reflectionTitle.trim() && gospelQuote.trim() && reflectionContent.trim()) {
				saveReflection('save');
			}
		}, 2000); // Save 2 seconds after user stops typing
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

	function getStatusBadge(dateEntry) {
		if (!dateEntry.schedule_id) {
			return { text: 'Not Started', class: 'bg-gray-100 text-gray-600' };
		}
		if (dateEntry.status === 'submitted') {
			return { text: 'Submitted', class: 'bg-green-100 text-green-800' };
		}
		if (dateEntry.status === 'approved') {
			return { text: 'Approved', class: 'bg-blue-100 text-blue-800' };
		}
		if (dateEntry.status === 'published') {
			return { text: 'Published', class: 'bg-purple-100 text-purple-800' };
		}
		if (dateEntry.has_content) {
			return { text: 'Draft Saved', class: 'bg-yellow-100 text-yellow-800' };
		}
		return { text: 'Pending', class: 'bg-gray-100 text-gray-600' };
	}
</script>

<svelte:head>
	<title>My Reflection Assignments</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-8">
	<div class="mx-auto max-w-4xl px-4">
		{#if loading}
			<div class="flex justify-center py-12">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
			</div>
		{:else if !contributor}
			<!-- Invalid token -->
			<div class="rounded-lg bg-white p-8 text-center shadow-sm">
				<h1 class="mb-2 text-2xl font-bold text-gray-900">Access Denied</h1>
				<p class="text-gray-600">
					This link is invalid or has expired. Please contact the administrator.
				</p>
			</div>
		{:else}
			<!-- Header -->
			<div class="mb-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
				<h1 class="mb-2 text-3xl font-bold text-gray-900">Welcome, {contributor.name}!</h1>
				<p class="text-gray-600">
					Below are your assigned reflection dates for the next 12 months. Click "Write Reflection"
					to get started.
				</p>
			</div>

			<!-- Dates List -->
			<div class="space-y-3">
				{#each dates as dateEntry (dateEntry.date)}
					{@const status = getStatusBadge(dateEntry)}
					<div
						class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<div class="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
									<Calendar class="h-6 w-6 text-blue-600" />
								</div>
								<div>
									<div class="text-lg font-semibold text-gray-900">
										{formatDate(dateEntry.date)}
									</div>
									<div class="mt-1">
										<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {status.class}">
											{status.text}
										</span>
									</div>
								</div>
							</div>
							<button
								onclick={() => openReflectionModal(dateEntry)}
								class="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#009199] to-[#007580] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-[#007580] hover:to-[#006570]"
							>
								{#if dateEntry.has_content}
									<Edit class="h-4 w-4" />
									Edit Reflection
								{:else}
									<Edit class="h-4 w-4" />
									Write Reflection
								{/if}
							</button>
						</div>
					</div>
				{/each}

				{#if dates.length === 0}
					<div class="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
						<p class="text-gray-600">No upcoming assignments found.</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Reflection Modal -->
{#if modalOpen && selectedDate}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(event) => {
			if (!modalContent?.contains(event.target)) {
				closeModal();
			}
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeModal();
			}
		}}
		role="dialog"
		aria-modal="true"
		tabindex="0"
	>
		<div class="w-full max-w-3xl rounded-2xl bg-white shadow-2xl" bind:this={modalContent}>
			<!-- Modal Header -->
			<div class="border-b border-gray-200 px-6 py-4">
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-2xl font-bold text-gray-900">
							Reflection for {formatDate(selectedDate.date)}
						</h2>
						<p class="mt-1 flex items-center gap-2 text-sm text-gray-500">
							{#if saving}
								<Clock class="h-3 w-3 animate-spin" />
								Saving...
							{:else}
								<Check class="h-3 w-3 text-green-600" />
								Auto-saved
							{/if}
						</p>
					</div>
		<button
			onclick={closeModal}
			class="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
			aria-label="Close"
		>
						<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="max-h-[70vh] space-y-6 overflow-y-auto p-6">
				<!-- Readings Context Display -->
				{#if loadingReadings}
					<div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
						<div class="flex items-center gap-2 text-gray-600">
							<Clock class="h-5 w-5 animate-spin" />
							<span class="text-sm">Loading liturgical readings...</span>
						</div>
					</div>
				{:else if readings}
					<div class="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
						<h3 class="mb-3 flex items-center gap-2 font-semibold text-gray-800">
							<FileText class="h-5 w-5 text-indigo-600" />
							Liturgical Readings
						</h3>

						{#if readings.liturgical_name}
							<p class="mb-2 text-sm font-medium text-indigo-900">{readings.liturgical_name}</p>
						{/if}

						<div class="mt-2 space-y-1 text-sm text-gray-700">
							{#if readings.gospel_reading}
								<p><span class="font-medium">Gospel:</span> {readings.gospel_reading}</p>
							{/if}
							{#if readings.first_reading}
								<p><span class="font-medium">First Reading:</span> {readings.first_reading}</p>
							{/if}
							{#if readings.psalm}
								<p><span class="font-medium">Psalm:</span> {readings.psalm}</p>
							{/if}
							{#if readings.second_reading}
								<p><span class="font-medium">Second Reading:</span> {readings.second_reading}</p>
							{/if}
						</div>

						<!-- Toggle Gospel Text Button -->
						{#if readings.gospel_reading}
							<div class="mt-3">
								<button
									onclick={() => showGospelText = !showGospelText}
									disabled={loadingGospelText}
									class="flex items-center gap-2 text-sm font-medium text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
								>
									<BookOpen class="h-4 w-4" />
									{#if loadingGospelText}
										Loading full Gospel text...
									{:else if showGospelText}
										Hide full Gospel text
									{:else}
										Show full Gospel text
									{/if}
								</button>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Gospel Text Display (Collapsible) -->
				{#if showGospelText && gospelText}
					<div class="rounded-lg border border-indigo-300 bg-white p-5 shadow-sm">
						<div class="flex items-start gap-3">
							<BookOpen class="mt-1 h-5 w-5 flex-shrink-0 text-indigo-600" />
							<div class="flex-1">
								<h4 class="mb-3 font-semibold text-gray-900">Gospel Reading</h4>
								<div class="prose prose-sm max-w-none text-gray-700">
									{@html gospelText}
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Title Field -->
				<div>
					<label for="title" class="mb-2 block text-sm font-semibold text-gray-700">
						Title <span class="text-red-500">*</span>
					</label>
					<input
						id="title"
						type="text"
						bind:value={reflectionTitle}
						oninput={handleContentChange}
						required
						placeholder="e.g., Be True to Yourself, God and Others"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-[#009199] focus:outline-none"
					/>
				</div>

				<!-- Gospel Quote Field -->
				<div>
					<label for="gospel-quote" class="mb-2 block text-sm font-semibold text-gray-700">
						Gospel Quote <span class="text-red-500">*</span>
					</label>
					<input
						id="gospel-quote"
						type="text"
						bind:value={gospelQuote}
						oninput={handleContentChange}
						required
						placeholder="e.g., 'Woe to you!' (Luke 11:47)"
						class="w-full rounded-xl border border-gray-300 px-4 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-[#009199] focus:outline-none"
					/>
					<p class="mt-1 text-xs text-gray-500">
						Enter a short quote from the Gospel reading that stands out to you
					</p>
				</div>

				<!-- Content Field -->
				<div>
					<label for="content" class="mb-2 block text-sm font-semibold text-gray-700">
						Your Reflection <span class="text-red-500">*</span>
					</label>
					<textarea
						id="content"
						bind:value={reflectionContent}
						oninput={handleContentChange}
						required
						rows="16"
						placeholder="Write your reflection on today's Gospel reading..."
						class="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-lg leading-relaxed focus:border-transparent focus:ring-2 focus:ring-[#009199] focus:outline-none"
					></textarea>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="border-t border-gray-200 px-6 py-4">
				<div class="flex items-center justify-between">
					<button
						onclick={closeModal}
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
					>
						Close
					</button>
					<div class="flex items-center gap-3">
						<button
							onclick={() => saveReflection('save')}
							disabled={saving || !reflectionTitle.trim() || !gospelQuote.trim() || !reflectionContent.trim()}
							class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{saving ? 'Saving...' : 'Save Draft'}
						</button>
						<button
							onclick={() => saveReflection('submit')}
							disabled={saving || !reflectionTitle.trim() || !gospelQuote.trim() || !reflectionContent.trim()}
							class="rounded-lg bg-gradient-to-r from-[#009199] to-[#007580] px-6 py-2 text-sm font-semibold text-white shadow-sm hover:from-[#007580] hover:to-[#006570] disabled:cursor-not-allowed disabled:opacity-50"
						>
							{saving ? 'Submitting...' : 'Submit for Review'}
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<ToastContainer />

<style>
	@reference "../../../../app.css";
	/* Gospel text styling */
	:global(.prose h2.passage-ref) {
		@apply text-sm font-semibold text-indigo-800 mt-4 mb-2;
	}

	:global(.prose h2.scripture-heading) {
		@apply text-base font-semibold text-gray-800 mt-4 mb-2;
	}

	/* Verse numbers styled as subscript with color */
	:global(.prose .verse-num) {
		font-size: 0.65em;
		color: #6366f1; /* indigo-500 */
		font-weight: 600;
		vertical-align: sub;
		line-height: 0;
		margin-right: 0.15em;
		opacity: 0.7;
	}

	:global(.prose .verse-sup) {
		/* Keep subscript styling for sup elements */
		vertical-align: sub;
	}

	:global(.prose .verse-span) {
		/* Span verse numbers also get subscript treatment */
		margin-right: 0.25em;
	}

	:global(.prose p) {
		@apply mb-3 leading-relaxed;
	}

	:global(.prose .footnote) {
		@apply cursor-help text-indigo-500;
		font-size: 0.7em;
		vertical-align: super;
	}
</style>
