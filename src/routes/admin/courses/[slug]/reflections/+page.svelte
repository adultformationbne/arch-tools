<script>
	import { MessageSquare, CheckCircle, XCircle, Clock, User, Calendar, Filter, Search, Star, X, Eye } from 'lucide-svelte';
	import { toastSuccess, toastError, toastWarning } from '$lib/utils/toast-helpers.js';
	import { goto, invalidateAll } from '$app/navigation';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import ReflectionStatusBadge from '$lib/components/ReflectionStatusBadge.svelte';
	import { needsReview, isComplete, isOverdue, normalizeStatus } from '$lib/utils/reflection-status';

	let { data } = $props();

	const courseSlug = data.courseSlug;
	let selectedFilter = $state('pending');
	let selectedCohort = $state('all');
	let searchQuery = $state('');
	let selectedReflection = $state(null);
	let showMarkingModal = $state(false);
	let showViewModal = $state(false);
	let viewingReflection = $state(null);
	let isSaving = $state(false);
	let isClaiming = $state(false);

	// For override confirmation
	let showOverrideConfirm = $state(false);
	let pendingOverrideReflection = $state(null);

	// Real reflection data from server
	let reflections = $state(data.reflections || []);
	let cohorts = $state(data.cohorts || []);

	// Sync data when it changes (after invalidateAll)
	$effect(() => {
		reflections = data.reflections || [];
		cohorts = data.cohorts || [];
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

	// Helper to check if reflection is overdue (needs review + > 7 days old)
	const isReflectionOverdue = (r) => isOverdue(r.dbStatus || r.status, r.submittedAt);

	const filterOptions = $derived.by(() => [
		{ value: 'all', label: 'All Reflections', count: reflections.length },
		{ value: 'pending', label: 'Pending Review', count: reflections.filter(r => needsReview(r.dbStatus || r.status)).length },
		{ value: 'overdue', label: 'Overdue', count: reflections.filter(r => isReflectionOverdue(r)).length },
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
			filtered = filtered.filter(r => needsReview(r.dbStatus || r.status) && !isReflectionOverdue(r));
		} else if (selectedFilter === 'overdue') {
			filtered = filtered.filter(r => isReflectionOverdue(r));
		} else if (selectedFilter === 'passed') {
			filtered = filtered.filter(r => isComplete(r.dbStatus || r.status));
		}

		// Filter by cohort
		if (selectedCohort !== 'all') {
			filtered = filtered.filter(r => r.cohort?.id === selectedCohort || r.cohort === selectedCohort);
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
			// Sort by: overdue first, then pending review, then complete
			const aOverdue = isReflectionOverdue(a);
			const bOverdue = isReflectionOverdue(b);
			const aNeedsReview = needsReview(a.dbStatus || a.status);
			const bNeedsReview = needsReview(b.dbStatus || b.status);

			if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
			if (aNeedsReview !== bNeedsReview) return aNeedsReview ? -1 : 1;

			// Then by submission date (newest first)
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

	const submitMarking = async () => {
		if (!selectedReflection || isSaving) return;

		isSaving = true;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/reflections/api`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					reflection_id: selectedReflection.id,
					feedback: markingForm.feedback.trim(),
					grade: markingForm.passStatus
				})
			});

			const result = await response.json();

			if (!result.success) {
				if (result.alreadyMarked) {
					toastWarning(`This reflection was already marked by ${result.markedBy}`);
					await invalidateAll();
					// Close modal without releasing claim (it's already marked)
					showMarkingModal = false;
					selectedReflection = null;
					markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
					return;
				}
				throw new Error(result.message || 'Failed to mark reflection');
			}

			toastSuccess(result.message || 'Reflection marked successfully');

			// Refresh data - claim is released by PUT handler
			await invalidateAll();
			// Close without releasing (already released by PUT)
			showMarkingModal = false;
			selectedReflection = null;
			markingForm = { feedback: '', passStatus: 'pass', isPublic: false };

		} catch (error) {
			console.error('Marking error:', error);
			toastError('Failed to mark reflection. Please try again.');
		} finally {
			isSaving = false;
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

<div class="flex min-h-screen">
	<!-- Sidebar Filters -->
	<div class="w-64 flex-shrink-0 h-screen flex flex-col border-r" style="background-color: var(--course-accent-dark); border-color: rgba(255,255,255,0.1);">
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
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 p-6 overflow-y-auto">
		<!-- Reflections List -->
		<div class="space-y-3 max-w-5xl">
			{#each filteredReflections as reflection}
				<div class="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
					<!-- Header Row -->
					<div class="flex items-center justify-between mb-2">
						<div class="flex items-center gap-3">
							<div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
								<User size="14" class="text-gray-500" />
							</div>
							<div class="min-w-0">
								<div class="flex items-center gap-2">
									<h3 class="font-semibold text-sm text-gray-800 truncate">{reflection.student.name}</h3>
									<span class="text-xs text-gray-400">•</span>
									<span class="text-xs text-gray-500">Session {reflection.session}</span>
								</div>
								<p class="text-xs text-gray-500 truncate">{reflection.student.email} • {reflection.student.hub}</p>
							</div>
						</div>
						<div class="flex items-center gap-2 flex-shrink-0">
							{#if reflection.isBeingReviewed}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 flex items-center gap-1 animate-pulse">
									<Eye size="10" />
									{reflection.reviewingByName || 'Reviewing'}
								</span>
							{/if}
							<ReflectionStatusBadge status={reflection.dbStatus || reflection.status} size="small" />
							{#if isReflectionOverdue(reflection)}
								<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Overdue</span>
							{/if}
							<span class="text-[10px] text-gray-400">{formatDate(reflection.submittedAt)}</span>
						</div>
					</div>

					<!-- Question (collapsed) -->
					<div class="mb-2 px-3 py-2 bg-gray-50 rounded-lg">
						<p class="text-xs text-gray-600 italic line-clamp-1">"{reflection.question}"</p>
					</div>

					<!-- Content Preview -->
					<div class="mb-2 text-xs text-gray-700 leading-relaxed line-clamp-2">
						{@html reflection.content.length > 200 ? reflection.content.substring(0, 200) + '...' : reflection.content}
					</div>

					<!-- Footer -->
					<div class="flex items-center justify-between pt-2 border-t border-gray-100">
						<div class="flex items-center gap-3 text-xs">
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
								<span class="text-blue-600">Has feedback</span>
							{/if}
							<span class="text-gray-400">{getWordCount(reflection.content)} words</span>
						</div>
						<button
							onclick={() => openViewModal(reflection)}
							class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
						>
							<Eye size="12" />
							View
						</button>
					</div>
				</div>
			{/each}

			{#if filteredReflections.length === 0}
				<div class="text-center py-10">
					<MessageSquare size="40" class="mx-auto mb-3 text-white/30" />
					<h3 class="text-sm font-semibold text-white/60 mb-1">No reflections found</h3>
					<p class="text-xs text-white/40">Try adjusting your filters</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Marking Modal -->
{#if showMarkingModal && selectedReflection}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
			<div class="p-5">
				<!-- Modal Header -->
				<div class="flex items-start justify-between mb-4">
					<div>
						<h2 class="text-lg font-bold text-gray-800">Mark Reflection</h2>
						<p class="text-xs text-gray-500">{selectedReflection.student.name} • Session {selectedReflection.session}</p>
					</div>
					<button
						onclick={closeMarkingModal}
						class="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
					>
						<X size="18" />
					</button>
				</div>

				<!-- Student Reflection -->
				<div class="mb-4">
					<h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Student Response</h3>
					<div class="bg-gray-50 rounded-lg p-4 text-sm text-gray-800 leading-relaxed max-h-48 overflow-y-auto">
						{@html selectedReflection.content}
					</div>
					<p class="text-[10px] text-gray-400 mt-1">{getWordCount(selectedReflection.content)} words • {formatDate(selectedReflection.submittedAt)}</p>
				</div>

				<!-- Marking Form -->
				<div class="space-y-4">
					<!-- Pass/Fail -->
					<div>
						<fieldset>
							<legend class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Assessment</legend>
							<div class="flex gap-4">
								<label class="flex items-center gap-1.5 cursor-pointer text-sm">
									<input
										bind:group={markingForm.passStatus}
										type="radio"
										value="pass"
										class="text-green-600 focus:ring-green-500"
									/>
									<CheckCircle size="14" class="text-green-600" />
									<span class="font-medium text-green-700">Pass</span>
								</label>
								<label class="flex items-center gap-1.5 cursor-pointer text-sm">
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
					</div>

					<!-- Feedback -->
					<div>
						<label class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block" for="reflection-feedback">Feedback</label>
						<textarea
							id="reflection-feedback"
							bind:value={markingForm.feedback}
							placeholder="Provide constructive feedback..."
							rows="4"
							class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-900 bg-white"
						></textarea>
						<p class="text-[10px] text-gray-400 mt-1">Visible to student</p>
					</div>

					<!-- Actions -->
					<div class="flex gap-3 pt-2">
						<button
							onclick={submitMarking}
							disabled={isSaving}
							class="flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
						>
							{isSaving ? 'Submitting...' : 'Submit'}
						</button>
						<button
							onclick={closeMarkingModal}
							class="flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors border border-gray-300 text-gray-600 hover:bg-gray-50"
						>
							Cancel
						</button>
					</div>
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
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
		onclick={closeViewModal}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closeViewModal()}
	>
		<div
			class="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Modal Header -->
			<div class="flex items-start justify-between p-4 border-b border-gray-200 bg-gray-50">
				<div class="flex items-center gap-3">
					<div class="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center">
						<User size="16" class="text-gray-500" />
					</div>
					<div>
						<h2 class="text-sm font-bold text-gray-800">{viewingReflection.student.name}</h2>
						<p class="text-xs text-gray-500">{viewingReflection.student.email} • {viewingReflection.student.hub}</p>
						<p class="text-xs text-gray-400">{getCohortDisplayName(viewingReflection.cohort)} • Session {viewingReflection.session}</p>
					</div>
				</div>
				<div class="flex items-center gap-2">
					<ReflectionStatusBadge status={viewingReflection.dbStatus || viewingReflection.status} size="small" />
					<button
						onclick={closeViewModal}
						class="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
					>
						<X size="18" />
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="flex-1 overflow-y-auto p-4 space-y-4">
				<!-- Reflection Question -->
				<div>
					<h3 class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Question</h3>
					<div class="bg-gray-50 rounded-lg px-3 py-2">
						<p class="text-xs text-gray-700 italic">"{viewingReflection.question}"</p>
					</div>
				</div>

				<!-- Student Response -->
				<div>
					<div class="flex items-center justify-between mb-1.5">
						<h3 class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Response</h3>
						<span class="text-[10px] text-gray-400">{getWordCount(viewingReflection.content)} words • {formatDate(viewingReflection.submittedAt)}</span>
					</div>
					<div class="bg-blue-50 rounded-lg p-3 border border-blue-100">
						<div class="text-sm text-gray-800 leading-relaxed">
							{@html viewingReflection.content}
						</div>
					</div>
				</div>

				<!-- Existing Feedback (if any) -->
				{#if viewingReflection.feedback}
					<div>
						<div class="flex items-center gap-1.5 mb-1.5">
							<Star size="12" class="text-amber-500" />
							<h3 class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Feedback</h3>
						</div>
						<div class="bg-green-50 rounded-lg p-3 border border-green-200">
							<p class="text-sm text-gray-800 leading-relaxed">{viewingReflection.feedback}</p>
							{#if viewingReflection.markedBy}
								<p class="text-xs text-gray-500 mt-2">— {viewingReflection.markedBy}</p>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Visibility -->
				<div class="flex items-center gap-2 pt-3 border-t border-gray-100">
					{#if viewingReflection.isPublic}
						<div class="flex items-center gap-1.5 text-green-600">
							<div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
							<span class="text-xs">Public</span>
						</div>
					{:else}
						<div class="flex items-center gap-1.5 text-gray-500">
							<div class="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
							<span class="text-xs">Private</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-end gap-2 p-4 bg-gray-50 border-t border-gray-200">
				<button
					onclick={closeViewModal}
					disabled={isClaiming}
					class="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
				>
					Close
				</button>
				{#if needsReview(viewingReflection.dbStatus || viewingReflection.status)}
					<button
						onclick={() => openMarkingModal(viewingReflection)}
						disabled={isClaiming}
						class="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
						class="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
