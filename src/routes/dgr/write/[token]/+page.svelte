<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import ContextualHelp from '$lib/components/ContextualHelp.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import DGRDocumentEditor from '$lib/components/DGRDocumentEditor.svelte';
	import { Calendar, Check, ChevronDown, Clock, FileText, HelpCircle, Pencil, RotateCcw, Send, X } from '$lib/icons';
	import { fetchScripturePassage } from '$lib/utils/scripture.js';
	import { formatReading, formatContributorName } from '$lib/utils/dgr-helpers';

	const { data } = $props();
	const token = $derived(data.token);
	const isAuthenticated = $derived(data.isAuthenticated);

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
	let readingsExpanded = $state(false); // Collapsed by default on mobile

	// Mobile date picker
	let showDatePicker = $state(false);

	// Help panel (for mobile header trigger)
	let showHelp = $state(false);

	// Track if we just submitted (to show "Next" prompt)
	let justSubmitted = $state(false);

	// Reset confirmation modal
	let showResetConfirm = $state(false);

	// Edit readings modal
	let showEditReadings = $state(false);
	let editedReadings = $state({
		first_reading: '',
		psalm: '',
		second_reading: '',
		gospel_reading: ''
	});
	let savingReadings = $state(false);

	// Onboarding modal for first-time users
	let showOnboarding = $state(false);


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
					<li><strong>Bookmark this page</strong> for easy access next time</li>
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
					<li><strong>Reflection</strong> — ~250 words</li>
				</ol>
				<p class="mt-2"><strong>Pro tip:</strong> You can write in Word and copy/paste your content here.</p>
			`
		},
		{
			title: 'Pro Tips',
			content: `
				<ul>
					<li><strong>Hide Gospel Text</strong> — Click "Hide" for a cleaner writing area</li>
					<li><strong>Readings look wrong?</strong> — Use the Edit button to correct them</li>
					<li><strong>Draft saves automatically</strong> — You can leave and come back anytime</li>
					<li><strong>Copy/paste works</strong> — Write in Word if you prefer, then paste here</li>
				</ul>
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
		},
		{
			title: 'Need Help?',
			content: `
				<p>If you have any questions or run into issues, contact Liam Desic:</p>
				<ul class="mt-2">
					<li><a href="mailto:desicl@bne.catholic.net.au">desicl@bne.catholic.net.au</a></li>
					<li><a href="tel:+61733243974">+61 7 3324 3974</a></li>
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

	// Guard against multiple loads (HMR, remounts, etc.)
	let hasLoadedData = false;

	$effect(() => {
		if (!hasLoadedData) {
			hasLoadedData = true;
			loadContributorData();
		}
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

			// Show onboarding for first-time visitors
			if (contributor.visit_count === 1) {
				showOnboarding = true;
			}

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
		readingsExpanded = false; // Collapse readings when switching dates
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
				justSubmitted = true;
				const nextDate = getNextPendingDate();
				if (nextDate) {
					toast.success({ title: 'Submitted!', message: 'Your reflection has been submitted for review', duration: 3000 });
				} else {
					toast.success({ title: 'All Done!', message: 'You\'ve completed all your reflections', duration: 5000 });
				}
			}
		} catch (error) {
			toast.error({ title: 'Save Failed', message: error.message, duration: 3000 });
		} finally {
			saving = false;
		}
	}

	function handleContentChange() {
		justSubmitted = false; // Reset when user starts editing
		clearTimeout(saveDebounceTimeout);
		saveDebounceTimeout = setTimeout(() => {
			if (reflectionTitle.trim() && gospelQuote.trim() && reflectionContent.trim()) {
				saveReflection('save');
			}
		}, 2000);
	}

	async function resetReflection() {
		if (!selectedDate) return;

		saving = true;
		showResetConfirm = false;

		try {
			const response = await fetch(`/api/dgr/contributor/${token}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date: selectedDate.date,
					action: 'reset'
				})
			});

			const result = await response.json();
			if (result.error) throw new Error(result.error);

			// Clear local form state
			reflectionTitle = '';
			gospelQuote = '';
			reflectionContent = '';
			lastSaved = null;
			justSubmitted = false;

			// Update local state to reflect cleared content
			const dateIndex = dates.findIndex((d) => d.date === selectedDate.date);
			if (dateIndex !== -1) {
				dates[dateIndex] = {
					...dates[dateIndex],
					has_content: false,
					status: 'pending',
					reflection_title: '',
					gospel_quote: '',
					reflection_content: ''
				};
				selectedDate = dates[dateIndex];
			}

			toast.success({ title: 'Reset', message: 'Reflection cleared', duration: 2000 });
		} catch (error) {
			toast.error({ title: 'Reset Failed', message: error.message, duration: 3000 });
		} finally {
			saving = false;
		}
	}

	function openEditReadings() {
		editedReadings = {
			first_reading: readings?.first_reading || '',
			psalm: readings?.psalm || '',
			second_reading: readings?.second_reading || '',
			gospel_reading: readings?.gospel_reading || ''
		};
		showEditReadings = true;
	}

	async function saveEditedReadings() {
		if (!selectedDate?.schedule_id) {
			toast.error({ title: 'Error', message: 'No schedule entry to update', duration: 3000 });
			return;
		}

		savingReadings = true;
		try {
			const response = await fetch('/api/dgr/readings/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					schedule_id: selectedDate.schedule_id,
					first_reading: editedReadings.first_reading.trim(),
					psalm: editedReadings.psalm.trim(),
					second_reading: editedReadings.second_reading.trim(),
					gospel_reading: editedReadings.gospel_reading.trim()
				})
			});

			const result = await response.json();
			if (result.error) throw new Error(result.error);

			// Update local readings state
			readings = {
				...readings,
				first_reading: editedReadings.first_reading.trim(),
				psalm: editedReadings.psalm.trim(),
				second_reading: editedReadings.second_reading.trim(),
				gospel_reading: editedReadings.gospel_reading.trim()
			};

			// Refetch gospel text if it changed
			if (editedReadings.gospel_reading.trim() !== readings?.gospel_reading) {
				await fetchGospelText(editedReadings.gospel_reading.trim());
			}

			showEditReadings = false;
			toast.success({ title: 'Saved', message: 'Readings updated', duration: 2000 });
		} catch (error) {
			toast.error({ title: 'Save Failed', message: error.message, duration: 3000 });
		} finally {
			savingReadings = false;
		}
	}

	function formatDateShort(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
	}

	function formatDateCompact(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

	// Find next pending/draft date (skips submitted/approved/published)
	function getNextPendingDate() {
		const currentIndex = selectedDate ? dates.findIndex(d => d.date === selectedDate.date) : -1;
		for (let i = currentIndex + 1; i < dates.length; i++) {
			const status = getStatusKey(dates[i]);
			if (status === 'not_started' || status === 'draft') {
				return dates[i];
			}
		}
		return null;
	}

	// Select date and close mobile picker
	function selectDateMobile(dateEntry) {
		selectDate(dateEntry);
		showDatePicker = false;
	}

	// Go to next pending date
	function goToNext() {
		const nextDate = getNextPendingDate();
		if (nextDate) {
			justSubmitted = false;
			selectDate(nextDate);
		}
	}

	// Count of remaining work
	let pendingCount = $derived(dates.filter(d => {
		const s = getStatusKey(d);
		return s === 'not_started' || s === 'draft';
	}).length);

	// Check if form has content for submit button visibility
	let hasContent = $derived(
		reflectionTitle.trim() !== '' &&
		gospelQuote.trim() !== '' &&
		reflectionContent.trim() !== ''
	);

	// Get liturgical info for header display
	let liturgicalLabel = $derived(readings?.liturgical_day || selectedDate?.liturgical_date || '');
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
		<!-- Mobile Header - Date picker prominent -->
		<header class="sticky z-20 border-b border-gray-200 bg-white {isAuthenticated ? 'top-14' : 'top-0'} md:hidden">
			{#if selectedDate}
				{@const badge = getStatusBadge(selectedDate)}
				<div class="flex items-center justify-between px-3 py-2">
					<!-- Date Picker Button - Prominent -->
					<button
						onclick={() => showDatePicker = true}
						class="flex flex-1 items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left"
					>
						<Calendar class="h-5 w-5 text-[#009199]" />
						<span class="font-semibold text-gray-900">{formatDateCompact(selectedDate.date)}</span>
						<span class="rounded-full px-2 py-0.5 text-xs {badge.class}">{badge.text}</span>
						<span class="ml-auto flex items-center gap-1 text-xs text-[#009199]">
							Change
							<ChevronDown class="h-3.5 w-3.5" />
						</span>
					</button>

					<!-- Save Status & Help -->
					<div class="ml-2 flex items-center gap-2">
						{#if saving}
							<Clock class="h-4 w-4 animate-spin text-gray-400" />
						{:else if lastSaved}
							<Check class="h-4 w-4 text-green-500" />
						{/if}
						<button
							onclick={() => showHelp = true}
							class="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
							title="Help"
						>
							<HelpCircle class="h-5 w-5" />
						</button>
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-2 px-3 py-2">
					<img src="/archmin-logo.png" alt="Logo" class="h-7 w-auto" />
					<div>
						<p class="text-sm font-semibold text-gray-900">Daily Gospel Reflection</p>
						<p class="text-xs text-gray-500">{formatContributorName(contributor)}</p>
					</div>
				</div>
			{/if}
		</header>

		<!-- Desktop Header - Original style -->
		<header class="sticky z-20 hidden items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5 md:flex {isAuthenticated ? 'top-14' : 'top-0'}">
			<div class="flex items-center gap-3">
				{#if !isAuthenticated}
					<img src="/archmin-logo.png" alt="Logo" class="h-8 w-auto" />
				{/if}
				<div>
					<p class="text-sm font-semibold text-gray-900">{isAuthenticated ? 'Writing Reflection' : 'Daily Gospel Reflection'}</p>
					<p class="text-xs text-gray-500">{formatContributorName(contributor)}</p>
				</div>
			</div>

			{#if selectedDate}
				<div class="flex items-center gap-3">
					<!-- Save Status -->
					<div class="text-sm text-gray-500">
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

					<!-- Reset button -->
					<button
						onclick={() => showResetConfirm = true}
						disabled={saving || !hasContent}
						class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
						title="Reset reflection"
					>
						<RotateCcw class="h-4 w-4" />
					</button>

					<button
						onclick={() => saveReflection('save')}
						disabled={saving || !hasContent}
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
					>
						Save Draft
					</button>

					<button
						onclick={() => saveReflection('submit')}
						disabled={saving || !hasContent}
						class="inline-flex items-center gap-2 rounded-lg bg-[#009199] px-4 py-2 text-sm font-medium text-white hover:bg-[#007580] disabled:opacity-50"
					>
						<Send class="h-4 w-4" />
						Submit
					</button>
				</div>
			{/if}
		</header>

		<!-- Main Layout with Sidebar -->
		<div class="flex">
			<!-- Sidebar - Sticky, hidden on mobile. Sticks below both headers -->
			<aside class="sticky self-start hidden max-h-[calc(100vh-112px)] w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white md:block {isAuthenticated ? 'top-28' : 'top-14'}">
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
			<main class="flex-1 p-3 pb-24 md:p-6 md:pb-6">
				{#if selectedDate}
					<!-- Desktop: Page Title -->
					<div class="mx-auto mb-4 max-w-3xl hidden md:block">
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
					<div class="mx-auto max-w-3xl">
						<DGRDocumentEditor
							bind:title={reflectionTitle}
							bind:gospelQuote={gospelQuote}
							bind:content={reflectionContent}
							{readings}
							{gospelText}
							{loadingReadings}
							{loadingGospelText}
							onchange={handleContentChange}
							onEditReadings={openEditReadings}
						/>

						<!-- Success state -->
						{#if justSubmitted}
							<div class="mt-4 rounded-lg bg-green-50 p-4">
								<div class="flex items-center gap-3">
									<svg class="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="none">
										<path
											d="M4 12.5l6 6 10-12"
											stroke="currentColor"
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											class="animate-tick"
										/>
									</svg>
									<div>
										<p class="font-medium text-green-800">Submitted!</p>
										<p class="text-sm text-green-600">You're all set for now</p>
									</div>
								</div>
							</div>
						{/if}
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

		<!-- Mobile Sticky Submit Button -->
		{#if selectedDate}
			<div class="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white p-3 md:hidden">
				{#if justSubmitted && getNextPendingDate()}
					<!-- Success state -->
					<div class="flex items-center justify-center gap-2 py-1">
						<svg class="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none">
							<path
								d="M4 12.5l6 6 10-12"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="animate-tick"
							/>
						</svg>
						<p class="font-medium text-green-700">Submitted! You're all set for now</p>
					</div>
				{:else if justSubmitted && !getNextPendingDate()}
					<!-- All done state -->
					<div class="flex items-center justify-center gap-2 py-1">
						<svg class="h-4 w-4 text-green-600" viewBox="0 0 24 24" fill="none">
							<path
								d="M4 12.5l6 6 10-12"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="animate-tick"
							/>
						</svg>
						<p class="font-medium text-green-700">All done! You've completed all your reflections.</p>
					</div>
				{:else}
					<!-- Normal submit button -->
					<div class="flex items-center gap-3">
						<button
							onclick={() => showResetConfirm = true}
							disabled={saving || !hasContent}
							class="rounded-lg p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
							title="Reset reflection"
						>
							<RotateCcw class="h-5 w-5" />
						</button>
						<button
							onclick={() => saveReflection('submit')}
							disabled={saving || !hasContent}
							class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#009199] py-3 text-base font-medium text-white hover:bg-[#007580] disabled:opacity-50"
						>
							<Send class="h-5 w-5" />
							Submit for Review
						</button>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<!-- Mobile Date Picker Modal -->
{#if showDatePicker}
	<div class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 md:hidden" onmousedown={(e) => e.target === e.currentTarget && (showDatePicker = false)}>
		<div
			class="max-h-[80vh] w-full overflow-hidden rounded-b-2xl bg-white"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
				<div>
					<h2 class="text-lg font-semibold text-gray-900">Select Date</h2>
					<p class="text-sm text-gray-500">{pendingCount} remaining</p>
				</div>
				<button onclick={() => showDatePicker = false} class="rounded-full p-2 hover:bg-gray-100">
					<X class="h-5 w-5 text-gray-500" />
				</button>
			</div>

			<!-- Filter Pills -->
			<div class="border-b border-gray-100 px-4 py-3">
				<div class="flex flex-wrap gap-2">
					<button
						onclick={() => statusFilter = 'all'}
						class="rounded-full px-3 py-1.5 text-sm font-medium {statusFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}"
					>
						All ({statusCounts.all})
					</button>
					<button
						onclick={() => statusFilter = 'not_started'}
						class="rounded-full px-3 py-1.5 text-sm font-medium {statusFilter === 'not_started' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500'}"
					>
						To Do ({statusCounts.not_started})
					</button>
					<button
						onclick={() => statusFilter = 'draft'}
						class="rounded-full px-3 py-1.5 text-sm font-medium {statusFilter === 'draft' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700'}"
					>
						Drafts ({statusCounts.draft})
					</button>
					<button
						onclick={() => statusFilter = 'submitted'}
						class="rounded-full px-3 py-1.5 text-sm font-medium {statusFilter === 'submitted' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700'}"
					>
						Done ({statusCounts.submitted})
					</button>
				</div>
			</div>

			<!-- Date List -->
			<div class="max-h-[50vh] overflow-y-auto p-2">
				{#each filteredDates as dateEntry (dateEntry.date)}
					{@const isSelected = selectedDate?.date === dateEntry.date}
					{@const status = getStatusBadge(dateEntry)}
					<button
						onclick={() => selectDateMobile(dateEntry)}
						class="mb-1 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all {isSelected ? 'bg-[#009199] text-white' : 'hover:bg-gray-50'}"
					>
						<div>
							<span class="font-medium {isSelected ? 'text-white' : 'text-gray-900'}">{formatDateLong(dateEntry.date)}</span>
							<div class="mt-0.5">
								<span class="text-xs {isSelected ? 'text-white/80' : status.class} {isSelected ? '' : 'rounded px-1.5 py-0.5'}">
									{status.text}
								</span>
							</div>
						</div>
						{#if dateEntry.has_content && !isSelected}
							<Check class="h-5 w-5 text-green-500" />
						{/if}
					</button>
				{/each}

				{#if filteredDates.length === 0}
					<p class="py-8 text-center text-sm text-gray-400">No dates match this filter</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Help System -->
{#if contributor}
	<div class="hidden md:block">
		<ContextualHelp
			{helpContent}
			mode="floating"
			position="bottom-16 right-4"
			pageTitle="Writing Guide"
			buttonLabel="Help"
			videoUrl="https://www.loom.com/embed/ce2cfba74f9f496d807d8fec8d5a3663"
			videoTitle="Watch Tutorial"
		/>
	</div>
	<div class="md:hidden">
		<ContextualHelp
			{helpContent}
			mode="floating"
			position="bottom-20 right-4"
			pageTitle="Writing Guide"
			bind:open={showHelp}
			showTriggerButton={false}
			videoUrl="https://www.loom.com/embed/ce2cfba74f9f496d807d8fec8d5a3663"
			videoTitle="Watch Tutorial"
		/>
	</div>
{/if}

<!-- Onboarding Modal for First-Time Users -->
{#if showOnboarding}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
			<div class="px-6 py-5 border-b border-gray-200">
				<h2 class="text-xl font-bold text-gray-900">Welcome to the Daily Gospel Reflection Writer!</h2>
				<p class="mt-1 text-sm text-gray-600">Watch this quick intro to get started</p>
			</div>

			<div class="px-6 py-4">
				<div style="position: relative; padding-bottom: 64.90384615384616%; height: 0;">
					<iframe
						src="https://www.loom.com/embed/ce2cfba74f9f496d807d8fec8d5a3663"
						frameborder="0"
						webkitallowfullscreen
						mozallowfullscreen
						allowfullscreen
						style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 8px;"
						title="DGR Writer Introduction"
					></iframe>
				</div>
			</div>

			<div class="flex justify-end px-6 py-4 border-t border-gray-200">
				<button
					onclick={() => showOnboarding = false}
					class="rounded-lg bg-[#009199] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#007580]"
				>
					Get Started
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Reset Confirmation Modal -->
<ConfirmationModal
	show={showResetConfirm}
	title="Reset Reflection"
	confirmText="Reset"
	onConfirm={resetReflection}
	onCancel={() => showResetConfirm = false}
>
	<p>Are you sure you want to clear this reflection? This will remove all content you've written.</p>
	<p><strong>This cannot be undone.</strong></p>
</ConfirmationModal>

<!-- Edit Readings Modal -->
{#if showEditReadings}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onmousedown={(e) => e.target === e.currentTarget && (showEditReadings = false)}>
		<div
			class="mx-4 w-full max-w-md rounded-xl bg-white shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
				<h3 class="text-lg font-semibold text-gray-900">Edit Readings</h3>
				<button onclick={() => showEditReadings = false} class="rounded-lg p-1 hover:bg-gray-100">
					<X class="h-5 w-5 text-gray-500" />
				</button>
			</div>

			<div class="space-y-4 px-6 py-4">
				<div>
					<label for="first_reading" class="mb-1 block text-sm font-medium text-gray-700">First Reading</label>
					<input
						id="first_reading"
						type="text"
						bind:value={editedReadings.first_reading}
						placeholder="e.g., Genesis 2:7-9; 3:1-7"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				<div>
					<label for="psalm" class="mb-1 block text-sm font-medium text-gray-700">Psalm</label>
					<input
						id="psalm"
						type="text"
						bind:value={editedReadings.psalm}
						placeholder="e.g., Psalm 51:3-6, 12-14, 17"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				<div>
					<label for="second_reading" class="mb-1 block text-sm font-medium text-gray-700">Second Reading</label>
					<input
						id="second_reading"
						type="text"
						bind:value={editedReadings.second_reading}
						placeholder="e.g., Romans 5:12-19"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>

				<div>
					<label for="gospel_reading" class="mb-1 block text-sm font-medium text-gray-700">Gospel</label>
					<input
						id="gospel_reading"
						type="text"
						bind:value={editedReadings.gospel_reading}
						placeholder="e.g., Matthew 4:1-11"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
					/>
				</div>
			</div>

			<div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
				<button
					onclick={() => showEditReadings = false}
					class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
				>
					Cancel
				</button>
				<button
					onclick={saveEditedReadings}
					disabled={savingReadings}
					class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					{savingReadings ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<ToastContainer />

<style>
	@reference "../../../../app.css";

	.animate-tick {
		stroke-dasharray: 28;
		stroke-dashoffset: 28;
		animation: draw-tick 0.35s ease-out forwards;
	}

	@keyframes draw-tick {
		to {
			stroke-dashoffset: 0;
		}
	}

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
