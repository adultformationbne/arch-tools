<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import ContextualHelp from '$lib/components/ContextualHelp.svelte';
	import { Calendar, Check, Clock, FileText, Send } from 'lucide-svelte';
	import { fetchScripturePassage } from '$lib/utils/scripture.js';

	const { data } = $props();
	const token = data.token;

	let contributor = $state(null);
	let dates = $state([]);
	let loading = $state(true);
	let selectedDate = $state(null);

	// Filter state
	let statusFilter = $state('all');

	// Reflection form state
	let reflectionTitle = $state('');
	let gospelQuote = $state('');
	let reflectionContent = $state('');
	let saving = $state(false);
	let lastSaved = $state(null);
	let saveDebounceTimeout = null;

	// Readings state
	let readings = $state(null);
	let loadingReadings = $state(false);
	let gospelText = $state(null);
	let loadingGospelText = $state(false);
	let showGospelText = $state(false);

	// Auto-resize textarea ref
	let textareaEl = $state(null);

	// Auto-resize textarea to fit content
	function autoResize() {
		if (textareaEl) {
			textareaEl.style.height = 'auto';
			textareaEl.style.height = textareaEl.scrollHeight + 'px';
		}
	}

	// Resize on content change
	$effect(() => {
		if (reflectionContent !== undefined && textareaEl) {
			// Small delay to ensure DOM is updated
			requestAnimationFrame(autoResize);
		}
	});

	// Help content for contributors
	const helpContent = [
		{
			title: 'Getting Started',
			content: `
				<p>Welcome to the Daily Gospel Reflection writing portal.</p>
				<ul>
					<li><strong>Select a date</strong> from the sidebar to begin writing</li>
					<li>Your work is <strong>auto-saved</strong> every 2 seconds as you type</li>
					<li>Click <strong>Submit</strong> when you're ready for review</li>
				</ul>
			`
		},
		{
			title: 'Writing Tips',
			content: `
				<p>Each reflection needs:</p>
				<ol>
					<li><strong>Title</strong> — A compelling headline</li>
					<li><strong>Gospel Quote</strong> — A key phrase with verse reference</li>
					<li><strong>Reflection</strong> — 200-400 words</li>
				</ol>
			`
		},
		{
			title: 'Status Guide',
			content: `
				<ul>
					<li><strong>Not Started</strong> — No content yet</li>
					<li><strong>Draft</strong> — Saved but not submitted</li>
					<li><strong>Submitted</strong> — Awaiting review</li>
					<li><strong>Approved</strong> — Ready for publication</li>
					<li><strong>Published</strong> — Live</li>
				</ul>
			`
		}
	];

	// Filtered dates based on status
	let filteredDates = $derived.by(() => {
		if (statusFilter === 'all') return dates;
		return dates.filter(d => getStatusKey(d) === statusFilter);
	});

	// Get status key for filtering
	function getStatusKey(dateEntry) {
		if (!dateEntry.schedule_id) return 'not_started';
		if (dateEntry.status === 'submitted') return 'submitted';
		if (dateEntry.status === 'approved') return 'approved';
		if (dateEntry.status === 'published') return 'published';
		if (dateEntry.has_content) return 'draft';
		return 'not_started';
	}

	// Count dates by status
	let statusCounts = $derived.by(() => {
		const counts = { all: dates.length, not_started: 0, draft: 0, submitted: 0, approved: 0, published: 0 };
		dates.forEach(d => counts[getStatusKey(d)]++);
		return counts;
	});

	// Word count for reflection
	let wordCount = $derived(reflectionContent.trim() ? reflectionContent.trim().split(/\s+/).length : 0);

	$effect(() => {
		loadContributorData();
	});

	async function loadContributorData() {
		loading = true;
		try {
			const response = await fetch(`/api/dgr/contributor/${token}`);
			const result = await response.json();

			if (result.error) {
				toast.error({ title: 'Access Denied', message: result.error, duration: 0 });
				return;
			}

			contributor = result.contributor;
			dates = result.dates;

			// Auto-select first date that needs work
			const firstIncomplete = dates.find(d => !d.status || d.status === 'pending' || !d.has_content);
			if (firstIncomplete) {
				selectDate(firstIncomplete);
			} else if (dates.length > 0) {
				selectDate(dates[0]);
			}
		} catch (error) {
			toast.error({ title: 'Error', message: 'Failed to load your assignments', duration: 5000 });
		} finally {
			loading = false;
		}
	}

	async function selectDate(dateEntry) {
		// Save current work before switching
		if (selectedDate && hasUnsavedChanges()) {
			await saveReflection('save');
		}

		selectedDate = dateEntry;
		reflectionTitle = dateEntry.reflection_title || '';
		gospelQuote = dateEntry.gospel_quote || '';
		reflectionContent = dateEntry.reflection_content || '';
		readings = null;
		gospelText = null;
		showGospelText = false;
		lastSaved = null;

		await fetchReadings(dateEntry);
	}

	function hasUnsavedChanges() {
		if (!selectedDate) return false;
		return (
			reflectionTitle !== (selectedDate.reflection_title || '') ||
			gospelQuote !== (selectedDate.gospel_quote || '') ||
			reflectionContent !== (selectedDate.reflection_content || '')
		);
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
				toast.warning({ title: 'Readings Not Available', message: result.error, duration: 3000 });
				return;
			}

			readings = result.readings;

			if (result.schedule && !dateEntry.schedule_id) {
				const dateIndex = dates.findIndex((d) => d.date === dateEntry.date);
				if (dateIndex !== -1) {
					dates[dateIndex].schedule_id = result.schedule.id;
					selectedDate = dates[dateIndex];
				}
			}

			if (readings?.gospel_reading) {
				await fetchGospelText(readings.gospel_reading);
			}
		} catch (error) {
			console.error('Failed to fetch readings:', error);
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
		} finally {
			loadingGospelText = false;
		}
	}

	async function saveReflection(action = 'save') {
		if (!selectedDate || !reflectionTitle.trim() || !gospelQuote.trim() || !reflectionContent.trim()) {
			if (action === 'submit') {
				toast.warning({
					title: 'Required Fields Missing',
					message: 'Please fill in all fields before submitting',
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
					title: reflectionTitle.trim(),
					gospel_quote: gospelQuote.trim(),
					content: reflectionContent.trim(),
					action
				})
			});

			const result = await response.json();
			if (result.error) throw new Error(result.error);

			// Update local state
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
				selectedDate = dates[dateIndex];
			}

			lastSaved = new Date();

			if (action === 'submit') {
				toast.success({ title: 'Submitted!', message: 'Your reflection has been submitted for review', duration: 3000 });
			}
		} catch (error) {
			toast.error({ title: 'Save Failed', message: error.message, duration: 3000 });
		} finally {
			saving = false;
		}
	}

	function handleContentChange() {
		clearTimeout(saveDebounceTimeout);
		saveDebounceTimeout = setTimeout(() => {
			if (reflectionTitle.trim() && gospelQuote.trim() && reflectionContent.trim()) {
				saveReflection('save');
			}
		}, 2000);
	}

	function formatDateShort(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
	}

	function formatDateLong(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
	}

	function getStatusColor(dateEntry) {
		const status = getStatusKey(dateEntry);
		const colors = {
			not_started: 'bg-gray-200',
			draft: 'bg-yellow-400',
			submitted: 'bg-green-400',
			approved: 'bg-blue-400',
			published: 'bg-purple-400'
		};
		return colors[status] || 'bg-gray-200';
	}

	function getStatusBadge(dateEntry) {
		const status = getStatusKey(dateEntry);
		const badges = {
			not_started: { text: 'Not Started', class: 'bg-gray-100 text-gray-600' },
			draft: { text: 'Draft', class: 'bg-yellow-100 text-yellow-800' },
			submitted: { text: 'Submitted', class: 'bg-green-100 text-green-800' },
			approved: { text: 'Approved', class: 'bg-blue-100 text-blue-800' },
			published: { text: 'Published', class: 'bg-purple-100 text-purple-800' }
		};
		return badges[status] || badges.not_started;
	}
</script>

<svelte:head>
	<title>Write Reflection | Daily Gospel Reflection</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#if loading}
	<div class="flex h-screen items-center justify-center bg-gray-50">
		<div class="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-[#009199]"></div>
	</div>
{:else if !contributor}
	<div class="flex h-screen items-center justify-center bg-gray-50">
		<div class="rounded-xl bg-white p-8 text-center shadow-lg">
			<h1 class="mb-2 text-2xl font-bold text-gray-900">Access Denied</h1>
			<p class="text-gray-600">This link is invalid or has expired.</p>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-gray-100">
		<!-- Fixed Header -->
		<header class="fixed top-0 left-0 right-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
			<div class="flex items-center gap-3">
				<img src="/archmin-logo.png" alt="Logo" class="h-8 w-auto" />
				<div>
					<p class="text-sm font-semibold text-gray-900">Daily Gospel Reflection</p>
					<p class="text-xs text-gray-500">{contributor.name}</p>
				</div>
			</div>

			{#if selectedDate}
				<div class="flex items-center gap-3">
					<!-- Save Status -->
					<div class="hidden text-sm text-gray-500 sm:block">
						{#if saving}
							<span class="flex items-center gap-1">
								<Clock class="h-3.5 w-3.5 animate-spin" />
								Saving...
							</span>
						{:else if lastSaved}
							<span class="flex items-center gap-1 text-green-600">
								<Check class="h-3.5 w-3.5" />
								Saved
							</span>
						{/if}
					</div>

					<button
						onclick={() => saveReflection('save')}
						disabled={saving || !reflectionTitle.trim() || !gospelQuote.trim() || !reflectionContent.trim()}
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
					>
						Save Draft
					</button>
					<button
						onclick={() => saveReflection('submit')}
						disabled={saving || !reflectionTitle.trim() || !gospelQuote.trim() || !reflectionContent.trim()}
						class="inline-flex items-center gap-2 rounded-lg bg-[#009199] px-4 py-2 text-sm font-medium text-white hover:bg-[#007580] disabled:opacity-50"
					>
						<Send class="h-4 w-4" />
						Submit
					</button>
				</div>
			{/if}
		</header>

		<!-- Main Layout with Sidebar -->
		<div class="flex pt-14">
			<!-- Sidebar - Fixed -->
			<aside class="fixed left-0 top-14 bottom-0 z-10 w-64 overflow-y-auto border-r border-gray-200 bg-white">
				<!-- Filter Pills -->
				<div class="border-b border-gray-200 p-3">
					<p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Filter by status</p>
					<div class="flex flex-wrap gap-1">
						<button
							onclick={() => statusFilter = 'all'}
							class="rounded-full px-2.5 py-1 text-xs font-medium {statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
						>
							All ({statusCounts.all})
						</button>
						<button
							onclick={() => statusFilter = 'not_started'}
							class="rounded-full px-2.5 py-1 text-xs font-medium {statusFilter === 'not_started' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
						>
							Not Started ({statusCounts.not_started})
						</button>
						<button
							onclick={() => statusFilter = 'draft'}
							class="rounded-full px-2.5 py-1 text-xs font-medium {statusFilter === 'draft' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}"
						>
							Drafts ({statusCounts.draft})
						</button>
						<button
							onclick={() => statusFilter = 'submitted'}
							class="rounded-full px-2.5 py-1 text-xs font-medium {statusFilter === 'submitted' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}"
						>
							Submitted ({statusCounts.submitted})
						</button>
					</div>
				</div>

				<!-- Dates List -->
				<nav class="p-2">
					<p class="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-gray-500">Your Assignments</p>
					{#each filteredDates as dateEntry (dateEntry.date)}
						{@const isSelected = selectedDate?.date === dateEntry.date}
						{@const status = getStatusBadge(dateEntry)}
						<button
							onclick={() => selectDate(dateEntry)}
							class="mb-1 w-full rounded-lg px-3 py-2.5 text-left transition-all {isSelected ? 'bg-[#009199] text-white shadow-md' : 'text-gray-700 hover:bg-gray-50'}"
						>
							<div class="flex items-center justify-between">
								<span class="font-medium {isSelected ? 'text-white' : 'text-gray-900'}">{formatDateShort(dateEntry.date)}</span>
								{#if dateEntry.has_content && !isSelected}
									<Check class="h-4 w-4 text-green-500" />
								{/if}
							</div>
							<div class="mt-1">
								<span class="text-xs {isSelected ? 'text-white/80' : status.class} {isSelected ? '' : 'rounded px-1.5 py-0.5'}">
									{status.text}
								</span>
							</div>
						</button>
					{/each}

					{#if filteredDates.length === 0}
						<p class="p-4 text-center text-sm text-gray-400">No dates match this filter</p>
					{/if}
				</nav>
			</aside>

			<!-- Main Content - Scrollable -->
			<main class="ml-64 flex-1 p-6">
				{#if selectedDate}
					{@const mobileBadge = getStatusBadge(selectedDate)}

					<!-- Page Title -->
					<div class="mx-auto mb-4 max-w-3xl">
						<h1 class="text-2xl font-bold text-gray-900">{formatDateLong(selectedDate.date)}</h1>
						<p class="mt-1 text-sm text-gray-500">
							{#if readings?.liturgical_day}
								{readings.liturgical_day}
							{:else}
								Daily Gospel Reflection
							{/if}
						</p>
					</div>

					<!-- Document -->
					<div class="mx-auto max-w-3xl rounded-lg bg-white shadow-sm">
						<!-- Readings Reference (collapsible) -->
						{#if readings}
							<div class="border-b border-gray-100 px-6 py-4 sm:px-8">
								<button
									onclick={() => showGospelText = !showGospelText}
									class="flex w-full items-center justify-between text-left"
								>
									<div class="flex items-center gap-2 text-sm text-gray-600">
										<FileText class="h-4 w-4 text-indigo-500" />
										<span class="font-medium">{readings.liturgical_day || 'Readings'}</span>
										{#if readings.gospel_reading}
											<span class="hidden text-gray-400 sm:inline">• {readings.gospel_reading}</span>
										{/if}
									</div>
									<span class="text-xs text-indigo-600">{showGospelText ? 'Hide' : 'Show'} Gospel</span>
								</button>

								{#if showGospelText && gospelText}
									<div class="mt-4 rounded-lg bg-indigo-50 p-4">
										<div class="prose prose-sm max-w-none text-gray-700">
											{@html gospelText}
										</div>
									</div>
								{:else if showGospelText && loadingGospelText}
									<div class="mt-4 flex items-center gap-2 text-sm text-gray-500">
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
							<input
								type="text"
								bind:value={reflectionTitle}
								oninput={handleContentChange}
								placeholder="Reflection Title"
								class="mb-4 w-full border-0 bg-transparent text-2xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-3xl"
							/>

							<!-- Gospel Quote -->
							<div class="mb-6">
								<input
									type="text"
									bind:value={gospelQuote}
									oninput={handleContentChange}
									placeholder={'Gospel quote with reference, e.g., "Love one another" (John 15:12)'}
									class="w-full border-0 bg-transparent text-base italic text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-lg"
								/>
							</div>

							<!-- Main Content -->
							<textarea
								bind:this={textareaEl}
								bind:value={reflectionContent}
								oninput={() => { handleContentChange(); autoResize(); }}
								placeholder="Begin writing your reflection..."
								rows="12"
								class="w-full resize-none overflow-hidden border-0 bg-transparent text-base leading-relaxed text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-lg"
							></textarea>

							<!-- Word Count -->
							<div class="mt-4 border-t border-gray-100 pt-4 text-right text-sm text-gray-400">
								{wordCount} words
								{#if wordCount > 0 && wordCount < 200}
									<span class="text-amber-500">• Aim for 200-400</span>
								{:else if wordCount >= 200 && wordCount <= 400}
									<span class="text-green-500">• Good length</span>
								{:else if wordCount > 400}
									<span class="text-amber-500">• Consider trimming</span>
								{/if}
							</div>
						</div>
					</div>
				{:else}
					<!-- No date selected -->
					<div class="flex min-h-[60vh] items-center justify-center">
						<div class="text-center">
							<Calendar class="mx-auto h-12 w-12 text-gray-300" />
							<p class="mt-4 text-gray-500">Select a date from the sidebar to start writing</p>
						</div>
					</div>
				{/if}
			</main>
		</div>
	</div>
{/if}

<!-- Help System -->
{#if contributor}
	<ContextualHelp
		{helpContent}
		mode="floating"
		position="bottom-4 right-4"
		pageTitle="Writing Guide"
	/>
{/if}

<ToastContainer />

<style>
	@reference "../../../../app.css";

	:global(.prose h2.passage-ref) {
		@apply text-sm font-semibold text-indigo-800 mt-4 mb-2;
	}

	:global(.prose h2.scripture-heading) {
		@apply text-base font-semibold text-gray-800 mt-4 mb-2;
	}

	:global(.prose .verse-num) {
		font-size: 0.65em;
		color: #6366f1;
		font-weight: 600;
		vertical-align: super;
		margin-right: 0.15em;
		opacity: 0.7;
	}

	:global(.prose p) {
		@apply mb-3 leading-relaxed;
	}
</style>
