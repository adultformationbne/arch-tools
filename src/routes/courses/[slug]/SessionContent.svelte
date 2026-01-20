<script>
	import { Play, FileText, Book, Edit3, ChevronLeft, ChevronRight, ChevronDown } from '$lib/icons';
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
		featureSettings = {}
	} = $props();

	// Check if reflections are enabled (default true for backwards compatibility)
	const reflectionsEnabled = $derived(featureSettings?.reflectionsEnabled !== false);

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
</script>

<div class="pb-6">
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

				<!-- Main Content - 2 Column Layout -->
				<div class="p-4 sm:p-6 lg:p-8 min-h-[400px]">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
						<!-- Left Column: Title + Session Overview -->
						<div class="flex flex-col">
							<p class="text-xs font-medium text-gray-500 mb-1">{courseData.title}</p>
							<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" style="color: var(--course-accent-dark, #334642);">
								{currentSessionData.sessionTitle}
							</h1>
							<div class="flex items-center gap-2 mb-6">
								<h2 class="text-base font-semibold" style="color: var(--course-accent-light, #c59a6b);">{currentSession === 0 ? 'Pre-Start' : `Session ${currentSession}`}</h2>
								<div class="h-1 w-10 rounded" style="background-color: var(--course-accent-light, #c59a6b);"></div>
							</div>

							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Session Overview</h3>
							<p class="text-sm text-gray-700 leading-relaxed">
								{currentSessionData.sessionOverview}
							</p>
						</div>

						<!-- Right Column: Materials + Reflection -->
						<div class="flex flex-col gap-6">
							<!-- Materials -->
							<div>
								<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">{currentSession === 0 ? 'Welcome Materials' : 'Materials'}</h3>
								<div class="flex flex-wrap gap-2">
									{#if materials.length === 0 && currentSession === 0}
										<p class="text-gray-500 text-sm italic">No materials available yet.</p>
									{/if}
									{#each materials as material, index}
										{@const IconComponent = getIcon(material.type)}
										<a
											href="/courses/{courseSlug}/materials?material={material.id}"
											class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors cursor-pointer no-underline text-sm font-medium"
											class:hover:opacity-90={true}
											style={index === 0 ? "background-color: var(--course-accent-dark, #c59a6b);" : "background-color: #f5f0e8;"}
										>
											<IconComponent size="14" class={index === 0 ? "text-white" : "text-gray-600"} />
											<span class:text-white={index === 0} class:text-gray-700={index !== 0}>
												{material.title}
											</span>
											{#if material.coordinatorOnly}
												<span class="text-xs px-1.5 py-0.5 rounded-full {index === 0 ? 'bg-white/30 text-white' : 'bg-gray-300 text-gray-600'}">
													HC
												</span>
											{/if}
										</a>
									{/each}
								</div>
							</div>

						<!-- Reflection (only if reflections enabled) -->
							{#if reflectionsEnabled}
								<div class="flex flex-col justify-start" class:bg-white={currentSessionData.reflectionQuestion} class:rounded-xl={currentSessionData.reflectionQuestion} class:p-5={currentSessionData.reflectionQuestion} class:shadow-sm={currentSessionData.reflectionQuestion}>
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
											<Edit3 size="14" />
											{currentSessionData.reflectionStatus === 'draft' ? 'Continue' : currentSessionData.reflectionStatus === 'not_started' ? 'Write' : 'Edit'}
										</a>
									</div>
								{:else}
									<p class="text-xs text-gray-400 italic p-5">No reflection question for this session</p>
								{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>
			</SessionNavigationTabs>
		{:else if currentSession === 0}
			<!-- Pre-Start: No tabs (for <6 or >12 sessions) -->
			<div class="rounded-xl" style="background-color: #eae2d9;">
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
				<div class="p-4 sm:p-6 lg:p-8">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<!-- Top Left: Session Header -->
						<div class="flex flex-col justify-start">
							<p class="text-xs font-medium text-gray-500 mb-1">{courseData.title}</p>
							<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" style="color: var(--course-accent-dark, #334642);">
								{currentSessionData.sessionTitle}
							</h1>
							<div class="flex items-center gap-2">
								<h2 class="text-base font-semibold" style="color: var(--course-accent-light, #c59a6b);">Pre-Start</h2>
								<div class="h-1 w-10 rounded" style="background-color: var(--course-accent-light, #c59a6b);"></div>
							</div>
						</div>

						<!-- Top Right: Session Overview -->
						<div class="flex flex-col">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Session Overview</h3>
							<p class="text-sm text-gray-700 leading-relaxed">
								{currentSessionData.sessionOverview}
							</p>
						</div>

						<!-- Bottom Left: Materials -->
						<div class="flex flex-col">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Welcome Materials</h3>
							<div class="space-y-2">
								{#if materials.length === 0}
									<p class="text-gray-500 text-sm italic">No materials available yet.</p>
								{/if}
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer no-underline"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: var(--course-accent-dark, #c59a6b);" : "background-color: #f5f0e8;"}
									>
										<IconComponent size="16" class={index === 0 ? "text-white" : "text-gray-600"} />
										<span class="font-medium text-sm" class:text-white={index === 0} class:text-gray-700={index !== 0}>
											{material.title}
										</span>
										{#if material.coordinatorOnly}
											<span class="ml-auto text-xs font-medium px-2 py-0.5 rounded {index === 0 ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'}">
												Coordinator
											</span>
										{/if}
									</a>
								{/each}
							</div>
						</div>

						<!-- Reflection (only if reflections enabled) -->
							{#if reflectionsEnabled}
								<div class="flex flex-col justify-start" class:bg-white={currentSessionData.reflectionQuestion} class:rounded-xl={currentSessionData.reflectionQuestion} class:p-5={currentSessionData.reflectionQuestion} class:shadow-sm={currentSessionData.reflectionQuestion}>
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
											<Edit3 size="14" />
											{currentSessionData.reflectionStatus === 'draft' ? 'Continue' : currentSessionData.reflectionStatus === 'not_started' ? 'Write' : 'Edit'}
										</a>
									</div>
								{:else}
									<p class="text-xs text-gray-400 italic p-5">No reflection question for this session</p>
								{/if}
								</div>
							{/if}
					</div>
				</div>
			</div>
		{:else}
			<!-- Regular sessions without tabs (for <6 or >12 sessions) -->
			<div class="rounded-xl" style="background-color: #eae2d9;">
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
				<div class="p-4 sm:p-6 lg:p-8">
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<!-- Top Left: Session Header -->
						<div class="flex flex-col justify-start">
							<p class="text-xs font-medium text-gray-500 mb-1">{courseData.title}</p>
							<h1 class="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2" style="color: var(--course-accent-dark, #334642);">
								{currentSessionData.sessionTitle}
							</h1>
							<div class="flex items-center gap-2">
								<h2 class="text-base font-semibold" style="color: var(--course-accent-light, #c59a6b);">Session {currentSession}</h2>
								<div class="h-1 w-10 rounded" style="background-color: var(--course-accent-light, #c59a6b);"></div>
							</div>
						</div>

						<!-- Top Right: Session Overview -->
						<div class="flex flex-col">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Session Overview</h3>
							<p class="text-sm text-gray-700 leading-relaxed">
								{currentSessionData.sessionOverview}
							</p>
						</div>

						<!-- Bottom Left: Materials -->
						<div class="flex flex-col">
							<h3 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Materials</h3>
							<div class="space-y-2">
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer no-underline"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: var(--course-accent-dark, #c59a6b);" : "background-color: #f5f0e8;"}
									>
										<IconComponent size="16" class={index === 0 ? "text-white" : "text-gray-600"} />
										<span class="font-medium text-sm" class:text-white={index === 0} class:text-gray-700={index !== 0}>
											{material.title}
										</span>
										{#if material.coordinatorOnly}
											<span class="ml-auto text-xs font-medium px-2 py-0.5 rounded {index === 0 ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'}">
												Coordinator
											</span>
										{/if}
									</a>
								{/each}
							</div>
						</div>

						<!-- Reflection (only if reflections enabled) -->
							{#if reflectionsEnabled}
								<div class="flex flex-col justify-start" class:bg-white={currentSessionData.reflectionQuestion} class:rounded-xl={currentSessionData.reflectionQuestion} class:p-5={currentSessionData.reflectionQuestion} class:shadow-sm={currentSessionData.reflectionQuestion}>
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
											<Edit3 size="14" />
											{currentSessionData.reflectionStatus === 'draft' ? 'Continue' : currentSessionData.reflectionStatus === 'not_started' ? 'Write' : 'Edit'}
										</a>
									</div>
								{:else}
									<p class="text-xs text-gray-400 italic p-5">No reflection question for this session</p>
								{/if}
								</div>
							{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
