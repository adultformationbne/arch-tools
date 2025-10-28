<script>
	import { MessageSquare, CheckCircle, XCircle, Clock, User, Calendar, Filter, Search, Star, X } from 'lucide-svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import { goto, invalidateAll } from '$app/navigation';

	let { data } = $props();

	let selectedFilter = $state('pending');
	let selectedCohort = $state('all');
	let searchQuery = $state('');
	let selectedReflection = $state(null);
	let showMarkingModal = $state(false);
	let isSaving = $state(false);

	// Real reflection data from server
	let reflections = $state(data.reflections || []);
	let cohorts = $state(data.cohorts || []);

	// Sync data when it changes (after invalidateAll)
	$effect(() => {
		reflections = data.reflections || [];
		cohorts = data.cohorts || [];
	});

	let markingForm = $state({
		feedback: '',
		passStatus: 'pass',
		isPublic: false
	});

	const filterOptions = $derived.by(() => [
		{ value: 'all', label: 'All Reflections', count: reflections.length },
		{ value: 'pending', label: 'Pending Review', count: reflections.filter(r => r.status === 'pending').length },
		{ value: 'overdue', label: 'Overdue', count: reflections.filter(r => r.status === 'overdue').length },
		{ value: 'marked', label: 'Recently Marked', count: reflections.filter(r => r.status === 'marked').length }
	]);

	const getStatusColor = (status) => {
		switch (status) {
			case 'pending': return 'bg-orange-100 text-orange-800';
			case 'overdue': return 'bg-red-100 text-red-800';
			case 'marked': return 'bg-green-100 text-green-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

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

		// Filter by status
		if (selectedFilter !== 'all') {
			filtered = filtered.filter(r => r.status === selectedFilter);
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
			// Sort by status priority (overdue first, then pending, then marked)
			const statusOrder = { overdue: 0, pending: 1, marked: 2 };
			if (statusOrder[a.status] !== statusOrder[b.status]) {
				return statusOrder[a.status] - statusOrder[b.status];
			}
			// Then by submission date (newest first)
			return new Date(b.submittedAt) - new Date(a.submittedAt);
		});
	});

	const openMarkingModal = (reflection) => {
		selectedReflection = reflection;
		markingForm = {
			feedback: reflection.feedback || '',
			passStatus: reflection.grade || 'pass',
			isPublic: reflection.isPublic
		};
		showMarkingModal = true;
	};

	const closeMarkingModal = () => {
		showMarkingModal = false;
		selectedReflection = null;
		markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
	};

	const submitMarking = async () => {
		if (!selectedReflection || isSaving) return;

		isSaving = true;

		try {
			const response = await fetch('/admin/reflections/api', {
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

			if (!response.ok) {
				throw new Error('Failed to mark reflection');
			}

			const result = await response.json();
			toastSuccess(result.message || 'Reflection marked successfully');

			// Refresh data
			await invalidateAll();
			closeMarkingModal();

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
</script>

<div class="px-16">
	<div class="py-12">
		<div class="max-w-7xl mx-auto">
			<!-- Header -->
			<div class="flex items-center justify-between mb-8">
				<div>
					<h1 class="text-5xl font-bold text-white mb-2">Reflection Review</h1>
					<p class="text-xl text-white/80">Mark and provide feedback on student reflections</p>
				</div>
				<div class="text-white/80">
					<span class="text-2xl font-bold">{filteredReflections.filter(r => r.status === 'pending' || r.status === 'overdue').length}</span>
					<span class="text-lg">pending review</span>
				</div>
			</div>

			<!-- Filters -->
			<div class="bg-white rounded-2xl p-6 shadow-sm mb-8">
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<!-- Status Filter -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Filter by Status</label>
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
						<label class="block text-sm font-semibold text-gray-700 mb-3">Filter by Cohort</label>
						<select
							bind:value={selectedCohort}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
							style="focus:ring-color: #c59a6b;"
						>
							<option value="all">All Cohorts</option>
							{#each cohorts as cohort}
								<option value={cohort.id}>{cohort.name} - {cohort.moduleName}</option>
							{/each}
						</select>
					</div>

					<!-- Search -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Search</label>
						<div class="relative">
							<Search size="20" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
							<input
								bind:value={searchQuery}
								type="text"
								placeholder="Search by student name or content..."
								class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
								style="focus:ring-color: #c59a6b;"
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
								<!-- Dual Badge System -->
								{#if reflection.status === 'pending' || reflection.status === 'overdue'}
									<!-- Student has submitted, awaiting feedback -->
									<span class="px-3 py-1 rounded-full text-sm font-semibold border-2 border-green-300 bg-green-50 text-green-700 flex items-center gap-1">
										<CheckCircle size="14" />
										Submitted
									</span>
									<span class="px-3 py-1 rounded-full text-sm font-semibold {reflection.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
										{reflection.status === 'overdue' ? 'Overdue Review' : 'Awaiting Feedback'}
									</span>
								{:else if reflection.status === 'marked'}
									<!-- Marked as passed or needs revision -->
									{#if reflection.grade === 'pass'}
										<span class="px-3 py-1 rounded-full text-sm font-semibold bg-green-600 text-white flex items-center gap-1">
											<CheckCircle size="14" />
											Passed
										</span>
									{:else if reflection.grade === 'fail'}
										<span class="px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-800 flex items-center gap-1">
											<XCircle size="14" />
											Needs Revision
										</span>
									{/if}
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
						<div class="mb-4">
							<p class="text-gray-800 leading-relaxed">
								{reflection.content.length > 300 ? reflection.content.substring(0, 300) + '...' : reflection.content}
							</p>
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
							<div class="flex gap-3">
								<button
									class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
									style="background-color: #eae2d9; color: #334642;"
								>
									View Full
								</button>
								{#if reflection.status === 'pending' || reflection.status === 'overdue'}
									<button
										onclick={() => openMarkingModal(reflection)}
										class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
										style="background-color: #c59a6b; color: white;"
									>
										Mark Reflection
									</button>
								{:else}
									<button
										onclick={() => openMarkingModal(reflection)}
										class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
										style="background-color: #334642; color: white;"
									>
										Edit Marking
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}

				{#if filteredReflections.length === 0}
					<div class="text-center py-12">
						<MessageSquare size="64" class="mx-auto mb-4 text-gray-400" />
						<h3 class="text-xl font-bold text-gray-600 mb-2">No reflections found</h3>
						<p class="text-gray-500">Try adjusting your filters or search criteria</p>
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
					<div class="bg-gray-50 rounded-lg p-6">
						<p class="text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedReflection.content}</p>
						<div class="mt-4 text-sm text-gray-500">
							{getWordCount(selectedReflection.content)} words • Submitted {formatDate(selectedReflection.submittedAt)}
						</div>
					</div>
				</div>

				<!-- Marking Form -->
				<div class="space-y-6">
					<!-- Pass/Fail -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Assessment</label>
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
					</div>

					<!-- Feedback -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Feedback for Student</label>
						<textarea
							bind:value={markingForm.feedback}
							placeholder="Provide constructive feedback to help the student grow in their faith journey..."
							rows="6"
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
							style="focus:ring-color: #c59a6b;"
						></textarea>
						<p class="text-xs text-gray-500 mt-1">This feedback will be visible to the student</p>
					</div>

					<!-- Actions -->
					<div class="flex gap-4 pt-4">
						<button
							onclick={submitMarking}
							disabled={isSaving}
							class="flex-1 py-3 px-6 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							style="background-color: #c59a6b; color: white;"
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