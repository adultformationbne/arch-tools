<script>
	import { ChevronDown, ChevronUp, Edit3, Calendar, Users, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-svelte';
	import ReflectionWriter from '../ReflectionWriter.svelte';
	import { goto } from '$app/navigation';
	import { ReflectionStatus } from '$lib/utils/reflection-status.js';

	// Get data from server load
	let { data } = $props();

	// Extract data from server load
	const { myReflections, cohortReflections, currentReflectionQuestion } = data;

	// Page state
	let activeTab = $state('my-reflections'); // 'my-reflections' | 'my-cohort'
	let showReflectionWriter = $state(false);
	let expandedReflections = $state(new Set()); // Track which reflections are expanded
	let selectedReflection = $state(null); // Track which reflection is being edited


	// Toggle functions
	const toggleReflectionExpansion = (reflectionId) => {
		if (expandedReflections.has(reflectionId)) {
			expandedReflections.delete(reflectionId);
		} else {
			expandedReflections.add(reflectionId);
		}
		expandedReflections = new Set(expandedReflections);
	};

	const openReflectionWriter = (reflection = null) => {
		selectedReflection = reflection;
		showReflectionWriter = true;

		// Scroll to top to show the reflection writer
		setTimeout(() => {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}, 100);
	};

	const closeReflectionWriter = () => {
		showReflectionWriter = false;
		selectedReflection = null;
	};

	const handleReflectionSave = async () => {
		console.log('Reflection saved, refreshing page data...');
		closeReflectionWriter();

		// Invalidate and reload the page data
		await goto('/reflections', { invalidateAll: true });
		console.log('Page data refreshed');
	};

	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const truncateText = (text, maxLength = 200) => {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	};
</script>

<!-- Single content wrapper with consistent margins -->
<div class="px-16 space-y-8">

	<!-- Reflection Writer Component (appears at top when active) -->
	{#if showReflectionWriter}
		<div class="pt-8 pb-4">
			<div class="max-w-4xl mx-auto">
				<ReflectionWriter
					bind:isVisible={showReflectionWriter}
					question={selectedReflection?.question || currentReflectionQuestion?.question || ''}
					questionId={selectedReflection?.questionId || currentReflectionQuestion?.questionId}
					existingContent={selectedReflection?.myResponse || ''}
					existingIsPublic={selectedReflection?.isPublic || false}
					onClose={closeReflectionWriter}
					onSave={handleReflectionSave}
				/>
			</div>
		</div>
	{/if}

	<div class="py-8">
		<div class="max-w-4xl mx-auto">

			<!-- Page Header -->
			<div class="mb-8">
				<h1 class="text-4xl font-bold text-white mb-2">Reflections</h1>
				<p class="text-white opacity-75">Your spiritual journey through weekly reflections</p>
			</div>

			<!-- Current Reflection Due (if applicable) -->
			{#if currentReflectionQuestion && !currentReflectionQuestion.hasSubmitted}
				<div class="bg-white rounded-2xl p-6 mb-8 border-l-4" style="border-color: var(--course-accent-light);">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2 mb-2">
								<Edit3 size="20" style="color: var(--course-accent-light);" />
								<h3 class="text-xl font-bold text-gray-800">Session {currentReflectionQuestion.sessionNumber} Reflection Due</h3>
								{#if currentReflectionQuestion.isOverdue}
									<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
										Overdue
									</span>
								{/if}
							</div>
							<p class="text-gray-700 mb-4 text-lg leading-relaxed">
								{currentReflectionQuestion.question}
							</p>
							<p class="text-sm text-gray-600 mb-4">
								Due: {formatDate(currentReflectionQuestion.dueDate)}
							</p>
						</div>
						<button
							onclick={() => openReflectionWriter(currentReflectionQuestion)}
							class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90"
							style="background-color: var(--course-accent-dark);"
						>
							<Edit3 size="18" />
							Write Reflection
						</button>
					</div>
				</div>
			{/if}

			<!-- Tab Navigation -->
			<div class="flex gap-1 mb-8 p-1 rounded-2xl" style="background-color: rgba(234, 226, 217, 0.1);">
				<button
					onclick={() => activeTab = 'my-reflections'}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors"
					class:bg-white={activeTab === 'my-reflections'}
					class:text-gray-800={activeTab === 'my-reflections'}
					class:text-white={activeTab !== 'my-reflections'}
					class:opacity-75={activeTab !== 'my-reflections'}
				>
					<Calendar size="18" />
					My Reflections
				</button>
				<button
					onclick={() => activeTab = 'my-cohort'}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors"
					class:bg-white={activeTab === 'my-cohort'}
					class:text-gray-800={activeTab === 'my-cohort'}
					class:text-white={activeTab !== 'my-cohort'}
					class:opacity-75={activeTab !== 'my-cohort'}
				>
					<Users size="18" />
					My Cohort
				</button>
			</div>

			<!-- Reflections Feed -->
			<div class="space-y-6">
				{#if activeTab === 'my-reflections'}
					<!-- My Reflections -->
					{#each myReflections as reflection}
						<div class="bg-white rounded-2xl p-6 shadow-sm">
							<!-- Reflection Header -->
							<div class="flex items-start justify-between mb-4">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<h3 class="text-xl font-bold text-gray-800">Session {reflection.sessionNumber}</h3>

										<!-- Dual Badge System -->
										{#if reflection.status === ReflectionStatus.SUBMITTED}
											<!-- Submitted and awaiting feedback -->
											<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border-2 border-green-300 bg-green-50 text-green-700">
												<CheckCircle size="14" />
												Submitted
											</div>
											<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-700">
												<Clock size="14" />
												Awaiting Feedback
											</div>
										{:else if reflection.status === ReflectionStatus.MARKED_PASS}
											<!-- Passed -->
											<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-green-600 text-white">
												<CheckCircle size="14" />
												Passed
											</div>
										{:else if reflection.status === ReflectionStatus.NEEDS_REVISION}
											<!-- Needs revision -->
											<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700">
												<AlertCircle size="14" />
												Needs Revision
											</div>
										{:else if reflection.status === ReflectionStatus.MARKED_FAIL}
											<!-- Failed -->
											<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
												<AlertCircle size="14" />
												Needs Work
											</div>
										{:else if reflection.status === ReflectionStatus.OVERDUE}
											<!-- Overdue -->
											<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
												<AlertCircle size="14" />
												Overdue
											</div>
										{:else}
											<!-- Not started -->
											<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
												<Edit3 size="14" />
												Not Started
											</div>
										{/if}
									</div>
									<p class="text-gray-700 font-medium mb-3">{reflection.question}</p>
								</div>
							</div>

							{#if reflection.status === ReflectionStatus.NOT_SUBMITTED || reflection.status === ReflectionStatus.OVERDUE}
								<!-- Not started or overdue -->
								<div class="text-center py-8">
									<p class="text-gray-600 mb-4">
										{reflection.status === ReflectionStatus.OVERDUE ? 'This reflection is overdue for marking.' : 'You haven\'t written this reflection yet.'}
									</p>
									<button
										onclick={() => openReflectionWriter(reflection)}
										class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90 mx-auto"
										style="background-color: var(--course-accent-dark);"
									>
										<Edit3 size="18" />
										{reflection.status === ReflectionStatus.OVERDUE ? 'View Submitted Reflection' : 'Write Reflection'}
									</button>
								</div>
							{:else if reflection.status === ReflectionStatus.NEEDS_REVISION}
								<!-- Needs revision - show content but highlight revision needed -->
								<div class="space-y-4">
									<div class="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-xl mb-4">
										<p class="text-orange-800 font-medium">
											Your reflection needs revision. Please review the feedback below and resubmit.
										</p>
									</div>
									<!-- My Response -->
									<div>
										<h4 class="font-semibold text-gray-800 mb-2">Your Response</h4>
										<div class="bg-gray-50 rounded-xl p-4">
											{#if expandedReflections.has(reflection.id)}
												<p class="text-gray-700 leading-relaxed whitespace-pre-line">{reflection.myResponse}</p>
											{:else}
												<p class="text-gray-700 leading-relaxed">{truncateText(reflection.myResponse)}</p>
											{/if}
											{#if reflection.myResponse.length > 200}
												<button
													onclick={() => toggleReflectionExpansion(reflection.id)}
													class="flex items-center gap-1 mt-3 text-sm font-medium transition-colors"
													style="color: var(--course-accent-light);"
												>
													{expandedReflections.has(reflection.id) ? 'Show Less' : 'Read More'}
													{#if expandedReflections.has(reflection.id)}
														<ChevronUp size="14" />
													{:else}
														<ChevronDown size="14" />
													{/if}
												</button>
											{/if}
										</div>
									</div>

									<!-- Feedback -->
									{#if reflection.feedback}
										<div>
											<div class="flex items-center justify-between mb-2">
												<h4 class="font-semibold text-gray-800">Feedback</h4>
												<div class="text-sm text-gray-600">
													{reflection.markedBy} • {formatDate(reflection.markedAt)}
												</div>
											</div>
											<div class="rounded-xl p-4" style="background-color: #f9f6f2;">
												<p class="text-gray-700 leading-relaxed">{reflection.feedback}</p>
											</div>
										</div>
									{/if}

									<button
										onclick={() => openReflectionWriter(reflection)}
										class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90"
										style="background-color: var(--course-accent-dark);"
									>
										<Edit3 size="18" />
										Revise Reflection
									</button>
								</div>
							{:else}
								<!-- Has content -->
								<div class="space-y-4">
									<!-- My Response -->
									<div>
										<h4 class="font-semibold text-gray-800 mb-2">Your Response</h4>
										<div class="bg-gray-50 rounded-xl p-4">
											{#if expandedReflections.has(reflection.id)}
												<p class="text-gray-700 leading-relaxed whitespace-pre-line">{reflection.myResponse}</p>
											{:else}
												<p class="text-gray-700 leading-relaxed">{truncateText(reflection.myResponse)}</p>
											{/if}
											{#if reflection.myResponse.length > 200}
												<button
													onclick={() => toggleReflectionExpansion(reflection.id)}
													class="flex items-center gap-1 mt-3 text-sm font-medium transition-colors"
													style="color: var(--course-accent-light);"
												>
													{expandedReflections.has(reflection.id) ? 'Show Less' : 'Read More'}
													{#if expandedReflections.has(reflection.id)}
														<ChevronUp size="14" />
													{:else}
														<ChevronDown size="14" />
													{/if}
												</button>
											{/if}
										</div>
									</div>

									<!-- Feedback (if available) -->
									{#if reflection.feedback}
										<div>
											<div class="flex items-center justify-between mb-2">
												<h4 class="font-semibold text-gray-800">Feedback</h4>
												<div class="text-sm text-gray-600">
													{reflection.markedBy} • {formatDate(reflection.markedAt)}
												</div>
											</div>
											<div class="rounded-xl p-4" style="background-color: #f9f6f2;">
												<p class="text-gray-700 leading-relaxed">{reflection.feedback}</p>
											</div>
										</div>
									{/if}

									<!-- Submission Info -->
									{#if reflection.submittedAt}
										<div class="text-sm text-gray-600 pt-2 border-t border-gray-200">
											Submitted on {formatDate(reflection.submittedAt)}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}

				{:else}
					<!-- My Cohort Reflections -->
					{#each cohortReflections as reflection}
						<div class="bg-white rounded-2xl p-6 shadow-sm">
							<!-- Student Header -->
							<div class="flex items-center gap-3 mb-4">
								<div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style="background-color: var(--course-accent-dark);">
									{reflection.studentInitials}
								</div>
								<div class="flex-1">
									<h3 class="font-semibold text-gray-800">{reflection.studentName}</h3>
									<p class="text-sm text-gray-600">Session {reflection.sessionNumber} • {formatDate(reflection.submittedAt)}</p>
								</div>
								<div class="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
									<MessageSquare size="14" />
									Public
								</div>
							</div>

							<!-- Question -->
							<p class="text-gray-700 font-medium mb-4">{reflection.question}</p>

							<!-- Response (always full for cohort) -->
							<div class="bg-gray-50 rounded-xl p-4">
								<p class="text-gray-700 leading-relaxed whitespace-pre-line">{reflection.response}</p>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

</div>