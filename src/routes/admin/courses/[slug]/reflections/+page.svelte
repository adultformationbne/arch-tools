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

<div class="px-16">
	<div class="py-12">
		<div class="max-w-7xl mx-auto">
			<!-- Header -->
			<div class="flex items-center justify-between mb-8">
				<div>
					<h1 class="text-5xl font-bold text-white mb-2">Reflection Review</h1>
					<p class="text-xl text-white/70">Mark and provide feedback on student reflections</p>
				</div>
				<div class="text-white">
					<span class="text-2xl font-bold">{reflections.filter(r => needsReview(r.dbStatus || r.status)).length}</span>
					<span class="text-lg text-white/70"> pending review</span>
				</div>
			</div>

			<!-- Filters -->
			<div class="bg-white rounded-2xl p-6 shadow-sm mb-8">
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<!-- Status Filter -->
					<div>
						<h3 class="block text-sm font-semibold text-gray-700 mb-3">Filter by Status</h3>
						<div class="flex flex-wrap gap-2">
							{#each filterOptions as option}
								<button
									onclick={() => selectedFilter = option.value}
									class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors"
									class:bg-blue-100={selectedFilter === option.value}
									class:text-blue-800={selectedFilter === option.value}
									class:bg-gray-100={selectedFilter !== option.value}
									class:text-gray-700={selectedFilter !== option.value}
								>
									{option.label}
									<span class="bg-white px-2 py-1 rounded text-xs">{option.count}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Cohort Filter -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3" for="cohort-filter">Filter by Cohort</label>
						<select
							id="cohort-filter"
							bind:value={selectedCohort}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-gray-900 bg-white"
						>
							<option value="all">All Cohorts</option>
							{#each cohorts as cohort}
								<option value={cohort.id}>{cohort.name} - {cohort.moduleName}</option>
							{/each}
						</select>
					</div>

					<!-- Search -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3" for="reflection-search">Search</label>
						<div class="relative">
							<Search size="20" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
							<input
								id="reflection-search"
								bind:value={searchQuery}
								type="text"
								placeholder="Search by student name or content..."
								class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-gray-900 bg-white"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Reflections List -->
			<div class="space-y-4">
				{#each filteredReflections as reflection}
					<div class="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
						<!-- Header -->
						<div class="flex items-start justify-between mb-4">
							<div class="flex items-center gap-4">
								<div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
									<User size="20" class="text-gray-600" />
								</div>
								<div>
									<h3 class="font-bold text-lg text-gray-800">{reflection.student.name}</h3>
									<p class="text-sm text-gray-600">{reflection.student.email} • {reflection.student.hub}</p>
									<p class="text-sm text-gray-500">{getCohortDisplayName(reflection.cohort)} • Session {reflection.session}</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								<!-- Being Reviewed Badge -->
								{#if reflection.isBeingReviewed}
									<span class="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800 flex items-center gap-1 animate-pulse">
										<Eye size="14" />
										{reflection.reviewingByName || 'Someone'} is reviewing
									</span>
								{/if}

								<!-- Status Badge -->
								<ReflectionStatusBadge status={reflection.dbStatus || reflection.status} size="large" />

								<!-- Overdue indicator -->
								{#if isReflectionOverdue(reflection)}
									<span class="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">
										Overdue
									</span>
								{/if}

								<div class="text-right text-sm text-gray-500">
									<div>{formatDate(reflection.submittedAt)}</div>
									<div>{getWordCount(reflection.content)} words</div>
								</div>
							</div>
						</div>

						<!-- Question -->
						<div class="mb-4 p-4 bg-gray-50 rounded-lg">
							<h4 class="font-semibold text-gray-800 mb-2">Reflection Question:</h4>
							<p class="text-gray-700 italic">"{reflection.question}"</p>
						</div>

						<!-- Content Preview -->
						<div class="mb-4 prose prose-sm max-w-none">
							<div class="text-gray-800 leading-relaxed">
								{@html reflection.content.length > 300 ? reflection.content.substring(0, 300) + '...' : reflection.content}
							</div>
						</div>

						<!-- Visibility & Actions -->
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<div class="flex items-center gap-2">
									{#if reflection.isPublic}
										<div class="w-2 h-2 bg-green-500 rounded-full"></div>
										<span class="text-sm text-green-700 font-semibold">Public</span>
									{:else}
										<div class="w-2 h-2 bg-gray-400 rounded-full"></div>
										<span class="text-sm text-gray-600">Private</span>
									{/if}
								</div>
								{#if reflection.feedback}
									<div class="text-sm text-blue-600 font-semibold">Feedback provided</div>
								{/if}
							</div>
							<button
								onclick={() => openViewModal(reflection)}
								class="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700"
							>
								<Eye size="16" />
								View Reflection
							</button>
						</div>
					</div>
				{/each}

				{#if filteredReflections.length === 0}
					<div class="text-center py-12">
						<MessageSquare size="64" class="mx-auto mb-4 text-white/40" />
						<h3 class="text-xl font-bold text-white/70 mb-2">No reflections found</h3>
						<p class="text-white/50">Try adjusting your filters or search criteria</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Marking Modal -->
{#if showMarkingModal && selectedReflection}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
			<div class="p-8">
				<!-- Modal Header -->
				<div class="flex items-start justify-between mb-6">
					<div>
						<h2 class="text-2xl font-bold text-gray-800 mb-2">Mark Reflection</h2>
						<p class="text-gray-600">{selectedReflection.student.name} • Session {selectedReflection.session}</p>
					</div>
					<button
						onclick={closeMarkingModal}
						class="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
					>
						<X size="24" />
					</button>
				</div>

				<!-- Student Reflection -->
				<div class="mb-6">
					<h3 class="font-semibold text-gray-800 mb-3">Student Reflection:</h3>
					<div class="bg-gray-50 rounded-lg p-6 prose prose-sm max-w-none">
						<div class="text-gray-800 leading-relaxed">
							{@html selectedReflection.content}
						</div>
						<div class="mt-4 text-sm text-gray-500">
							{getWordCount(selectedReflection.content)} words • Submitted {formatDate(selectedReflection.submittedAt)}
						</div>
					</div>
				</div>

				<!-- Marking Form -->
				<div class="space-y-6">
				<!-- Pass/Fail -->
				<div>
					<fieldset class="space-y-3">
						<legend class="block text-sm font-semibold text-gray-700 mb-3">Assessment</legend>
						<div class="flex gap-4">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									bind:group={markingForm.passStatus}
									type="radio"
									value="pass"
									class="text-green-600 focus:ring-green-500"
								/>
								<CheckCircle size="20" class="text-green-600" />
								<span class="font-semibold text-green-800">Pass</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									bind:group={markingForm.passStatus}
									type="radio"
									value="fail"
									class="text-red-600 focus:ring-red-500"
								/>
								<XCircle size="20" class="text-red-600" />
								<span class="font-semibold text-red-800">Needs Revision</span>
							</label>
						</div>
					</fieldset>
				</div>

				<!-- Feedback -->
				<div>
					<label class="block text-sm font-semibold text-gray-700 mb-3" for="reflection-feedback">Feedback for Student</label>
					<textarea
						id="reflection-feedback"
						bind:value={markingForm.feedback}
						placeholder="Provide constructive feedback to help the student grow in their faith journey..."
						rows="6"
						class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none text-gray-900 bg-white"
					></textarea>
					<p class="text-xs text-gray-500 mt-1">This feedback will be visible to the student</p>
				</div>

					<!-- Actions -->
					<div class="flex gap-4 pt-4">
						<button
							onclick={submitMarking}
							disabled={isSaving}
							class="flex-1 py-3 px-6 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 text-white hover:bg-blue-700"
						>
							{isSaving ? 'Submitting...' : 'Submit Marking'}
						</button>
						<button
							onclick={closeMarkingModal}
							class="flex-1 py-3 px-6 font-semibold rounded-lg transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50"
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
			class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Modal Header -->
			<div class="flex items-start justify-between p-6 border-b border-gray-200 bg-gray-50">
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
						<User size="24" class="text-gray-600" />
					</div>
					<div>
						<h2 class="text-xl font-bold text-gray-800">{viewingReflection.student.name}</h2>
						<p class="text-sm text-gray-600">{viewingReflection.student.email}</p>
						<p class="text-sm text-gray-500">{getCohortDisplayName(viewingReflection.cohort)} • Session {viewingReflection.session}</p>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<ReflectionStatusBadge status={viewingReflection.dbStatus || viewingReflection.status} size="large" />
					<button
						onclick={closeViewModal}
						class="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
					>
						<X size="24" />
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="flex-1 overflow-y-auto p-6 space-y-6">
				<!-- Reflection Question -->
				<div>
					<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Reflection Question</h3>
					<div class="bg-gray-50 rounded-xl p-4">
						<p class="text-gray-800 italic">"{viewingReflection.question}"</p>
					</div>
				</div>

				<!-- Student Response -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Student Response</h3>
						<span class="text-sm text-gray-500">{getWordCount(viewingReflection.content)} words • {formatDate(viewingReflection.submittedAt)}</span>
					</div>
					<div class="bg-blue-50 rounded-xl p-5 border border-blue-100">
						<div class="prose prose-sm max-w-none text-gray-800 leading-relaxed">
							{@html viewingReflection.content}
						</div>
					</div>
				</div>

				<!-- Existing Feedback (if any) -->
				{#if viewingReflection.feedback}
					<div>
						<div class="flex items-center gap-2 mb-2">
							<Star size="16" class="text-amber-500" />
							<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Feedback Provided</h3>
						</div>
						<div class="bg-green-50 rounded-xl p-5 border border-green-200">
							<p class="text-gray-800 leading-relaxed">{viewingReflection.feedback}</p>
							{#if viewingReflection.markedBy}
								<p class="text-sm text-gray-500 mt-3">— {viewingReflection.markedBy}</p>
							{/if}
						</div>
					</div>
				{/if}

				<!-- Visibility -->
				<div class="flex items-center gap-3 pt-4 border-t border-gray-200">
					{#if viewingReflection.isPublic}
						<div class="flex items-center gap-2 text-green-700">
							<div class="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
							<span class="text-sm font-medium">Public reflection - visible to cohort</span>
						</div>
					{:else}
						<div class="flex items-center gap-2 text-gray-600">
							<div class="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
							<span class="text-sm font-medium">Private reflection</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-between p-6 bg-gray-50 border-t border-gray-200">
				<div class="text-sm text-gray-500">
					{viewingReflection.student.hub}
				</div>
				<div class="flex gap-3">
					<button
						onclick={closeViewModal}
						disabled={isClaiming}
						class="px-5 py-2.5 font-semibold rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
					>
						Close
					</button>
					{#if needsReview(viewingReflection.dbStatus || viewingReflection.status)}
						<button
							onclick={() => openMarkingModal(viewingReflection)}
							disabled={isClaiming}
							class="px-5 py-2.5 font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
						>
							{#if isClaiming}
								<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
								Claiming...
							{:else}
								Mark Reflection
							{/if}
						</button>
					{:else}
						<button
							onclick={() => openMarkingModal(viewingReflection)}
							disabled={isClaiming}
							class="px-5 py-2.5 font-semibold rounded-lg bg-gray-800 text-white hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center gap-2"
						>
							{#if isClaiming}
								<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
								Opening...
							{:else}
								Edit Marking
							{/if}
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
