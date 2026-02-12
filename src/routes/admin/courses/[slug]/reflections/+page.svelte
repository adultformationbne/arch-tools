<script>
	import { MessageSquare, CheckCircle, XCircle, Clock, User, Calendar, Filter, Search, Star, X, Eye } from '$lib/icons';
	import { toastSuccess, toastError, toastWarning } from '$lib/utils/toast-helpers.js';
	import { goto, invalidateAll } from '$app/navigation';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import ReflectionStatusBadge from '$lib/components/ReflectionStatusBadge.svelte';
	import ReflectionContent from '$lib/components/ReflectionContent.svelte';
	import { needsReview, isComplete, normalizeStatus } from '$lib/utils/reflection-status';

	let { data } = $props();

	const courseSlug = $derived(data.courseSlug);
	const currentUserName = $derived(data.currentUserName);
	let selectedFilter = $state('pending');
	let selectedCohort = $state('all');
	let selectedSession = $state('all');
	let searchQuery = $state('');
	let selectedReflection = $state(null);
	let showMarkingModal = $state(false);
	let showViewModal = $state(false);
	let viewingReflection = $state(null);
	let isSaving = $state(false);
	let isClaiming = $state(false);
	let isAdvancing = $state(false);
	let showMobileFilters = $state(false);

	// For override confirmation
	let showOverrideConfirm = $state(false);
	let pendingOverrideReflection = $state(null);

	// Real reflection data from server
	let reflections = $state([]);
	let cohorts = $state([]);

	// Sync data when it changes (after invalidateAll)
	$effect(() => {
		reflections = data.reflections || [];
		cohorts = data.cohorts || [];
	});

	// Derive unique sessions from reflections
	const sessions = $derived.by(() => {
		const sessionSet = new Set(reflections.map(r => r.session).filter(s => s != null));
		return [...sessionSet].sort((a, b) => a - b);
	});

	// Poll for updates every 30 seconds to see claim changes from other users
	$effect(() => {
		const interval = setInterval(() => {
			// Only refresh if modal is closed (don't interrupt active marking)
			if (!showMarkingModal) {
				invalidateAll();
			}
		}, 30000);
		return () => clearInterval(interval);
	});

	let markingForm = $state({
		feedback: '',
		passStatus: 'pass',
		isPublic: false
	});

	const filterOptions = $derived.by(() => [
		{ value: 'all', label: 'All Reflections', count: reflections.length },
		{ value: 'pending', label: 'Pending Review', count: reflections.filter(r => needsReview(r.dbStatus || r.status)).length },
		{ value: 'passed', label: 'Passed', count: reflections.filter(r => isComplete(r.dbStatus || r.status)).length }
	]);

	const getPassStatusIcon = (passStatus) => {
		if (passStatus === 'pass') return CheckCircle;
		if (passStatus === 'fail') return XCircle;
		return Clock;
	};

	const getPassStatusColor = (passStatus) => {
		if (passStatus === 'pass') return 'text-green-600';
		if (passStatus === 'fail') return 'text-red-600';
		return 'text-orange-600';
	};

	const getCohortDisplayName = (cohort) => {
		if (typeof cohort === 'string') return cohort;
		return cohort?.name || 'Unknown Cohort';
	};

	const filteredReflections = $derived.by(() => {
		let filtered = [...reflections]; // Create a copy to avoid mutating state

		// Filter by status using utility functions
		if (selectedFilter === 'pending') {
			filtered = filtered.filter(r => needsReview(r.dbStatus || r.status));
		} else if (selectedFilter === 'passed') {
			filtered = filtered.filter(r => isComplete(r.dbStatus || r.status));
		}

		// Filter by cohort
		if (selectedCohort !== 'all') {
			filtered = filtered.filter(r => r.cohort?.id === selectedCohort || r.cohort === selectedCohort);
		}

		// Filter by session
		if (selectedSession !== 'all') {
			filtered = filtered.filter(r => r.session === selectedSession);
		}

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(r =>
				r.student.name.toLowerCase().includes(query) ||
				r.student.email.toLowerCase().includes(query) ||
				r.content.toLowerCase().includes(query)
			);
		}

		return filtered.sort((a, b) => {
			// Sort by: pending review first, then by submission date (oldest pending first)
			const aNeedsReview = needsReview(a.dbStatus || a.status);
			const bNeedsReview = needsReview(b.dbStatus || b.status);

			if (aNeedsReview !== bNeedsReview) return aNeedsReview ? -1 : 1;

			// Pending: oldest first (longest waiting). Completed: newest first.
			if (aNeedsReview) return new Date(a.submittedAt) - new Date(b.submittedAt);
			return new Date(b.submittedAt) - new Date(a.submittedAt);
		});
	});

	const openMarkingModal = async (reflection, forceOverride = false) => {
		if (isClaiming) return;

		// If being reviewed by someone else and not forcing override, show confirmation
		if (reflection.isBeingReviewed && !forceOverride) {
			pendingOverrideReflection = reflection;
			showOverrideConfirm = true;
			showViewModal = false;
			viewingReflection = null;
			return;
		}

		isClaiming = true;

		try {
			// Claim the reflection
			const response = await fetch(`/admin/courses/${courseSlug}/reflections/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reflection_id: reflection.id })
			});

			const result = await response.json();

			if (!result.success) {
				if (result.alreadyMarked) {
					toastWarning(result.message);
					await invalidateAll();
					showViewModal = false;
					viewingReflection = null;
					return;
				}
				if (result.claimed) {
					// Someone else just claimed it - show confirmation
					toastWarning(`${result.claimedBy} is currently reviewing this reflection`);
					await invalidateAll();
					showViewModal = false;
					viewingReflection = null;
					return;
				}
				throw new Error(result.message || 'Failed to claim reflection');
			}

			// Successfully claimed - close view modal and open marking modal
			showViewModal = false;
			viewingReflection = null;
			selectedReflection = reflection;
			markingForm = {
				feedback: reflection.feedback || '',
				passStatus: reflection.grade || 'pass',
				isPublic: reflection.isPublic
			};
			showMarkingModal = true;
		} catch (error) {
			console.error('Claim error:', error);
			toastError('Failed to open reflection for review');
			showViewModal = false;
			viewingReflection = null;
		} finally {
			isClaiming = false;
		}
	};

	const handleOverrideConfirm = async () => {
		showOverrideConfirm = false;
		if (pendingOverrideReflection) {
			await openMarkingModal(pendingOverrideReflection, true);
			pendingOverrideReflection = null;
		}
	};

	const handleOverrideCancel = () => {
		showOverrideConfirm = false;
		pendingOverrideReflection = null;
	};

	const closeMarkingModal = async () => {
		// Release the claim if we're closing without submitting
		if (selectedReflection) {
			try {
				await fetch(`/admin/courses/${courseSlug}/reflections/api?reflection_id=${selectedReflection.id}`, {
					method: 'DELETE'
				});
			} catch (error) {
				console.error('Failed to release claim:', error);
			}
		}

		showMarkingModal = false;
		selectedReflection = null;
		markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
	};

	// Find the next pending reflection after the current one
	const getNextPending = () => {
		const currentId = selectedReflection?.id;
		const pending = filteredReflections.filter(r =>
			needsReview(r.dbStatus || r.status) && r.id !== currentId && !r.isBeingReviewed
		);
		return pending[0] || null;
	};

	const pendingCount = $derived(
		filteredReflections.filter(r => needsReview(r.dbStatus || r.status)).length
	);

	const submitMarking = async (andAdvance = false) => {
		if (!selectedReflection || isSaving) return;

		isSaving = true;
		if (andAdvance) isAdvancing = true;

		// Pre-identify next reflection BEFORE any async work
		const next = andAdvance ? getNextPending() : null;

		try {
			// Mark current + claim next in parallel (different records, no conflict)
			const markPromise = fetch(`/admin/courses/${courseSlug}/reflections/api`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reflection_id: selectedReflection.id,
					feedback: markingForm.feedback.trim(),
					grade: markingForm.passStatus
				})
			}).then(r => r.json());

			const claimPromise = next
				? fetch(`/admin/courses/${courseSlug}/reflections/api`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ reflection_id: next.id })
				}).then(r => r.json())
				: null;

			const [markResult, claimResult] = await Promise.all([markPromise, claimPromise]);

			if (!markResult.success) {
				if (markResult.alreadyMarked) {
					toastWarning(`This reflection was already marked by ${markResult.markedBy}`);
					// Release the pre-emptive claim if we made one
					if (claimResult?.success && next) {
						fetch(`/admin/courses/${courseSlug}/reflections/api?reflection_id=${next.id}`, { method: 'DELETE' });
					}
					invalidateAll();
					showMarkingModal = false;
					selectedReflection = null;
					markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
					return;
				}
				throw new Error(markResult.message || 'Failed to mark reflection');
			}

			// Optimistically update local state so the list reflects the change immediately
			const markedId = selectedReflection.id;
			reflections = reflections.map(r =>
				r.id === markedId ? { ...r, dbStatus: markingForm.passStatus === 'pass' ? 'passed' : 'needs_revision', status: 'marked' } : r
			);

			if (andAdvance && next && claimResult?.success) {
				// Swap to next reflection in the modal
				selectedReflection = next;
				markingForm = {
					feedback: next.feedback || '',
					passStatus: next.grade || 'pass',
					isPublic: next.isPublic
				};
				toastSuccess('Marked — next loaded');
			} else if (andAdvance && !next) {
				showMarkingModal = false;
				selectedReflection = null;
				markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
				toastSuccess('All done — no more pending reflections');
			} else if (andAdvance && claimResult && !claimResult.success) {
				showMarkingModal = false;
				selectedReflection = null;
				markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
				toastSuccess('Marked — next reflection unavailable');
			} else {
				toastSuccess(markResult.message || 'Reflection marked successfully');
				showMarkingModal = false;
				selectedReflection = null;
				markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
			}

			// Sync with server in background (non-blocking)
			invalidateAll();

		} catch (error) {
			console.error('Marking error:', error);
			toastError('Failed to mark reflection. Please try again.');
		} finally {
			isSaving = false;
			isAdvancing = false;
		}
	};

	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const timeAgo = (dateString) => {
		const diff = Date.now() - new Date(dateString).getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days === 0) return 'today';
		if (days === 1) return '1 day ago';
		if (days < 30) return `${days} days ago`;
		const months = Math.floor(days / 30);
		return months === 1 ? '1 month ago' : `${months} months ago`;
	};

	const getWordCount = (text) => {
		return text.trim().split(/\s+/).length;
	};

	const openViewModal = (reflection) => {
		viewingReflection = reflection;
		showViewModal = true;
	};

	const closeViewModal = () => {
		showViewModal = false;
		viewingReflection = null;
	};
</script>

<div class="flex flex-col lg:flex-row min-h-screen">
	<!-- Mobile Header with Filter Toggle -->
	<div class="lg:hidden p-3 sm:p-4 border-b flex items-center justify-between" style="background-color: var(--course-accent-dark); border-color: rgba(255,255,255,0.1);">
		<div>
			<h2 class="text-sm font-bold text-white/90 uppercase tracking-wide">Reflections</h2>
			<p class="text-xs text-white/50">
				<span class="font-semibold text-white">{reflections.filter(r => needsReview(r.dbStatus || r.status)).length}</span> pending
			</p>
		</div>
		<button
			onclick={() => showMobileFilters = !showMobileFilters}
			class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white/80 hover:text-white transition-colors"
			style="background-color: rgba(255,255,255,0.1);"
		>
			<Filter size="14" />
			Filters
		</button>
	</div>

	<!-- Mobile Filters (collapsible) -->
	{#if showMobileFilters}
		<div class="lg:hidden p-3 sm:p-4 space-y-3 border-b" style="background-color: var(--course-accent-dark); border-color: rgba(255,255,255,0.1);">
			<!-- Mobile Search -->
			<div class="relative">
				<Search size="14" class="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-white/40" />
				<input
					bind:value={searchQuery}
					type="text"
					placeholder="Search participants..."
					class="w-full pl-8 pr-3 py-2 text-sm border rounded-lg text-white placeholder-white/40 focus:outline-none"
					style="background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);"
				/>
			</div>

			<!-- Mobile Filter Chips (horizontal scroll) -->
			<div class="overflow-x-auto -mx-3 px-3 sm:-mx-4 sm:px-4">
				<div class="flex gap-2 pb-1" style="min-width: max-content;">
					{#each filterOptions as option}
						<button
							onclick={() => selectedFilter = option.value}
							class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors {selectedFilter === option.value ? 'text-white' : 'text-white/60'}"
							style={selectedFilter === option.value ? 'background-color: color-mix(in srgb, var(--course-accent-light) 30%, transparent)' : 'background-color: rgba(255,255,255,0.08)'}
						>
							<span>{option.label}</span>
							<span class="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px]" style="background-color: rgba(255,255,255,0.15);">{option.count}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Mobile Cohort Select -->
			<select
				bind:value={selectedCohort}
				class="w-full px-3 py-2 text-sm rounded-lg text-white focus:outline-none"
				style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
			>
				<option value="all" class="text-gray-900">All Cohorts</option>
				{#each cohorts as cohort}
					<option value={cohort.id} class="text-gray-900">{cohort.name}</option>
				{/each}
			</select>

			<!-- Mobile Session Select -->
			<select
				bind:value={selectedSession}
				class="w-full px-3 py-2 text-sm rounded-lg text-white focus:outline-none"
				style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
			>
				<option value="all" class="text-gray-900">All Sessions</option>
				{#each sessions as session}
					<option value={session} class="text-gray-900">Session {session}</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Desktop Sidebar Filters -->
	<div class="hidden lg:flex w-64 flex-shrink-0 h-screen flex-col border-r" style="background-color: var(--course-accent-dark); border-color: rgba(255,255,255,0.1);">
		<!-- Header -->
		<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
			<h2 class="text-sm font-bold text-white/90 uppercase tracking-wide">Reflection Review</h2>
			<p class="text-xs text-white/50 mt-1">
				<span class="font-semibold text-white">{reflections.filter(r => needsReview(r.dbStatus || r.status)).length}</span> pending review
			</p>
		</div>

		<!-- Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-3 space-y-4">
			<!-- Search -->
			<div>
				<div class="relative">
					<Search size="14" class="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-white/40" />
					<input
						id="reflection-search"
						bind:value={searchQuery}
						type="text"
						placeholder="Search..."
						class="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg text-white placeholder-white/40 focus:outline-none"
						style="background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);"
					/>
				</div>
			</div>

			<!-- Status Filter -->
			<div>
				<h3 class="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 px-1">Status</h3>
				<div class="space-y-0.5">
					{#each filterOptions as option}
						<button
							onclick={() => selectedFilter = option.value}
							class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors {selectedFilter === option.value ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}"
							style={selectedFilter === option.value ? 'background-color: color-mix(in srgb, var(--course-accent-light) 20%, transparent)' : ''}
						>
							<span>{option.label}</span>
							<span class="px-1.5 py-0.5 rounded text-[10px]" style="background-color: rgba(255,255,255,0.1);">{option.count}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Cohort Filter -->
			<div>
				<label class="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 block px-1" for="cohort-filter">Cohort</label>
				<select
					id="cohort-filter"
					bind:value={selectedCohort}
					class="w-full px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none"
					style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
				>
					<option value="all" class="text-gray-900">All Cohorts</option>
					{#each cohorts as cohort}
						<option value={cohort.id} class="text-gray-900">{cohort.name}</option>
					{/each}
				</select>
			</div>

			<!-- Session Filter -->
			<div>
				<label class="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 block px-1" for="session-filter">Session</label>
				<select
					id="session-filter"
					bind:value={selectedSession}
					class="w-full px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none"
					style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
				>
					<option value="all" class="text-gray-900">All Sessions</option>
					{#each sessions as session}
						<option value={session} class="text-gray-900">Session {session}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 p-3 sm:p-4 lg:p-6 overflow-y-auto">
		<!-- Reflections List -->
		<div class="space-y-2 sm:space-y-3 max-w-5xl">
			{#each filteredReflections as reflection}
				<div class="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
					<!-- Header Row - Stack on mobile -->
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
						<div class="flex items-center gap-2 sm:gap-3">
							<div class="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
								<User size="12" class="sm:hidden text-gray-500" />
								<User size="14" class="hidden sm:block text-gray-500" />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-1 sm:gap-2">
									<h3 class="font-semibold text-xs sm:text-sm text-gray-800 truncate max-w-[140px] sm:max-w-none">{reflection.student.name}</h3>
									<span class="text-[10px] sm:text-xs text-gray-400">•</span>
									<span class="text-[10px] sm:text-xs text-gray-500">Session {reflection.session}</span>
								</div>
								<p class="text-[10px] sm:text-xs text-gray-500 truncate">{reflection.student.email} <span class="hidden sm:inline">• {reflection.student.hub}</span></p>
							</div>
						</div>
						<!-- Status badges - wrap on mobile -->
						<div class="flex flex-wrap items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-9 sm:ml-0">
							{#if reflection.isBeingReviewed}
								<span class="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-medium bg-purple-100 text-purple-700 flex items-center gap-1 animate-pulse">
									<Eye size="10" class="hidden sm:block" />
									{reflection.reviewingByName || 'Reviewing'}
								</span>
							{/if}
							<ReflectionStatusBadge status={reflection.dbStatus || reflection.status} size="small" />
							<span class="text-[9px] sm:text-[10px] text-gray-400">{timeAgo(reflection.submittedAt)}</span>
						</div>
					</div>

					<!-- Question (collapsed) -->
					<div class="mb-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded-lg">
						<p class="text-[11px] sm:text-xs text-gray-600 italic line-clamp-1">"{reflection.question}"</p>
					</div>

					<!-- Content Preview -->
					<div class="mb-2 text-[11px] sm:text-xs text-gray-700 leading-relaxed line-clamp-2">
						<ReflectionContent content={reflection.content} mode="compact" maxLength={200} class="text-[11px] sm:text-xs" />
					</div>

					<!-- Footer -->
					<div class="flex items-center justify-between pt-2 border-t border-gray-100">
						<div class="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
							<div class="flex items-center gap-1">
								{#if reflection.isPublic}
									<div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
									<span class="text-green-600">Public</span>
								{:else}
									<div class="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
									<span class="text-gray-500">Private</span>
								{/if}
							</div>
							{#if reflection.feedback}
								<span class="text-blue-600 hidden sm:inline">Has feedback</span>
								<span class="text-blue-600 sm:hidden">Feedback</span>
							{/if}
							<span class="text-gray-400">{getWordCount(reflection.content)} words</span>
						</div>
						<button
							onclick={() => openViewModal(reflection)}
							class="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
						>
							<Eye size="11" class="sm:hidden" />
							<Eye size="12" class="hidden sm:block" />
							View
						</button>
					</div>
				</div>
			{/each}

			{#if filteredReflections.length === 0}
				<div class="text-center py-8 sm:py-10">
					<MessageSquare size="32" class="sm:hidden mx-auto mb-2 text-white/30" />
					<MessageSquare size="40" class="hidden sm:block mx-auto mb-3 text-white/30" />
					<h3 class="text-xs sm:text-sm font-semibold text-white/60 mb-1">No reflections found</h3>
					<p class="text-[11px] sm:text-xs text-white/40">Try adjusting your filters</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Marking Modal -->
{#if showMarkingModal && selectedReflection}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
		role="presentation"
	>
		<div
			class="bg-white rounded-lg sm:rounded-xl max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Modal Header (fixed) -->
			<div class="flex items-start justify-between p-3 sm:p-5 pb-3 border-b border-gray-200">
				<div>
					<h2 class="text-base sm:text-lg font-bold text-gray-800">Mark Reflection</h2>
					<p class="text-[11px] sm:text-xs text-gray-500">{selectedReflection.student.name} • Session {selectedReflection.session} • {getWordCount(selectedReflection.content)} words • {timeAgo(selectedReflection.submittedAt)}</p>
				</div>
				<button
					onclick={closeMarkingModal}
					class="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
				>
					<X size="16" class="sm:hidden" />
					<X size="18" class="hidden sm:block" />
				</button>
			</div>

			<!-- Scrollable response area -->
			<div class="flex-1 overflow-y-auto p-3 sm:p-5">
				<div class="bg-gray-50 rounded-lg p-4 sm:p-5 text-sm sm:text-base leading-relaxed">
					<ReflectionContent content={selectedReflection.content} mode="compact" />
				</div>
			</div>

			<!-- Fixed bottom: marking form -->
			<div class="border-t border-gray-200 p-3 sm:p-5 space-y-3">
				<!-- Pass/Fail -->
				<fieldset>
					<div class="flex flex-col sm:flex-row gap-2 sm:gap-4">
						<label class="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm">
							<input
								bind:group={markingForm.passStatus}
								type="radio"
								value="pass"
								class="text-green-600 focus:ring-green-500"
							/>
							<CheckCircle size="14" class="text-green-600" />
							<span class="font-medium text-green-700">Pass</span>
						</label>
						<label class="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm">
							<input
								bind:group={markingForm.passStatus}
								type="radio"
								value="fail"
								class="text-red-600 focus:ring-red-500"
							/>
							<XCircle size="14" class="text-red-600" />
							<span class="font-medium text-red-700">Needs Revision</span>
						</label>
					</div>
				</fieldset>

				<!-- Feedback -->
				<div>
					<textarea
						id="reflection-feedback"
						bind:value={markingForm.feedback}
						placeholder="Provide constructive feedback..."
						rows="3"
						class="w-full px-2.5 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-900 bg-white"
					></textarea>
					<p class="text-[9px] sm:text-[10px] text-gray-400 mt-1">Visible to participant — {currentUserName}</p>
				</div>

				<!-- Actions -->
				<div class="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
					<button
						onclick={closeMarkingModal}
						class="py-2 px-4 text-xs sm:text-sm font-medium rounded-lg transition-colors border border-gray-300 text-gray-600 hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						onclick={() => submitMarking(false)}
						disabled={isSaving}
						class="py-2 px-4 text-xs sm:text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
					>
						{isSaving && !isAdvancing ? 'Submitting...' : 'Submit'}
					</button>
					{#if pendingCount > 1}
						<button
							onclick={() => submitMarking(true)}
							disabled={isSaving}
							class="py-2 px-4 text-xs sm:text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-1.5"
						>
							{#if isAdvancing}
								<div class="animate-spin w-3 h-3 border border-white/40 border-t-white rounded-full"></div>
								Loading next...
							{:else}
								Submit & Next
								<span class="text-green-200 text-[10px]">({pendingCount - 1})</span>
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Override Confirmation Modal -->
<ConfirmationModal
	show={showOverrideConfirm}
	title="Reflection Being Reviewed"
	confirmText="Review Anyway"
	cancelText="Cancel"
	onConfirm={handleOverrideConfirm}
	onCancel={handleOverrideCancel}
>
	<p class="text-gray-700">
		<strong>{pendingOverrideReflection?.reviewingByName || 'Another user'}</strong> is currently reviewing this reflection.
	</p>
	<p class="text-gray-600 mt-2">
		If you proceed, you may overwrite their work. Are you sure you want to continue?
	</p>
</ConfirmationModal>

<!-- View Reflection Modal -->
{#if showViewModal && viewingReflection}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4"
		role="presentation"
		onclick={closeViewModal}
		onkeydown={(e) => e.key === 'Escape' && closeViewModal()}
	>
		<div
			class="bg-white rounded-lg sm:rounded-xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<!-- Modal Header -->
			<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between p-3 sm:p-4 border-b border-gray-200 bg-gray-50 gap-2 sm:gap-0">
				<div class="flex items-center gap-2 sm:gap-3">
					<div class="w-8 h-8 sm:w-9 sm:h-9 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
						<User size="14" class="sm:hidden text-gray-500" />
						<User size="16" class="hidden sm:block text-gray-500" />
					</div>
					<div class="min-w-0 flex-1">
						<h2 class="text-xs sm:text-sm font-bold text-gray-800 truncate">{viewingReflection.student.name}</h2>
						<p class="text-[10px] sm:text-xs text-gray-500 truncate">{viewingReflection.student.email} <span class="hidden sm:inline">• {viewingReflection.student.hub}</span></p>
						<p class="text-[10px] sm:text-xs text-gray-400">{getCohortDisplayName(viewingReflection.cohort)} • Session {viewingReflection.session}</p>
					</div>
				</div>
				<div class="flex items-center justify-between sm:justify-end gap-2 ml-10 sm:ml-0">
					<ReflectionStatusBadge status={viewingReflection.dbStatus || viewingReflection.status} size="small" />
					<button
						onclick={closeViewModal}
						class="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
					>
						<X size="16" class="sm:hidden" />
						<X size="18" class="hidden sm:block" />
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
				<!-- Reflection Question -->
				<div>
					<h3 class="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 sm:mb-1.5">Question</h3>
					<div class="bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
						<p class="text-[11px] sm:text-xs text-gray-700 italic">"{viewingReflection.question}"</p>
					</div>
				</div>

				<!-- Student Response -->
				<div>
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-0 mb-1 sm:mb-1.5">
						<h3 class="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Response</h3>
						<span class="text-[9px] sm:text-[10px] text-gray-400">{getWordCount(viewingReflection.content)} words • {formatDate(viewingReflection.submittedAt)}</span>
					</div>
					<div class="bg-blue-50 rounded-lg p-2.5 sm:p-3 border border-blue-100">
						<ReflectionContent content={viewingReflection.content} mode="full" class="text-xs sm:text-sm" />
					</div>
				</div>

				<!-- Existing Feedback (if any) -->
				{#if viewingReflection.feedback}
					<div>
						<div class="flex items-center gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
							<Star size="10" class="sm:hidden text-amber-500" />
							<Star size="12" class="hidden sm:block text-amber-500" />
							<h3 class="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Feedback</h3>
						</div>
						<div class="bg-green-50 rounded-lg p-2.5 sm:p-3 border border-green-200">
							<p class="text-xs sm:text-sm text-gray-800 leading-relaxed">{viewingReflection.feedback}</p>
							{#if viewingReflection.markedBy}
								<p class="text-[10px] sm:text-xs text-gray-500 mt-1.5 sm:mt-2">— {viewingReflection.markedBy}</p>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Visibility -->
				<div class="flex items-center gap-2 pt-2 sm:pt-3 border-t border-gray-100">
					{#if viewingReflection.isPublic}
						<div class="flex items-center gap-1.5 text-green-600">
							<div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
							<span class="text-[10px] sm:text-xs">Public</span>
						</div>
					{:else}
						<div class="flex items-center gap-1.5 text-gray-500">
							<div class="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
							<span class="text-[10px] sm:text-xs">Private</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-end gap-2 p-3 sm:p-4 bg-gray-50 border-t border-gray-200">
				<button
					onclick={closeViewModal}
					disabled={isClaiming}
					class="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
				>
					Close
				</button>
				{#if needsReview(viewingReflection.dbStatus || viewingReflection.status)}
					<button
						onclick={() => openMarkingModal(viewingReflection)}
						disabled={isClaiming}
						class="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1 sm:gap-1.5"
					>
						{#if isClaiming}
							<span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
							Claiming...
						{:else}
							Mark
						{/if}
					</button>
				{:else}
					<button
						onclick={() => openMarkingModal(viewingReflection)}
						disabled={isClaiming}
						class="px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1 sm:gap-1.5"
					>
						{#if isClaiming}
							<span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
							Opening...
						{:else}
							Edit
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}
