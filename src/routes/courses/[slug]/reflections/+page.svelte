<script>
	import { ChevronDown, ChevronUp, Edit3, Calendar, Users, MessageSquare } from 'lucide-svelte';
	import { isEditable, isComplete, normalizeStatus } from '$lib/utils/reflection-status.js';
	import ReflectionStatusBadge from '$lib/components/ReflectionStatusBadge.svelte';

	// Get data from server load
	let { data } = $props();

	// Extract data from server load
	const { myReflections, cohortReflections, currentReflectionQuestion, courseSlug } = data;

	// Page state
	let activeTab = $state('my-reflections'); // 'my-reflections' | 'my-cohort'
	let expandedReflections = $state(new Set()); // Track which reflections are expanded

	// Toggle functions
	const toggleReflectionExpansion = (reflectionId) => {
		if (expandedReflections.has(reflectionId)) {
			expandedReflections.delete(reflectionId);
		} else {
			expandedReflections.add(reflectionId);
		}
		expandedReflections = new Set(expandedReflections);
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
						<a
							href="/courses/{courseSlug}/write/{currentReflectionQuestion.questionId}"
							class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90 no-underline"
							style="background-color: var(--course-accent-dark);"
						>
							<Edit3 size="18" />
							Write Reflection
						</a>
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
										{#if reflection.status !== 'not_started'}
											<ReflectionStatusBadge status={reflection.status} />
										{:else}
											<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
												<Edit3 size="12" />
												Not Started
											</span>
										{/if}
									</div>
									<p class="text-gray-700 font-medium mb-3">{reflection.question}</p>
								</div>
							</div>

							{#if reflection.status === 'not_started'}
								<!-- Not started -->
								<div class="text-center py-8">
									<p class="text-gray-600 mb-4">
										You haven't written this reflection yet.
									</p>
									<a
										href="/courses/{courseSlug}/write/{reflection.questionId}"
										class="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90 no-underline"
										style="background-color: var(--course-accent-dark);"
									>
										<Edit3 size="18" />
										Write Reflection
									</a>
								</div>
							{:else if reflection.status === 'needs_revision'}
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
										<div class="bg-gray-50 rounded-xl p-4 prose prose-sm max-w-none">
											{#if expandedReflections.has(reflection.id)}
												<div class="text-gray-700 leading-relaxed">
													{@html reflection.myResponse}
												</div>
											{:else}
												<div class="text-gray-700 leading-relaxed">
													{@html truncateText(reflection.myResponse)}
												</div>
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

									<a
										href="/courses/{courseSlug}/write/{reflection.questionId}"
										class="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90 no-underline"
										style="background-color: var(--course-accent-dark);"
									>
										<Edit3 size="18" />
										Revise Reflection
									</a>
								</div>
							{:else}
								<!-- Has content -->
								<div class="space-y-4">
									<!-- My Response -->
									<div>
										<h4 class="font-semibold text-gray-800 mb-2">Your Response</h4>
										<div class="bg-gray-50 rounded-xl p-4 prose prose-sm max-w-none">
											{#if expandedReflections.has(reflection.id)}
												<div class="text-gray-700 leading-relaxed">
													{@html reflection.myResponse}
												</div>
											{:else}
												<div class="text-gray-700 leading-relaxed">
													{@html truncateText(reflection.myResponse)}
												</div>
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

									<!-- Edit Button (if submitted but not reviewed yet) -->
									{#if isEditable(reflection.status) || (reflection.status === 'submitted' && !reflection.markedBy)}
										<div class="pt-2 border-t border-gray-200">
											<p class="text-sm text-gray-600 mb-3">
												You can still edit this reflection until it's reviewed.
											</p>
											<a
												href="/courses/{courseSlug}/write/{reflection.questionId}"
												class="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-colors hover:opacity-90"
												style="background-color: var(--course-accent-dark);"
											>
												<Edit3 size="16" />
												Edit Reflection
											</a>
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
							<div class="bg-gray-50 rounded-xl p-4 prose prose-sm max-w-none">
								<div class="text-gray-700 leading-relaxed">
									{@html reflection.response}
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

</div>