<script>
	import { onMount } from 'svelte';
	import { ChevronDown, ChevronRight, Circle, Edit2, Check, Trash2, GripVertical, FileText } from 'lucide-svelte';
	import { getDndzone, noopDndzone } from '$lib/utils/resilient-dnd.js';
	import { flip } from 'svelte/animate';

	// Dynamic DnD loading - falls back to static list if unavailable
	let dndzone = $state(noopDndzone);
	let dndAvailable = $state(false);

	onMount(async () => {
		const loadedDnd = await getDndzone();
		if (loadedDnd) {
			dndzone = loadedDnd;
			dndAvailable = true;
		}
	});

	let {
		modules = [],
		sessions = [],
		selectedModuleId = '',
		selectedSession = 0,
		onModuleChange = () => {},
		onSessionChange = () => {},
		onSessionTitleChange = () => {},
		onAddSession = () => {},
		onSessionDelete = () => {},
		onSessionReorder = () => {}
	} = $props();

	let expandedModules = $state(new Set([selectedModuleId]));
	let editingSessionId = $state(null);
	let editingTitle = $state('');
	let savingTitle = $state(false);  // Track if we're saving
	let draggedItemId = $state(null);  // Track which item is being dragged

	// Drag-and-drop configuration
	const DND_FLIP_DURATION = 200;

	// Local state for draggable items per module - needed for svelte-dnd-action
	let draggableItemsByModule = $state({});

	// Sync draggable items when sessions prop changes
	$effect(() => {
		const newItems = {};
		for (const module of modules) {
			newItems[module.id] = sessions
				.filter(s => s.module_id === module.id)
				.sort((a, b) => a.session_number - b.session_number)
				.map(s => ({ ...s })); // Create copies for local mutation
		}
		draggableItemsByModule = newItems;
	});

	// Group sessions by module (for non-drag purposes)
	const sessionsByModule = $derived(
		modules.reduce((acc, module) => {
			acc[module.id] = sessions
				.filter(s => s.module_id === module.id)
				.map(s => ({ ...s, id: s.id }));
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
			savingTitle = true;
			onSessionTitleChange(sessionId, editingTitle.trim());
		} else {
			editingSessionId = null;
			editingTitle = '';
		}
	};

	// Watch for when the session title updates in props, then exit edit mode
	$effect(() => {
		if (savingTitle && editingSessionId) {
			// Find the session being edited
			const currentModule = modules.find(m => m.id === selectedModuleId);
			if (currentModule) {
				const moduleSessions = sessionsByModule[currentModule.id] || [];
				const editedSession = moduleSessions.find(s => s.id === editingSessionId);

				// If the session's title now matches what we typed, exit edit mode
				if (editedSession && editedSession.title === editingTitle.trim()) {
					savingTitle = false;
					editingSessionId = null;
					editingTitle = '';
				}
			}
		}
	});

	const cancelEdit = () => {
		editingSessionId = null;
		editingTitle = '';
	};

	// Drag-and-drop handlers
	const handleDndConsider = (moduleId, e) => {
		// Track which item is being dragged
		const { trigger, id } = e.detail.info;
		if (trigger === 'draggedEntered' || trigger === 'draggedOver') {
			draggedItemId = id;
		}
		// Update local state during drag for visual feedback
		draggableItemsByModule[moduleId] = e.detail.items;
	};

	const handleDndFinalize = (moduleId, e) => {
		// Clear dragged item tracking
		draggedItemId = null;
		// Update local state with final order
		draggableItemsByModule[moduleId] = e.detail.items;
		// Call parent handler with new order (filter out any without valid IDs)
		const sessionIds = e.detail.items.map(s => s.id).filter(id => id != null);
		if (sessionIds.length > 0) {
			onSessionReorder(moduleId, sessionIds);
		}
	};

	// Get the new position of the dragged item
	const getDraggedItemNewPosition = (moduleId) => {
		const items = draggableItemsByModule[moduleId] || [];
		return items.findIndex(item => item.id === draggedItemId);
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
					{@const draggableItems = draggableItemsByModule[module.id] || []}

					<div class="ml-4 mt-1 space-y-0.5">
						<!-- Draggable Sessions List -->
						<div
							use:dndzone={{
								items: draggableItems,
								flipDurationMs: DND_FLIP_DURATION,
								dropTargetStyle: { outline: 'none', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem' },
								transformDraggedElement: (element, data, index) => {
									// Update the number badge in the dragged element to show new position
									const badge = element?.querySelector('.session-number-badge');
									if (badge && index !== undefined) {
										badge.textContent = String(index);
									}
								}
							}}
							onconsider={(e) => handleDndConsider(module.id, e)}
							onfinalize={(e) => handleDndFinalize(module.id, e)}
							class="space-y-0.5 min-h-[2rem]"
						>
							{#each draggableItems as session, index (session.id)}
								{@const displayNumber = index}
								{@const isSessionSelected = isSelected && selectedSession === session.session_number}
								{@const isPreStart = index === 0}

								<div
									animate:flip={{ duration: DND_FLIP_DURATION }}
									class="session-item"
								>
									<button
										onclick={() => handleSessionClick(module.id, session.session_number)}
										class="w-full flex items-center gap-1 px-2 py-1.5 rounded-lg text-left transition-colors group {isSessionSelected ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}"
										style={isSessionSelected ? 'background-color: color-mix(in srgb, var(--course-accent-light) 20%, transparent)' : ''}
									>
										<!-- Drag Handle (only shown when DnD is available) -->
										{#if dndAvailable}
										<div
											class="drag-handle flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
											title="Drag to reorder"
										>
											<GripVertical size={12} />
										</div>
										{/if}

										<!-- Session Number - shows POSITION in list (reactive during drag) -->
										{#if isPreStart}
											<div class="session-number-badge w-5 h-5 flex items-center justify-center flex-shrink-0">
												<Circle size={12} class="{isSessionSelected ? '' : 'text-white/30'}" style={isSessionSelected ? 'fill: var(--course-accent-light); color: var(--course-accent-light)' : ''} />
											</div>
										{:else}
											<div class="session-number-badge w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-full text-xs transition-all duration-150 {isSessionSelected ? 'font-bold' : 'bg-white/10 text-white/50'}"
												style={isSessionSelected ? 'background-color: color-mix(in srgb, var(--course-accent-light) 30%, transparent); color: var(--course-accent-light)' : ''}
											>
												{displayNumber}
											</div>
										{/if}

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
												disabled={savingTitle}
												class="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 disabled:opacity-70 disabled:cursor-wait"
												style="--tw-ring-color: var(--course-accent-light)"
												autofocus
											/>
										{:else}
											<span class="flex-1 text-xs truncate">
												{session?.title || (isPreStart ? 'Pre-Start' : `Session ${session.session_number}`)}
											</span>
											<!-- Materials count badge -->
											{#if session.materials_count > 0}
												<span class="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full {isSessionSelected ? 'bg-white/20 text-white/90' : 'bg-white/10 text-white/50'}" title="{session.materials_count} material{session.materials_count === 1 ? '' : 's'}">
													<FileText size={10} />
													{session.materials_count}
												</span>
											{/if}
											{#if isSessionSelected}
												<div class="flex items-center gap-1">
													<div
														role="button"
														tabindex="0"
														onclick={(e) => startEditingTitle(session?.id, session?.title || (isPreStart ? 'Pre-Start' : `Session ${session.session_number}`), e)}
														onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') startEditingTitle(session?.id, session?.title || (isPreStart ? 'Pre-Start' : `Session ${session.session_number}`), e); }}
														class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded cursor-pointer"
														title="Edit session title"
													>
														<Edit2 size={12} />
													</div>
													<div
														role="button"
														tabindex="0"
														onclick={(e) => { e.stopPropagation(); onSessionDelete(session?.id, session.session_number); }}
														onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onSessionDelete(session?.id, session.session_number); } }}
														class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded text-red-300 hover:text-red-200 cursor-pointer"
														title="Delete session"
													>
														<Trash2 size={12} />
													</div>
												</div>
											{/if}
										{/if}
									</button>
								</div>
							{/each}
						</div>

						<!-- Add Session Button (inline after last session) -->
						<button
							onclick={onAddSession}
							class="w-full mt-1 px-3 py-1.5 rounded-lg text-left transition-colors text-white/50 hover:bg-white/5 hover:text-white/70 text-xs flex items-center gap-2"
						>
							<div class="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded-full bg-white/5 text-white/40">
								+
							</div>
							<span>Add Session</span>
						</button>
					</div>
				{/if}
			</div>
		{/each}
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

	/* Drag-and-drop styles */
	.session-item {
		touch-action: none;
	}

	:global(.session-item[aria-grabbed="true"]) {
		opacity: 0.8;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
	}

	:global(.session-item.svelte-dnd-zone-dragged) {
		opacity: 0.5;
	}
</style>
