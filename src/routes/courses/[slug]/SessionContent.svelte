<script>
	import { Play, FileText, Book, Edit3, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-svelte';
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
		maxSessionNumber
	} = $props();

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

<div class="pb-16">
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
				<div class="px-12 pt-4 pb-3">
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
				<div class="border-t border-gray-300 mx-12"></div>

				<!-- Main Content -->
				<div class="p-12">
					<!-- Course Header - Full Width -->
					<div class="mb-10">
						<p class="text-sm font-medium text-gray-600 mb-2">{courseData.title}</p>
						<h1 class="text-5xl font-bold text-gray-800 mb-4">
							{currentSessionData.sessionTitle}
						</h1>
						<div class="flex items-center gap-4">
							<h2 class="text-3xl font-semibold" style="color: #c59a6b;">{currentSession === 0 ? 'Pre-Start' : `Session ${currentSession}`}</h2>
							<div class="h-1 w-20 rounded" style="background-color: #c59a6b;"></div>
						</div>
					</div>

					<!-- Session Overview - Full Width -->
					<div class="mb-10">
						<p class="text-lg font-semibold text-gray-800 leading-relaxed">
							<span class="font-bold">Session overview:</span> {currentSessionData.sessionOverview}
						</p>
					</div>

					<!-- Two Column: Materials + Question -->
					<div class="grid grid-cols-2 gap-12">
						<!-- Left Column - Materials -->
						<div>
							<h3 class="text-2xl font-bold text-gray-800 mb-8">{currentSession === 0 ? 'Welcome materials' : "This session's materials"}</h3>
							<div class="space-y-4">
								{#if materials.length === 0 && currentSession === 0}
									<p class="text-gray-600 italic">No materials available yet. Check back closer to the start date.</p>
								{/if}
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="flex items-center justify-between p-5 rounded-2xl transition-colors cursor-pointer group no-underline"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: #c59a6b;" : "background-color: #f5f0e8;"}
									>
										<div class="flex items-center gap-4">
											<IconComponent size="24" class={index === 0 ? "text-white" : "text-gray-700"} />
											<span class="font-semibold text-lg" class:text-white={index === 0} class:text-gray-800={index !== 0}>
												{material.title}
											</span>
										</div>
									</a>
								{/each}
							</div>
						</div>

						<!-- Right Column - Reflection Question -->
						<div>
							{#if currentSessionData.reflectionQuestion}
								{@const questionText = currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
								{@const { truncated, needsTruncation } = truncateQuestion(questionText)}
								<div class="bg-white rounded-3xl p-8 shadow-sm">
									<div class="text-lg font-semibold mb-4" style="color: #c59a6b;">Question:</div>
									<h4 class="text-2xl font-bold text-gray-800 mb-6 leading-tight">
										{truncated}
									</h4>

									{#if needsTruncation}
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="text-sm font-medium mb-6 transition-colors block no-underline hover:underline"
											style="color: #c59a6b;"
										>
											Read more
										</a>
									{/if}

									<!-- Status and Button -->
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<span class="text-gray-700 font-semibold text-lg">
												{currentSessionData.reflectionStatus === 'not_started' ? 'Not started' : getStatusLabel(currentSessionData.reflectionStatus)}
											</span>
											<div
												class="w-3 h-3 rounded-full"
												class:bg-orange-400={currentSessionData.reflectionStatus === 'not_started'}
												class:bg-green-500={isComplete(currentSessionData.reflectionStatus)}
												class:bg-amber-500={currentSessionData.reflectionStatus === 'needs_revision'}
												class:bg-blue-400={!isComplete(currentSessionData.reflectionStatus) && currentSessionData.reflectionStatus !== 'not_started' && currentSessionData.reflectionStatus !== 'needs_revision'}
											></div>
										</div>
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="flex items-center gap-3 px-8 py-4 text-white font-semibold text-lg rounded-3xl transition-colors hover:opacity-90 no-underline"
											style="background-color: #334642;"
										>
											<Edit3 size="20" />
											Write Reflection
										</a>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</SessionNavigationTabs>
		{:else if currentSession === 0}
			<!-- Pre-Start: No tabs (for <6 or >12 sessions) -->
			<div class="rounded-3xl" style="background-color: #eae2d9;">
				<!-- Thin Top Navigation Bar -->
				<div class="px-12 pt-4 pb-3">
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
				<div class="border-t border-gray-300 mx-12"></div>

				<!-- Main Content -->
				<div class="p-12">
					<!-- Course Header - Full Width -->
					<div class="mb-10">
						<p class="text-sm font-medium text-gray-600 mb-2">{courseData.title}</p>
						<h1 class="text-5xl font-bold text-gray-800 mb-4">
							{currentSessionData.sessionTitle}
						</h1>
						<div class="flex items-center gap-4">
							<h2 class="text-3xl font-semibold" style="color: #c59a6b;">Pre-Start</h2>
							<div class="h-1 w-20 rounded" style="background-color: #c59a6b;"></div>
						</div>
					</div>

					<!-- Session Overview - Full Width -->
					<div class="mb-10">
						<p class="text-lg font-semibold text-gray-800 leading-relaxed">
							<span class="font-bold">Session overview:</span> {currentSessionData.sessionOverview}
						</p>
					</div>

					<!-- Two Column: Materials + Question -->
					<div class="grid grid-cols-2 gap-12">
						<!-- Left Column - Materials -->
						<div>
							<h3 class="text-2xl font-bold text-gray-800 mb-8">Welcome materials</h3>
							<div class="space-y-4">
								{#if materials.length === 0}
									<p class="text-gray-600 italic">No materials available yet. Check back closer to the start date.</p>
								{/if}
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="flex items-center justify-between p-5 rounded-2xl transition-colors cursor-pointer group no-underline"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: #c59a6b;" : "background-color: #f5f0e8;"}
									>
										<div class="flex items-center gap-4">
											<IconComponent size="24" class={index === 0 ? "text-white" : "text-gray-700"} />
											<span class="font-semibold text-lg" class:text-white={index === 0} class:text-gray-800={index !== 0}>
												{material.title}
											</span>
										</div>
									</a>
								{/each}
							</div>
						</div>

						<!-- Right Column - Reflection Question -->
						<div>
							{#if currentSessionData.reflectionQuestion}
								{@const questionText = currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
								{@const { truncated, needsTruncation } = truncateQuestion(questionText)}
								<div class="bg-white rounded-3xl p-8 shadow-sm">
									<div class="text-lg font-semibold mb-4" style="color: #c59a6b;">Question:</div>
									<h4 class="text-2xl font-bold text-gray-800 mb-6 leading-tight">
										{truncated}
									</h4>

									{#if needsTruncation}
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="text-sm font-medium mb-6 transition-colors block no-underline hover:underline"
											style="color: #c59a6b;"
										>
											Read more
										</a>
									{/if}

									<!-- Status and Button -->
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<span class="text-gray-700 font-semibold text-lg">
												{currentSessionData.reflectionStatus === 'not_started' ? 'Not started' : getStatusLabel(currentSessionData.reflectionStatus)}
											</span>
											<div
												class="w-3 h-3 rounded-full"
												class:bg-orange-400={currentSessionData.reflectionStatus === 'not_started'}
												class:bg-green-500={isComplete(currentSessionData.reflectionStatus)}
												class:bg-amber-500={currentSessionData.reflectionStatus === 'needs_revision'}
												class:bg-blue-400={!isComplete(currentSessionData.reflectionStatus) && currentSessionData.reflectionStatus !== 'not_started' && currentSessionData.reflectionStatus !== 'needs_revision'}
											></div>
										</div>
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="flex items-center gap-3 px-8 py-4 text-white font-semibold text-lg rounded-3xl transition-colors hover:opacity-90 no-underline"
											style="background-color: #334642;"
										>
											<Edit3 size="20" />
											Write Reflection
										</a>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<!-- Regular sessions without tabs (for <6 or >12 sessions) -->
			<div class="rounded-3xl" style="background-color: #eae2d9;">
				<!-- Thin Top Navigation Bar -->
				<div class="px-12 pt-4 pb-3">
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
				<div class="border-t border-gray-300 mx-12"></div>

				<!-- Main Content -->
				<div class="p-12">
					<!-- Course Header - Full Width -->
					<div class="mb-10">
						<p class="text-sm font-medium text-gray-600 mb-2">{courseData.title}</p>
						<h1 class="text-5xl font-bold text-gray-800 mb-4">
							{currentSessionData.sessionTitle}
						</h1>
						<div class="flex items-center gap-4">
							<h2 class="text-3xl font-semibold" style="color: #c59a6b;">Session {currentSession}</h2>
							<div class="h-1 w-20 rounded" style="background-color: #c59a6b;"></div>
						</div>
					</div>

					<!-- Session Overview - Full Width -->
					<div class="mb-10">
						<p class="text-lg font-semibold text-gray-800 leading-relaxed">
							<span class="font-bold">Session overview:</span> {currentSessionData.sessionOverview}
						</p>
					</div>

					<!-- Two Column: Materials + Question -->
					<div class="grid grid-cols-2 gap-12">
						<!-- Left Column - Materials -->
						<div>
							<h3 class="text-2xl font-bold text-gray-800 mb-8">This session's materials</h3>
							<div class="space-y-4">
								{#each materials as material, index}
									{@const IconComponent = getIcon(material.type)}
									<a
										href="/courses/{courseSlug}/materials?material={material.id}"
										class="flex items-center justify-between p-5 rounded-2xl transition-colors cursor-pointer group no-underline"
										class:hover:opacity-90={true}
										style={index === 0 ? "background-color: #c59a6b;" : "background-color: #f5f0e8;"}
									>
										<div class="flex items-center gap-4">
											<IconComponent size="24" class={index === 0 ? "text-white" : "text-gray-700"} />
											<span class="font-semibold text-lg" class:text-white={index === 0} class:text-gray-800={index !== 0}>
												{material.title}
											</span>
										</div>
									</a>
								{/each}
							</div>
						</div>

						<!-- Right Column - Reflection Question -->
						<div>
							{#if currentSessionData.reflectionQuestion}
								{@const questionText = currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
								{@const { truncated, needsTruncation } = truncateQuestion(questionText)}
								<div class="bg-white rounded-3xl p-8 shadow-sm">
									<div class="text-lg font-semibold mb-4" style="color: #c59a6b;">Question:</div>
									<h4 class="text-2xl font-bold text-gray-800 mb-6 leading-tight">
										{truncated}
									</h4>

									{#if needsTruncation}
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="text-sm font-medium mb-6 transition-colors block no-underline hover:underline"
											style="color: #c59a6b;"
										>
											Read more
										</a>
									{/if}

									<!-- Status and Button -->
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-3">
											<span class="text-gray-700 font-semibold text-lg">
												{currentSessionData.reflectionStatus === 'not_started' ? 'Not started' : getStatusLabel(currentSessionData.reflectionStatus)}
											</span>
											<div
												class="w-3 h-3 rounded-full"
												class:bg-orange-400={currentSessionData.reflectionStatus === 'not_started'}
												class:bg-green-500={isComplete(currentSessionData.reflectionStatus)}
												class:bg-amber-500={currentSessionData.reflectionStatus === 'needs_revision'}
												class:bg-blue-400={!isComplete(currentSessionData.reflectionStatus) && currentSessionData.reflectionStatus !== 'not_started' && currentSessionData.reflectionStatus !== 'needs_revision'}
											></div>
										</div>
										<a
											href="/courses/{courseSlug}/write/{currentSessionData.reflectionQuestion?.id}"
											class="flex items-center gap-3 px-8 py-4 text-white font-semibold text-lg rounded-3xl transition-colors hover:opacity-90 no-underline"
											style="background-color: #334642;"
										>
											<Edit3 size="20" />
											Write Reflection
										</a>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
