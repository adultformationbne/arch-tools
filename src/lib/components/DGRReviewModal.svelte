<script>
	import { X, Save, CheckCircle, FileText, User, Send, ChevronLeft, ChevronRight } from '$lib/icons';
	import { toast } from '$lib/stores/toast.svelte.js';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import { formatContributorName } from '$lib/utils/dgr-helpers';

	let {
		isOpen = $bindable(false),
		reflection = $bindable(null),
		submissions = [],
		onSave = () => {},
		onApprove = () => {},
		onSendToWordPress = () => {},
		onSelectSubmission = null
	} = $props();

	let editedTitle = $state('');
	let editedGospelQuote = $state('');
	let editedContent = $state('');
	let isSaving = $state(false);

	// Auto-resize textarea refs
	let textareaEl = $state(null);
	let quoteTextareaEl = $state(null);

	$effect(() => {
		if (reflection) {
			editedTitle = reflection.reflection_title || '';
			editedGospelQuote = reflection.gospel_quote || '';
			editedContent = reflection.reflection_content || '';
		}
	});

	// Auto-resize textarea to fit content
	function autoResize(el) {
		if (el) {
			el.style.height = 'auto';
			el.style.height = el.scrollHeight + 'px';
		}
	}

	// Resize on content change
	$effect(() => {
		if (editedContent !== undefined && textareaEl) {
			requestAnimationFrame(() => autoResize(textareaEl));
		}
	});

	// Resize quote on change
	$effect(() => {
		if (editedGospelQuote !== undefined && quoteTextareaEl) {
			requestAnimationFrame(() => autoResize(quoteTextareaEl));
		}
	});

	// Word count
	let wordCount = $derived(editedContent?.trim() ? editedContent.trim().split(/\s+/).length : 0);

	// Filter submissions that need review (submitted or approved)
	let reviewableSubmissions = $derived(
		submissions.filter(s => s.status === 'submitted' || s.status === 'approved')
	);

	// Current index in submissions
	let currentIndex = $derived(
		reflection ? reviewableSubmissions.findIndex(s => s.id === reflection.id) : -1
	);

	// Navigation
	function goToPrevious() {
		if (currentIndex > 0 && onSelectSubmission) {
			onSelectSubmission(reviewableSubmissions[currentIndex - 1]);
		}
	}

	function goToNext() {
		if (currentIndex < reviewableSubmissions.length - 1 && onSelectSubmission) {
			onSelectSubmission(reviewableSubmissions[currentIndex + 1]);
		}
	}

	async function handleSave() {
		isSaving = true;
		try {
			await onSave({
				id: reflection.id,
				reflection_title: editedTitle,
				gospel_quote: editedGospelQuote,
				reflection_content: editedContent
			});

			toast.success({
				title: 'Changes saved',
				message: 'Reflection has been updated',
				duration: 3000
			});
		} catch (error) {
			toast.error({
				title: 'Save failed',
				message: error.message,
				duration: 5000
			});
		} finally {
			isSaving = false;
		}
	}

	async function handleApprove() {
		isSaving = true;
		try {
			await onApprove(reflection.id);

			toast.success({
				title: 'Reflection approved',
				message: 'This reflection is now ready for publishing',
				duration: 3000
			});

			// Auto-advance to next if available
			if (currentIndex < reviewableSubmissions.length - 1 && onSelectSubmission) {
				onSelectSubmission(reviewableSubmissions[currentIndex + 1]);
			} else {
				isOpen = false;
			}
		} catch (error) {
			toast.error({
				title: 'Approval failed',
				message: error.message,
				duration: 5000
			});
		} finally {
			isSaving = false;
		}
	}

	async function handleSendToWordPress() {
		isSaving = true;
		try {
			await onSendToWordPress(reflection.id);

			// Auto-advance to next if available
			if (currentIndex < reviewableSubmissions.length - 1 && onSelectSubmission) {
				onSelectSubmission(reviewableSubmissions[currentIndex + 1]);
			} else {
				isOpen = false;
			}
		} catch (error) {
			toast.error({
				title: 'WordPress publishing failed',
				message: error.message,
				duration: 5000
			});
		} finally {
			isSaving = false;
		}
	}

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
	}

	function formatDateLong(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function handleClose() {
		if (!isSaving) {
			isOpen = false;
		}
	}

	function selectSubmission(submission) {
		if (onSelectSubmission) {
			onSelectSubmission(submission);
		}
	}

	const statusColors = {
		submitted: 'bg-blue-100 text-blue-700',
		approved: 'bg-green-100 text-green-700'
	};
</script>

{#if isOpen && reflection}
	<!-- Backdrop -->
	<div class="fixed inset-0 z-40 bg-black/60" onmousedown={handleClose}></div>

	<!-- Centered panel with optional sidebar -->
	<div class="fixed inset-4 z-50 flex items-center justify-center sm:inset-6 md:inset-8">
		<div class="flex h-full max-h-[900px] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl">

			<!-- Sidebar - submissions list -->
			{#if reviewableSubmissions.length > 1 && onSelectSubmission}
				<div class="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-gray-50 md:flex">
					<div class="border-b border-gray-200 px-4 py-3">
						<h3 class="text-sm font-semibold text-gray-900">Submissions</h3>
						<p class="text-xs text-gray-500">{reviewableSubmissions.length} to review</p>
					</div>
					<div class="flex-1 overflow-y-auto">
						{#each reviewableSubmissions as submission (submission.id)}
							{@const isSelected = submission.id === reflection?.id}
							<button
								onclick={() => selectSubmission(submission)}
								class="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors {isSelected ? 'bg-white' : 'hover:bg-gray-100'}"
							>
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium {isSelected ? 'text-[#009199]' : 'text-gray-900'}">
										{formatDate(submission.date)}
									</span>
									<span class="rounded-full px-2 py-0.5 text-xs {statusColors[submission.status] || 'bg-gray-100 text-gray-600'}">
										{submission.status}
									</span>
								</div>
								{#if submission.contributor}
									<p class="mt-0.5 truncate text-xs text-gray-500">
										{formatContributorName(submission.contributor)}
									</p>
								{/if}
								{#if submission.reflection_title}
									<p class="mt-1 truncate text-xs text-gray-600">
										{submission.reflection_title}
									</p>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Main content -->
			<div class="flex min-w-0 flex-1 flex-col">
				<!-- Header -->
				<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
					<div class="min-w-0 flex-1">
						<h2 class="truncate font-semibold text-gray-900">{formatDateLong(reflection.date)}</h2>
						<div class="flex items-center gap-3 text-sm text-gray-500">
							{#if reflection.liturgical_date}
								<span class="truncate">{reflection.liturgical_date}</span>
							{/if}
							{#if reflection.contributor}
								<span class="flex shrink-0 items-center gap-1">
									<User class="h-3.5 w-3.5" />
									{formatContributorName(reflection.contributor)}
								</span>
							{/if}
						</div>
					</div>

					<!-- Navigation + Close -->
					<div class="ml-4 flex items-center gap-2">
						{#if reviewableSubmissions.length > 1 && onSelectSubmission}
							<div class="hidden items-center gap-1 sm:flex">
								<button
									onclick={goToPrevious}
									disabled={currentIndex <= 0}
									class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
								>
									<ChevronLeft class="h-5 w-5" />
								</button>
								<span class="text-sm text-gray-500">
									{currentIndex + 1} / {reviewableSubmissions.length}
								</span>
								<button
									onclick={goToNext}
									disabled={currentIndex >= reviewableSubmissions.length - 1}
									class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
								>
									<ChevronRight class="h-5 w-5" />
								</button>
							</div>
						{/if}
						<button
							onclick={handleClose}
							disabled={isSaving}
							class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
						>
							<X class="h-5 w-5" />
						</button>
					</div>
				</div>

				<!-- Scrollable content area -->
				<div class="flex-1 overflow-y-auto">
					<div class="mx-auto max-w-2xl px-4 py-6 sm:px-6">
						<!-- Readings Context - Compact card -->
						{#if reflection.readings_data}
							<div class="mb-6 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
								<div class="flex items-start gap-3">
									<FileText class="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
									<div class="space-y-1 text-sm">
										{#if reflection.readings_data.combined_sources}
											<p class="text-gray-700">{decodeHtmlEntities(reflection.readings_data.combined_sources)}</p>
										{/if}
										{#if reflection.readings_data.gospel?.source}
											<p class="font-medium text-indigo-900">Gospel: {decodeHtmlEntities(reflection.readings_data.gospel.source)}</p>
										{/if}
									</div>
								</div>
							</div>
						{/if}

						<!-- Document-style editor -->
						<div class="rounded-lg bg-white sm:border sm:border-gray-100 sm:p-8 sm:shadow-sm">
							<!-- Title -->
							<div class="mb-4">
								<span class="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">Title</span>
								<input
									type="text"
									bind:value={editedTitle}
									placeholder="Enter a compelling title..."
									class="w-full border-0 bg-transparent text-2xl font-bold text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-3xl"
								/>
							</div>

							<!-- Gospel Quote -->
							<div class="mb-6">
								<span class="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">Gospel Quote</span>
								<textarea
									bind:this={quoteTextareaEl}
									bind:value={editedGospelQuote}
									oninput={() => autoResize(quoteTextareaEl)}
									placeholder={'"Quote from the Gospel" (Book 1:23)'}
									rows="1"
									class="w-full resize-none overflow-hidden border-0 bg-transparent text-base italic text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-lg"
								></textarea>
							</div>

							<!-- Main Content -->
							<div>
								<span class="mb-1 block text-xs font-medium uppercase tracking-wider text-gray-400">Reflection</span>
								<textarea
									bind:this={textareaEl}
									bind:value={editedContent}
									oninput={() => autoResize(textareaEl)}
									placeholder="Edit the reflection content..."
									rows="12"
									class="w-full resize-none overflow-hidden border-0 bg-transparent text-base leading-relaxed text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-0 sm:text-lg"
								></textarea>
							</div>

							<!-- Word Count -->
							<div class="mt-4 border-t border-gray-100 pt-4 text-right text-sm text-gray-400">
								{wordCount} words
								{#if wordCount > 0 && wordCount < 225}
									<span class="text-amber-500">· Aim for ~250 words</span>
								{:else if wordCount >= 225 && wordCount <= 275}
									<span class="text-green-500">· Good length</span>
								{:else if wordCount > 275}
									<span class="text-amber-500">· Consider trimming</span>
								{/if}
							</div>
						</div>

						<!-- Submission info -->
						{#if reflection.submitted_at}
							<div class="mt-4 flex items-center gap-1 text-sm text-gray-500">
								<FileText class="h-4 w-4" />
								Submitted on {new Date(reflection.submitted_at).toLocaleString()}
							</div>
						{/if}
					</div>
				</div>

				<!-- Sticky footer actions -->
				<div class="border-t border-gray-200 bg-gray-50 px-4 py-4 sm:px-6">
					<div class="mx-auto flex max-w-2xl justify-between">
						<button
							onclick={handleClose}
							disabled={isSaving}
							class="px-4 py-2 font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
						>
							Cancel
						</button>

						<div class="flex gap-3">
							{#if reflection.status === 'approved' || reflection.status === 'Approved'}
								<button
									onclick={handleSave}
									disabled={isSaving}
									class="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
								>
									<Save class="h-4 w-4" />
									Save
								</button>

								<button
									onclick={handleSendToWordPress}
									disabled={isSaving}
									class="flex items-center gap-2 rounded-lg bg-[#009199] px-5 py-2 font-medium text-white hover:bg-[#007580] disabled:opacity-50"
								>
									<Send class="h-4 w-4" />
									Send to WordPress
								</button>
							{:else}
								<button
									onclick={handleSave}
									disabled={isSaving}
									class="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
								>
									<Save class="h-4 w-4" />
									Save
								</button>

								<button
									onclick={handleApprove}
									disabled={isSaving}
									class="flex items-center gap-2 rounded-lg bg-[#009199] px-5 py-2 font-medium text-white hover:bg-[#007580] disabled:opacity-50"
								>
									<CheckCircle class="h-4 w-4" />
									Approve
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
