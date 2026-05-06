<script>
	import { Play, FileText, Book, Edit3, Eye, ChevronLeft, ChevronRight, ChevronDown, BookOpen, PenTool, Zap, Lock } from '$lib/icons';
	import SessionNavigationTabs from './SessionNavigationTabs.svelte';
	import { getStatusLabel, isComplete } from '$lib/utils/reflection-status.js';

	let {
		currentSession = $bindable(),
		availableSessions,
		courseData,
		courseSlug,
		materials,
		currentSessionData,
		onSessionChange,
		totalSessions,
		maxSessionNumber,
		featureSettings = {},
		quizzesBySession = {}
	} = $props();

	// Check if features are enabled (default true for backwards compatibility)
	const reflectionsEnabled = $derived(featureSettings?.reflectionsEnabled !== false);
	const materialsEnabled = $derived(featureSettings?.materialsEnabled !== false);

	// Question truncation length
	const QUESTION_TRUNCATE_LENGTH = 200;

	// Determine if we should show tabbed sidebar (only for 6-12 sessions)
	const showTabbedSidebar = $derived(totalSessions >= 6 && totalSessions <= 12);

	// Navigation helpers (session 0 is Pre-Start)
	const canGoPrevious = $derived(currentSession > 0);
	const canGoNext = $derived(currentSession < availableSessions);

	const goToPrevious = () => {
		if (canGoPrevious) {
			currentSession = currentSession - 1;
			onSessionChange(currentSession);
		}
	};

	const goToNext = () => {
		if (canGoNext) {
			currentSession = currentSession + 1;
			onSessionChange(currentSession);
		}
	};

	// Custom dropdown state
	let dropdownOpen = $state(false);

	const getSessionLabel = (sessionNum) => {
		return sessionNum === 0 ? 'Pre-Start' : `Session ${sessionNum}`;
	};

	const selectSession = (sessionNum) => {
		if (sessionNum <= availableSessions) {
			currentSession = sessionNum;
			onSessionChange(sessionNum);
			dropdownOpen = false;
		}
	};

	// Close dropdown when clicking outside
	$effect(() => {
		const handleClickOutside = (event) => {
			if (dropdownOpen && !event.target.closest('.session-dropdown')) {
				dropdownOpen = false;
			}
		};

		if (dropdownOpen) {
			document.addEventListener('click', handleClickOutside);
			return () => document.removeEventListener('click', handleClickOutside);
		}
	});

	// Icon mapping for materials
	const getIcon = (type) => {
		switch(type) {
			case 'video': return Play;
			case 'document': return FileText;
			case 'native': return Book;
			case 'link': return FileText;
			default: return FileText;
		}
	};

	// Helper to truncate question text
	const truncateQuestion = (text) => {
		if (!text || text.length <= QUESTION_TRUNCATE_LENGTH) return { truncated: text, needsTruncation: false };
		return {
			truncated: text.slice(0, QUESTION_TRUNCATE_LENGTH) + '...',
			needsTruncation: true
		};
	};

	// Quiz helpers
	const currentQuiz = $derived(quizzesBySession[currentSession] ?? null);

	const getQuizStatusLabel = (status) => {
		if (!status) return 'Not started';
		const labels = {
			in_progress: 'In progress',
			submitted: 'Submitted',
			passed: 'Passed',
			failed: 'Failed',
			pending_review: 'Pending review',
			reviewing: 'Being reviewed'
		};
		return labels[status] ?? status;
	};

	const getQuizStatusColor = (status) => {
		if (!status) return 'bg-orange-400';
		if (status === 'passed') return 'bg-green-500';
		if (status === 'failed') return 'bg-red-400';
		if (status === 'pending_review' || status === 'reviewing') return 'bg-blue-400';
		return 'bg-orange-400';
	};

	const getQuizButtonLabel = (status, quiz) => {
		if (!status) return 'Start Quiz';
		if (status === 'in_progress') return 'Continue Quiz';
		if (status === 'passed') return 'View Results';
		if (status === 'failed' && quiz?.allow_retakes) return 'Retake Quiz';
		if (status === 'failed') return 'View Results';
		if (status === 'pending_review' || status === 'reviewing') return 'View Submission';
		return 'View Results';
	};

	// Helper to get reflection button label based on status
	const getReflectionButtonLabel = (status) => {
		if (status === 'draft') return 'Continue';
		if (status === 'not_started') return 'Write';
		if (isComplete(status)) return 'View';
		return 'Edit';
	};
</script>

<div class="pt-4 pb-6">
	<div class="max-w-7xl mx-auto">
		{#if showTabbedSidebar}
			<!-- Tabbed sidebar layout (for 6-12 sessions, including Pre-Start) -->
			<SessionNavigationTabs
				bind:currentSession={currentSession}
				totalSessions={maxSessionNumber}
				{availableSessions}
				{onSessionChange}
			>
				<!-- Thin Top Navigation Bar -->
				<div class="px-6 pt-2 pb-2">
					<div class="flex items-center justify-center gap-3 text-sm">
						{#if canGoPrevious}
							<button
								onclick={goToPrevious}
								class="flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
							>
								<ChevronLeft size={16} />
								<span>Previous</span>
							</button>
						{:else}
							<span class="flex items-center gap-1 text-gray-400">
								<ChevronLeft size={16} />
								<span>Previous</span>
							</span>
						{/if}

						<span class="text-gray-400">|</span>

						<!-- Custom Dropdown -->
						<div class="relative session-dropdown">
							<button
								onclick={() => dropdownOpen = !dropdownOpen}
								class="px-3 py-1 rounded-lg font-medium text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-1"
							>
								{getSessionLabel(currentSession)}
								<ChevronDown size={14} />
							</button>

							{#if dropdownOpen}
								<div class="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] z-50">
									<button
										onclick={() => selectSession(0)}
										class="w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 transition-colors"
										class:bg-gray-100={currentSession === 0}
										class:font-semibold={currentSession === 0}
									>
										Pre-Start
									</button>
									{#each Array.from({ length: maxSessionNumber }, (_, i) => i + 1) as sessionNum}
										<button
											onclick={() => selectSession(sessionNum)}
											disabled={sessionNum > availableSessions}
											class="w-full px-4 py-2 text-left text-sm transition-colors"
											class:text-gray-800={sessionNum <= availableSessions}
											class:hover:bg-gray-100={sessionNum <= availableSessions}
											class:bg-gray-100={currentSession === sessionNum}
											class:font-semibold={currentSession === sessionNum}
											class:text-gray-400={sessionNum > availableSessions}
											class:cursor-not-allowed={sessionNum > availableSessions}
										>
											Session {sessionNum}
											{#if sessionNum > availableSessions}
												<span class="text-xs">(Locked)</span>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<span class="text-gray-400">|</span>

						{#if canGoNext}
							<button
								onclick={goToNext}
								class="flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
							>
								<span>Next</span>
								<ChevronRight size={16} />
							</button>
						{:else}
							<span class="flex items-center gap-1 text-gray-400">
								<span>Next</span>
								<ChevronRight size={16} />
							</span>
						{/if}
					</div>
				</div>

				<!-- Separator Line -->
				<div class="border-t border-gray-300 mx-6"></div>

				<!-- Main Content - 4 Quadrant Grid -->
				<div class="p-6 sm:p-8 lg:p-10 min-h-[400px]">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 h-full">
						<!-- Top Left: Title -->
						<div class="flex flex-col order-1 lg:order-none">
							<p class="text-xs font-medium text-gray-500 mb-1">{courseData.title}</p>
							<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" style="color: var(--course-accent-dark, #334642);">
								{currentSessionData.sessionTitle}
							</h1>
							<div class="flex items-center gap-2">
								<h2 class="text-base font-semibold" style="color: var(--course-accent-light, #c59a6b);">{currentSession === 0 ? 'Pre-Start' : `Session ${currentSession}`}</h2>
								<div class="h-1 w-10 rounded" style="background-color: var(--course-accent-light, #c59a6b);"></div>
							</div>
						</div>

						<!-- Top Right: Materials (order-3 on mobile to appear after overview) -->
						{#if materialsEnabled}
						<div class="order-3 lg:order-none">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{currentSession === 0 ? 'Welcome Materials' : 'Materials'}</h3>
							<div class="flex flex-wrap gap-2">
								{#if materials.length === 0}
									<div class="w-full flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-gray-100/50">
										<BookOpen size={28} class="text-gray-400 mb-2" />
										<p class="text-gray-500 text-sm text-center">No materials required for this session</p>
									</div>
								{/if}
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors cursor-pointer no-underline text-sm font-medium"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: var(--course-accent-dark, #334642);" : "background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 12%, white);"}
									>
										<IconComponent size="14" class={index === 0 ? "text-white" : "text-gray-600"} />
										<span class:text-white={index === 0} class:text-gray-700={index !== 0}>
											{material.title}
										</span>
										{#if material.isRestricted}
											<Lock size="11" class="{index === 0 ? 'text-white/70' : 'text-gray-400'}" />
										{/if}
									</a>
								{/each}
							</div>
						</div>
						{/if}

						<!-- Bottom Left: Session Overview (order-2 on mobile to appear after title) -->
						<div class="flex flex-col order-2 lg:order-none">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Session Overview</h3>
							<p class="text-sm text-gray-700 leading-relaxed">
								{currentSessionData.sessionOverview}
							</p>
						</div>

						<!-- Bottom Right: Reflection (order-4 on mobile to appear last) -->
						{#if reflectionsEnabled}
							<div class="flex flex-col justify-start order-4 lg:order-none" class:bg-white={currentSessionData.reflectionQuestion} class:rounded-xl={currentSessionData.reflectionQuestion} class:p-5={currentSessionData.reflectionQuestion} class:shadow-sm={currentSessionData.reflectionQuestion}>
							{#if currentSessionData.reflectionQuestion}
								{@const questionText = currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
								{@const { truncated, needsTruncation } = truncateQuestion(questionText)}
								<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reflection</h3>
								<p class="text-sm font-semibold text-gray-800 mb-3 leading-snug">
									{truncated}
									{#if needsTruncation}
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="text-xs font-medium ml-1 no-underline hover:underline"
											style="color: var(--course-accent-dark, #c59a6b);"
										>
											more
										</a>
									{/if}
								</p>
								<div class="flex items-center justify-between mt-auto pt-2">
									<div class="flex items-center gap-2">
										<div
											class="w-2.5 h-2.5 rounded-full"
											class:bg-orange-400={currentSessionData.reflectionStatus === 'not_started'}
											class:bg-green-500={isComplete(currentSessionData.reflectionStatus)}
											class:bg-amber-500={currentSessionData.reflectionStatus === 'needs_revision'}
											class:bg-blue-400={!isComplete(currentSessionData.reflectionStatus) && currentSessionData.reflectionStatus !== 'not_started' && currentSessionData.reflectionStatus !== 'needs_revision'}
										></div>
										<span class="text-gray-600 text-xs font-medium">
											{currentSessionData.reflectionStatus === 'not_started' ? 'Not started' : getStatusLabel(currentSessionData.reflectionStatus)}
										</span>
									</div>
									<a
										href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
										class="flex items-center gap-1.5 px-3 py-1.5 text-white font-semibold text-xs rounded-lg transition-colors hover:opacity-90 no-underline"
										style="background-color: var(--course-accent-dark, #334642);"
									>
										{#if isComplete(currentSessionData.reflectionStatus)}
											<Eye size="14" />
										{:else}
											<Edit3 size="14" />
										{/if}
										{getReflectionButtonLabel(currentSessionData.reflectionStatus)}
									</a>
								</div>
							{:else}
								<div class="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-gray-100/50">
									<PenTool size={28} class="text-gray-400 mb-2" />
									<p class="text-gray-500 text-sm text-center">No reflection for this session</p>
								</div>
							{/if}
							</div>
						{/if}
					</div>
				</div>
			</SessionNavigationTabs>
		{:else if currentSession === 0}
			<!-- Pre-Start: No tabs (for <6 or >12 sessions) -->
			<div class="rounded-xl" style="background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 20%, white);">
				<!-- Thin Top Navigation Bar -->
				<div class="px-6 pt-2 pb-2">
					<div class="flex items-center justify-center gap-3 text-sm">
						{#if canGoPrevious}
							<button
								onclick={goToPrevious}
								class="flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
							>
								<ChevronLeft size={16} />
								<span>Previous</span>
							</button>
						{:else}
							<span class="flex items-center gap-1 text-gray-400">
								<ChevronLeft size={16} />
								<span>Previous</span>
							</span>
						{/if}

						<span class="text-gray-400">|</span>

						<!-- Custom Dropdown -->
						<div class="relative session-dropdown">
							<button
								onclick={() => dropdownOpen = !dropdownOpen}
								class="px-3 py-1 rounded-lg font-medium text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-1"
							>
								{getSessionLabel(currentSession)}
								<ChevronDown size={14} />
							</button>

							{#if dropdownOpen}
								<div class="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] z-50">
									<button
										onclick={() => selectSession(0)}
										class="w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 transition-colors"
										class:bg-gray-100={currentSession === 0}
										class:font-semibold={currentSession === 0}
									>
										Pre-Start
									</button>
									{#each Array.from({ length: maxSessionNumber }, (_, i) => i + 1) as sessionNum}
										<button
											onclick={() => selectSession(sessionNum)}
											disabled={sessionNum > availableSessions}
											class="w-full px-4 py-2 text-left text-sm transition-colors"
											class:text-gray-800={sessionNum <= availableSessions}
											class:hover:bg-gray-100={sessionNum <= availableSessions}
											class:bg-gray-100={currentSession === sessionNum}
											class:font-semibold={currentSession === sessionNum}
											class:text-gray-400={sessionNum > availableSessions}
											class:cursor-not-allowed={sessionNum > availableSessions}
										>
											Session {sessionNum}
											{#if sessionNum > availableSessions}
												<span class="text-xs">(Locked)</span>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<span class="text-gray-400">|</span>

						{#if canGoNext}
							<button
								onclick={goToNext}
								class="flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
							>
								<span>Next</span>
								<ChevronRight size={16} />
							</button>
						{:else}
							<span class="flex items-center gap-1 text-gray-400">
								<span>Next</span>
								<ChevronRight size={16} />
							</span>
						{/if}
					</div>
				</div>

				<!-- Separator Line -->
				<div class="border-t border-gray-300 mx-6"></div>

				<!-- Main Content - 4 Quadrant Grid -->
				<div class="p-6 sm:p-8 lg:p-10">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
						<!-- Top Left: Session Header -->
						<div class="flex flex-col justify-start order-1 lg:order-none">
							<p class="text-xs font-medium text-gray-500 mb-1">{courseData.title}</p>
							<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" style="color: var(--course-accent-dark, #334642);">
								{currentSessionData.sessionTitle}
							</h1>
							<div class="flex items-center gap-2">
								<h2 class="text-base font-semibold" style="color: var(--course-accent-light, #c59a6b);">Pre-Start</h2>
								<div class="h-1 w-10 rounded" style="background-color: var(--course-accent-light, #c59a6b);"></div>
							</div>
						</div>

						<!-- Top Right: Materials (order-3 on mobile) -->
						{#if materialsEnabled}
						<div class="flex flex-col order-3 lg:order-none">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Welcome Materials</h3>
							<div class="space-y-2">
								{#if materials.length === 0}
									<div class="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-gray-100/50">
										<BookOpen size={28} class="text-gray-400 mb-2" />
										<p class="text-gray-500 text-sm text-center">No materials required for this session</p>
									</div>
								{/if}
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer no-underline"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: var(--course-accent-dark, #334642);" : "background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 12%, white);"}
									>
										<IconComponent size="16" class={index === 0 ? "text-white" : "text-gray-600"} />
										<span class="font-medium text-sm" class:text-white={index === 0} class:text-gray-700={index !== 0}>
											{material.title}
										</span>
										{#if material.isRestricted}
											<Lock size="13" class="ml-auto {index === 0 ? 'text-white/70' : 'text-gray-400'}" />
										{/if}
									</a>
								{/each}
							</div>
						</div>
						{/if}

						<!-- Bottom Left: Session Overview (order-2 on mobile) -->
						<div class="flex flex-col order-2 lg:order-none">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Session Overview</h3>
							<p class="text-sm text-gray-700 leading-relaxed">
								{currentSessionData.sessionOverview}
							</p>
						</div>

						<!-- Bottom Right: Reflection (order-4 on mobile) -->
							{#if reflectionsEnabled}
								<div class="flex flex-col justify-start order-4 lg:order-none" class:bg-white={currentSessionData.reflectionQuestion} class:rounded-xl={currentSessionData.reflectionQuestion} class:p-5={currentSessionData.reflectionQuestion} class:shadow-sm={currentSessionData.reflectionQuestion}>
								{#if currentSessionData.reflectionQuestion}
									{@const questionText = currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
									{@const { truncated, needsTruncation } = truncateQuestion(questionText)}
									<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reflection</h3>
									<p class="text-sm font-semibold text-gray-800 mb-3 leading-snug">
										{truncated}
										{#if needsTruncation}
											<a
												href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
												class="text-xs font-medium ml-1 no-underline hover:underline"
												style="color: var(--course-accent-dark, #c59a6b);"
											>
												more
											</a>
										{/if}
									</p>
									<div class="flex items-center justify-between mt-auto pt-2">
										<div class="flex items-center gap-2">
											<div
												class="w-2.5 h-2.5 rounded-full"
												class:bg-orange-400={currentSessionData.reflectionStatus === 'not_started'}
												class:bg-green-500={isComplete(currentSessionData.reflectionStatus)}
												class:bg-amber-500={currentSessionData.reflectionStatus === 'needs_revision'}
												class:bg-blue-400={!isComplete(currentSessionData.reflectionStatus) && currentSessionData.reflectionStatus !== 'not_started' && currentSessionData.reflectionStatus !== 'needs_revision'}
											></div>
											<span class="text-gray-600 text-xs font-medium">
												{currentSessionData.reflectionStatus === 'not_started' ? 'Not started' : getStatusLabel(currentSessionData.reflectionStatus)}
											</span>
										</div>
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="flex items-center gap-1.5 px-3 py-1.5 text-white font-semibold text-xs rounded-lg transition-colors hover:opacity-90 no-underline"
											style="background-color: var(--course-accent-dark, #334642);"
										>
											{#if isComplete(currentSessionData.reflectionStatus)}
												<Eye size="14" />
											{:else}
												<Edit3 size="14" />
											{/if}
											{getReflectionButtonLabel(currentSessionData.reflectionStatus)}
										</a>
									</div>
								{:else}
									<div class="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-gray-100/50">
										<PenTool size={28} class="text-gray-400 mb-2" />
										<p class="text-gray-500 text-sm text-center">No reflection for this session</p>
									</div>
								{/if}
								</div>
							{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- Regular sessions without tabs (for <6 or >12 sessions) -->
			<div class="rounded-xl" style="background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 20%, white);">
				<!-- Thin Top Navigation Bar -->
				<div class="px-6 pt-2 pb-2">
					<div class="flex items-center justify-center gap-3 text-sm">
						{#if canGoPrevious}
							<button
								onclick={goToPrevious}
								class="flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
							>
								<ChevronLeft size={16} />
								<span>Previous</span>
							</button>
						{:else}
							<span class="flex items-center gap-1 text-gray-400">
								<ChevronLeft size={16} />
								<span>Previous</span>
							</span>
						{/if}

						<span class="text-gray-400">|</span>

						<!-- Custom Dropdown -->
						<div class="relative session-dropdown">
							<button
								onclick={() => dropdownOpen = !dropdownOpen}
								class="px-3 py-1 rounded-lg font-medium text-gray-700 hover:bg-white/50 transition-colors flex items-center gap-1"
							>
								{getSessionLabel(currentSession)}
								<ChevronDown size={14} />
							</button>

							{#if dropdownOpen}
								<div class="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px] z-50">
									<button
										onclick={() => selectSession(0)}
										class="w-full px-4 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 transition-colors"
										class:bg-gray-100={currentSession === 0}
										class:font-semibold={currentSession === 0}
									>
										Pre-Start
									</button>
									{#each Array.from({ length: maxSessionNumber }, (_, i) => i + 1) as sessionNum}
										<button
											onclick={() => selectSession(sessionNum)}
											disabled={sessionNum > availableSessions}
											class="w-full px-4 py-2 text-left text-sm transition-colors"
											class:text-gray-800={sessionNum <= availableSessions}
											class:hover:bg-gray-100={sessionNum <= availableSessions}
											class:bg-gray-100={currentSession === sessionNum}
											class:font-semibold={currentSession === sessionNum}
											class:text-gray-400={sessionNum > availableSessions}
											class:cursor-not-allowed={sessionNum > availableSessions}
										>
											Session {sessionNum}
											{#if sessionNum > availableSessions}
												<span class="text-xs">(Locked)</span>
											{/if}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<span class="text-gray-400">|</span>

						{#if canGoNext}
							<button
								onclick={goToNext}
								class="flex items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors"
							>
								<span>Next</span>
								<ChevronRight size={16} />
							</button>
						{:else}
							<span class="flex items-center gap-1 text-gray-400">
								<span>Next</span>
								<ChevronRight size={16} />
							</span>
						{/if}
					</div>
				</div>

				<!-- Separator Line -->
				<div class="border-t border-gray-300 mx-6"></div>

				<!-- Main Content - 4 Quadrant Grid -->
				<div class="p-6 sm:p-8 lg:p-10">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
						<!-- Top Left: Session Header -->
						<div class="flex flex-col justify-start order-1 lg:order-none">
							<p class="text-xs font-medium text-gray-500 mb-1">{courseData.title}</p>
							<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" style="color: var(--course-accent-dark, #334642);">
								{currentSessionData.sessionTitle}
							</h1>
							<div class="flex items-center gap-2">
								<h2 class="text-base font-semibold" style="color: var(--course-accent-light, #c59a6b);">Session {currentSession}</h2>
								<div class="h-1 w-10 rounded" style="background-color: var(--course-accent-light, #c59a6b);"></div>
							</div>
						</div>

						<!-- Top Right: Materials (order-3 on mobile) -->
						{#if materialsEnabled}
						<div class="flex flex-col order-3 lg:order-none">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Materials</h3>
							<div class="space-y-2">
								{#if materials.length === 0}
									<div class="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-gray-100/50">
										<BookOpen size={28} class="text-gray-400 mb-2" />
										<p class="text-gray-500 text-sm text-center">No materials required for this session</p>
									</div>
								{/if}
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer no-underline"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: var(--course-accent-dark, #334642);" : "background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 12%, white);"}
									>
										<IconComponent size="16" class={index === 0 ? "text-white" : "text-gray-600"} />
										<span class="font-medium text-sm" class:text-white={index === 0} class:text-gray-700={index !== 0}>
											{material.title}
										</span>
										{#if material.isRestricted}
											<Lock size="13" class="ml-auto {index === 0 ? 'text-white/70' : 'text-gray-400'}" />
										{/if}
									</a>
								{/each}
							</div>
						</div>
						{/if}

						<!-- Bottom Left: Session Overview (order-2 on mobile) -->
						<div class="flex flex-col order-2 lg:order-none">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Session Overview</h3>
							<p class="text-sm text-gray-700 leading-relaxed">
								{currentSessionData.sessionOverview}
							</p>
						</div>

						<!-- Bottom Right: Reflection (order-4 on mobile) -->
							{#if reflectionsEnabled}
								<div class="flex flex-col justify-start order-4 lg:order-none" class:bg-white={currentSessionData.reflectionQuestion} class:rounded-xl={currentSessionData.reflectionQuestion} class:p-5={currentSessionData.reflectionQuestion} class:shadow-sm={currentSessionData.reflectionQuestion}>
								{#if currentSessionData.reflectionQuestion}
									{@const questionText = currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
									{@const { truncated, needsTruncation } = truncateQuestion(questionText)}
									<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reflection</h3>
									<p class="text-sm font-semibold text-gray-800 mb-3 leading-snug">
										{truncated}
										{#if needsTruncation}
											<a
												href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
												class="text-xs font-medium ml-1 no-underline hover:underline"
												style="color: var(--course-accent-dark, #c59a6b);"
											>
												more
											</a>
										{/if}
									</p>
									<div class="flex items-center justify-between mt-auto pt-2">
										<div class="flex items-center gap-2">
											<div
												class="w-2.5 h-2.5 rounded-full"
												class:bg-orange-400={currentSessionData.reflectionStatus === 'not_started'}
												class:bg-green-500={isComplete(currentSessionData.reflectionStatus)}
												class:bg-amber-500={currentSessionData.reflectionStatus === 'needs_revision'}
												class:bg-blue-400={!isComplete(currentSessionData.reflectionStatus) && currentSessionData.reflectionStatus !== 'not_started' && currentSessionData.reflectionStatus !== 'needs_revision'}
											></div>
											<span class="text-gray-600 text-xs font-medium">
												{currentSessionData.reflectionStatus === 'not_started' ? 'Not started' : getStatusLabel(currentSessionData.reflectionStatus)}
											</span>
										</div>
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="flex items-center gap-1.5 px-3 py-1.5 text-white font-semibold text-xs rounded-lg transition-colors hover:opacity-90 no-underline"
											style="background-color: var(--course-accent-dark, #334642);"
										>
											{#if isComplete(currentSessionData.reflectionStatus)}
												<Eye size="14" />
											{:else}
												<Edit3 size="14" />
											{/if}
											{getReflectionButtonLabel(currentSessionData.reflectionStatus)}
										</a>
									</div>
								{:else}
									<div class="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-gray-100/50">
										<PenTool size={28} class="text-gray-400 mb-2" />
										<p class="text-gray-500 text-sm text-center">No reflection for this session</p>
									</div>
								{/if}
								</div>
							{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Quiz Panel (shown below session content if a quiz exists for this session) -->
		{#if currentQuiz}
			<div class="mt-6 mb-2 px-4 sm:px-0">
				<div class="max-w-7xl mx-auto">
					<div class="rounded-xl border border-gray-200 bg-white p-5">
						<div class="flex items-start gap-3">
							<div class="p-2 rounded-lg flex-shrink-0" style="background-color: var(--course-accent-dark, #334642);">
								{#if currentQuiz.mode === 'instant'}
									<Zap size="18" class="text-white" />
								{:else}
									<PenTool size="18" class="text-white" />
								{/if}
							</div>
							<div class="flex-1 min-w-0">
								<p class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">Quiz</p>
								<p class="font-semibold text-gray-800 text-sm">
									{currentQuiz.title || (currentSession === 0 ? 'Pre-Start Quiz' : `Session ${currentSession} Quiz`)}
								</p>
								<p class="text-xs text-gray-500 mt-0.5">
									{currentQuiz.mode === 'instant' ? 'Multiple choice' : 'Short answer'}
									· {currentQuiz.question_count} question{currentQuiz.question_count !== 1 ? 's' : ''}
									{#if currentQuiz.mode === 'instant' && currentQuiz.pass_threshold}
										· Pass: {currentQuiz.pass_threshold}%
									{/if}
								</p>
							</div>
							<div class="flex items-center gap-3 flex-shrink-0">
								{#if currentQuiz.latestAttempt}
									<div class="flex items-center gap-1.5">
										<div class="w-2 h-2 rounded-full {getQuizStatusColor(currentQuiz.latestAttempt.status)}"></div>
										<span class="text-xs text-gray-600 font-medium">{getQuizStatusLabel(currentQuiz.latestAttempt.status)}</span>
										{#if currentQuiz.latestAttempt.score !== null && currentQuiz.mode === 'instant'}
											<span class="text-xs text-gray-400">({currentQuiz.latestAttempt.score}%)</span>
										{/if}
									</div>
								{:else}
									<div class="flex items-center gap-1.5">
										<div class="w-2 h-2 rounded-full bg-orange-400"></div>
										<span class="text-xs text-gray-600 font-medium">Not started</span>
									</div>
								{/if}
								<a
									href="/courses/{courseSlug}/quiz/{currentQuiz.id}"
									class="flex items-center gap-1.5 px-3 py-1.5 text-white font-semibold text-xs rounded-lg transition-colors hover:opacity-90 no-underline"
									style="background-color: var(--course-accent-dark, #334642);"
								>
									{getQuizButtonLabel(currentQuiz.latestAttempt?.status ?? null, currentQuiz)}
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
