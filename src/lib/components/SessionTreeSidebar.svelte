<script>
	import { ChevronDown, ChevronRight, Circle, Edit2, Check } from 'lucide-svelte';

	let {
		modules = [],
		sessions = [],
		selectedModuleId = '',
		selectedSession = 0,
		onModuleChange = () => {},
		onSessionChange = () => {},
		onSessionTitleChange = () => {}
	} = $props();

	let expandedModules = $state(new Set([selectedModuleId]));
	let editingSessionId = $state(null);
	let editingTitle = $state('');

	// Group sessions by module
	const sessionsByModule = $derived(
		modules.reduce((acc, module) => {
			acc[module.id] = sessions.filter(s => s.module_id === module.id);
			return acc;
		}, {})
	);

	const toggleModule = (moduleId) => {
		if (expandedModules.has(moduleId)) {
			expandedModules.delete(moduleId);
		} else {
			expandedModules.add(moduleId);
		}
		expandedModules = new Set(expandedModules); // Trigger reactivity
	};

	const handleModuleClick = (moduleId) => {
		toggleModule(moduleId);
		onModuleChange(moduleId);
	};

	const handleSessionClick = (moduleId, sessionNumber) => {
		if (editingSessionId) return; // Don't switch if editing
		onModuleChange(moduleId);
		onSessionChange(sessionNumber);
	};

	const startEditingTitle = (sessionId, currentTitle, e) => {
		e.stopPropagation();
		editingSessionId = sessionId;
		editingTitle = currentTitle;
	};

	const saveTitle = (sessionId) => {
		if (editingTitle.trim()) {
			onSessionTitleChange(sessionId, editingTitle.trim());
		}
		editingSessionId = null;
		editingTitle = '';
	};

	const cancelEdit = () => {
		editingSessionId = null;
		editingTitle = '';
	};

	const getSessionStatus = (session, sessionNumber) => {
		// Check if session has content
		const hasOverview = session?.description?.trim().length > 0;
		const hasMaterials = sessionsByModule[session.module_id]?.some(s => s.session_number === sessionNumber);

		if (hasOverview || hasMaterials) return 'in-progress';
		return 'empty';
	};

	const getSessionIcon = (status) => {
		if (status === 'completed') return Check;
		return Circle;
	};
</script>

<div class="h-full flex flex-col" style="background-color: var(--course-accent-dark);">
	<!-- Sidebar Header -->
	<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
		<h2 class="text-sm font-bold text-white/90 uppercase tracking-wide">Modules & Sessions</h2>
	</div>

	<!-- Tree Navigation -->
	<div class="flex-1 overflow-y-auto p-2">
		{#each modules as module}
			{@const isExpanded = expandedModules.has(module.id)}
			{@const isSelected = selectedModuleId === module.id}
			{@const moduleSessions = sessionsByModule[module.id] || []}

			<!-- Module -->
			<div class="mb-1">
				<button
					onclick={() => handleModuleClick(module.id)}
					class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors {isSelected ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}"
				>
					<div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
						{#if isExpanded}
							<ChevronDown size={16} />
						{:else}
							<ChevronRight size={16} />
						{/if}
					</div>
					<span class="font-semibold text-sm truncate flex-1">{module.name}</span>
					<span class="text-xs text-white/40">{moduleSessions.length}</span>
				</button>

				<!-- Sessions (shown when module is expanded) -->
				{#if isExpanded}
					{@const preStartSession = moduleSessions.find(s => s.session_number === 0)}
					{@const isPreStartSelected = isSelected && selectedSession === 0}

					<div class="ml-4 mt-1 space-y-0.5">
						<!-- Pre-Start (Session 0) -->
						<button
							onclick={() => handleSessionClick(module.id, 0)}
							class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors group {isPreStartSelected ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}"
							style={isPreStartSelected ? 'background-color: color-mix(in srgb, var(--course-accent-light) 20%, transparent)' : ''}
						>
							<Circle size={12} class="flex-shrink-0 {isPreStartSelected ? '' : 'text-white/30'}" style={isPreStartSelected ? 'fill: var(--course-accent-light); color: var(--course-accent-light)' : ''} />

							{#if editingSessionId === preStartSession?.id}
								<input
									type="text"
									bind:value={editingTitle}
									onblur={() => saveTitle(preStartSession.id)}
									onkeydown={(e) => {
										if (e.key === 'Enter') saveTitle(preStartSession.id);
										if (e.key === 'Escape') cancelEdit();
									}}
									onclick={(e) => e.stopPropagation()}
									class="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1"
									style="--tw-ring-color: var(--course-accent-light)"
									autofocus
								/>
							{:else}
								<span class="flex-1 text-xs truncate">
									{preStartSession?.title || 'Pre-Start'}
								</span>
								{#if isPreStartSelected}
									<button
										onclick={(e) => startEditingTitle(preStartSession?.id, preStartSession?.title || 'Pre-Start', e)}
										class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded"
									>
										<Edit2 size={12} />
									</button>
								{/if}
							{/if}
						</button>

						<!-- Regular Sessions (1-8+) -->
						{#each Array(8).fill(0) as _, i}
							{@const sessionNumber = i + 1}
							{@const session = moduleSessions.find(s => s.session_number === sessionNumber)}
							{@const isSessionSelected = isSelected && selectedSession === sessionNumber}

							<button
								onclick={() => handleSessionClick(module.id, sessionNumber)}
								class="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left transition-colors group {isSessionSelected ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}"
								style={isSessionSelected ? 'background-color: color-mix(in srgb, var(--course-accent-light) 20%, transparent)' : ''}
							>
								<div class="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-full {isSessionSelected ? 'font-bold' : 'bg-white/10 text-white/50'} text-xs"
									style={isSessionSelected ? 'background-color: color-mix(in srgb, var(--course-accent-light) 30%, transparent); color: var(--course-accent-light)' : ''}
								>
									{sessionNumber}
								</div>

								{#if editingSessionId === session?.id}
									<input
										type="text"
										bind:value={editingTitle}
										onblur={() => saveTitle(session.id)}
										onkeydown={(e) => {
											if (e.key === 'Enter') saveTitle(session.id);
											if (e.key === 'Escape') cancelEdit();
										}}
										onclick={(e) => e.stopPropagation()}
										class="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1"
										style="--tw-ring-color: var(--course-accent-light)"
										autofocus
									/>
								{:else}
									<span class="flex-1 text-xs truncate">
										{session?.title || `Session ${sessionNumber}`}
									</span>
									{#if isSessionSelected}
										<button
											onclick={(e) => startEditingTitle(session?.id, session?.title || `Session ${sessionNumber}`, e)}
											class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded"
										>
											<Edit2 size={12} />
										</button>
									{/if}
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Add Session Button (optional) -->
	<div class="p-3 border-t" style="border-color: rgba(255,255,255,0.1);">
		<button class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white text-xs font-medium transition-colors">
			+ Add Session
		</button>
	</div>
</div>

<style>
	/* Custom scrollbar for sidebar */
	.overflow-y-auto::-webkit-scrollbar {
		width: 6px;
	}

	.overflow-y-auto::-webkit-scrollbar-track {
		background: transparent;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	.overflow-y-auto::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
