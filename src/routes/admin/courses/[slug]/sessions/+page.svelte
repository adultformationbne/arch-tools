<script>
	import { page, navigating } from '$app/stores';
	import { goto, invalidate } from '$app/navigation';
	import { untrack } from 'svelte';
	import { Pencil } from 'lucide-svelte';
	import MaterialEditor from '$lib/components/MaterialEditor.svelte';
	import ReflectionEditor from '$lib/components/ReflectionEditor.svelte';
	import SessionOverviewEditor from '$lib/components/SessionOverviewEditor.svelte';
	import SessionTreeSidebar from '$lib/components/SessionTreeSidebar.svelte';
	import StudentPreview from '$lib/components/StudentPreview.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

	let { data } = $props();

	// Show loading state during navigation
	let isLoading = $derived($navigating !== null);

	// Available modules from server - props auto-update, use $derived
	const availableModules = $derived(data.modules || []);

	// Course theme colors
	const courseTheme = data.courseTheme || {};
	const accentDark = courseTheme.accentDark || '#334642';
	const accentLight = courseTheme.accentLight || '#c59a6b';

	// Get module from URL (derived from URL params)
	const selectedModuleId = $derived($page.url.searchParams.get('module'));
	const selectedModule = $derived(
		availableModules.find(m => m.id === selectedModuleId) || availableModules[0]
	);

	let selectedSession = $state(0); // Currently selected session number

	// Simplified state: Only store sessions that actually exist (no pre-filling)
	let sessionData = $state({}); // { [sessionNumber]: { id, title, description, materials, reflection, reflectionEnabled } }

	// Get list of actual session numbers that exist (for sidebar display)
	const sessionNumbers = $derived(
		Object.keys(sessionData)
			.map(Number)
			.sort((a, b) => a - b)
	);

	let dataInitialized = $state(false);
	let saving = $state(false);
	let saveMessage = $state('');
	let editingTitle = $state(false);
	let titleHovered = $state(false);
	let showDeleteConfirm = $state(false);
	let sessionToDelete = $state(null);

	// Track the current title for debouncing
	let pendingTitle = $state('');

	// Process server-loaded data into simplified component state
	// ONLY initialize sessions that actually exist in the database (no pre-filling)
	const processServerData = (moduleId) => {
		const moduleSessions = data.sessions.filter(s => s.module_id === moduleId);
		const newSessionData = {};

		// Only add sessions that exist in the database
		for (const session of moduleSessions) {
			const sessionNum = session.session_number;

			// Get materials for this session
			const materials = data.materials
				.filter(m => m.session_id === session.id)
				.map(m => ({
					id: m.id,
					type: m.type,
					title: m.title,
					url: (m.type === 'native' || m.type === 'embed') ? '' : m.content,
					content: (m.type === 'native' || m.type === 'embed') ? m.content : '',
					description: m.description || '',
					order: m.display_order,
					coordinatorOnly: m.coordinator_only || false,
					// Mux video fields
					mux_upload_id: m.mux_upload_id,
					mux_asset_id: m.mux_asset_id,
					mux_playback_id: m.mux_playback_id,
					mux_status: m.mux_status
				}));

			// Get reflection question for this session
			const question = data.reflectionQuestions.find(q => q.session_id === session.id);
			const reflection = question ? question.question_text : '';
			const hasQuestion = reflection?.trim().length > 0;

			newSessionData[sessionNum] = {
				id: session.id,
				title: session.title || `Session ${sessionNum}`,
				description: session.description || '',
				materials,
				reflection,
				reflectionEnabled: hasQuestion ? (session.reflections_enabled ?? true) : false
			};
		}

		sessionData = newSessionData;
		dataInitialized = true;

		// Auto-select first session if current selection doesn't exist
		// Don't read sessionNumbers here (it's $derived from sessionData) to avoid infinite loop
		if (!sessionData[selectedSession]) {
			const numbers = Object.keys(sessionData).map(Number).sort((a, b) => a - b);
			if (numbers.length > 0) {
				selectedSession = numbers[0];
			}
		}
	};

	// Initialize data from server when module changes
	$effect(() => {
		const moduleId = selectedModule?.id;
		if (moduleId) {
			// Use untrack to prevent processServerData from tracking data.sessions/materials as dependencies
			untrack(() => processServerData(moduleId));
		}
	});

	// Debounce title saves - proper cleanup pattern
	$effect(() => {
		if (!pendingTitle) return;

		const timeout = setTimeout(() => {
			saveTitleToDatabase(pendingTitle);
			pendingTitle = ''; // Clear after saving
		}, 1000);

		// Cleanup runs before next effect or on unmount
		return () => clearTimeout(timeout);
	});

	// Handler functions for component events
	const handleMaterialsChange = async (newMaterials) => {
		// Optimistic update - $state has deep reactivity, direct mutation works!
		sessionData[selectedSession].materials = newMaterials;
	};

	const handleSaveStatusChange = (isSaving, message) => {
		saving = isSaving;
		saveMessage = message;
	};

	const handleReflectionChange = async (newReflection) => {
		// Optimistic update - mutate directly on sessionData for immediate reactivity
		sessionData[selectedSession].reflection = newReflection;
		sessionData[selectedSession].reflectionEnabled = newReflection.trim().length > 0;

		saving = true;
		saveMessage = 'Saving...';

		try {
			// Ensure session exists
			if (!sessionData[selectedSession].id) {
				const getSessionResponse = await fetch(
					`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${selectedSession}`
				);
				if (!getSessionResponse.ok) throw new Error('Failed to get or create session');
				const { session } = await getSessionResponse.json();
				sessionData[selectedSession].id = session.id;
			}

			// Fetch existing question to determine if we need POST/PUT/DELETE
			const existingQuestionsRes = await fetch(
				`/api/courses/module-reflection-questions?module_id=${selectedModule.id}&session_number=${selectedSession}`
			);
			const { questions } = await existingQuestionsRes.json();
			const existingQuestion = questions?.[0] || null;

			// Single API call to save/update/delete reflection
			if (newReflection.trim().length === 0 && existingQuestion) {
				// Delete empty reflection
				await fetch('/api/courses/module-reflection-questions', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: existingQuestion.id })
				});
			} else if (newReflection.trim().length > 0) {
				const method = existingQuestion ? 'PUT' : 'POST';
				const body = existingQuestion
					? { id: existingQuestion.id, question_text: newReflection }
					: { session_id: sessionData[selectedSession].id, question_text: newReflection };

				const response = await fetch('/api/courses/module-reflection-questions', {
					method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || 'Failed to save reflection');
				}
			}

			// Update reflections_enabled flag (no toast, just silent save)
			await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionData[selectedSession].id,
					reflections_enabled: sessionData[selectedSession].reflectionEnabled
				})
			});

			saveMessage = 'Saved';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 800);
		} catch (error) {
			console.error('Error saving reflection:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError(`Failed to save: ${error.message}`);
		}
	};

	const handleOverviewChange = async (newOverview) => {
		// Optimistic update - mutate directly for immediate reactivity
		sessionData[selectedSession].description = newOverview;

		saving = true;
		saveMessage = 'Saving...';

		try {
			// Ensure session exists
			if (!sessionData[selectedSession].id) {
				const getSessionResponse = await fetch(
					`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${selectedSession}`
				);
				if (!getSessionResponse.ok) throw new Error('Failed to get or create session');
				const { session } = await getSessionResponse.json();
				sessionData[selectedSession].id = session.id;
			}

			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionData[selectedSession].id,
					description: newOverview
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Save failed');
			}

			saveMessage = 'Saved';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 800);
		} catch (error) {
			console.error('Error saving session overview:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError(`Failed to save: ${error.message}`);
		}
	};

	const handleTitleInput = (newTitle) => {
		// Optimistic update - direct mutation (deep reactivity in $state)
		sessionData[selectedSession].title = newTitle;

		// Set pending title - the $effect will handle debounced save
		pendingTitle = newTitle;
	};

	const saveTitleToDatabase = async (newTitle) => {
		saving = true;
		saveMessage = 'Saving...';

		try {
			// Ensure session exists
			if (!sessionData[selectedSession].id) {
				const getSessionResponse = await fetch(
					`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${selectedSession}`
				);
				if (!getSessionResponse.ok) throw new Error('Failed to get or create session');
				const { session } = await getSessionResponse.json();
				sessionData[selectedSession].id = session.id;
			}

			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionData[selectedSession].id,
					title: newTitle
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Save failed');
			}

			saveMessage = 'Saved';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 800);
		} catch (error) {
			console.error('Error saving session title:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError(`Failed to save: ${error.message}`);
		}
	};

	const handleSessionChange = (session) => {
		// Instant switch - data is already pre-loaded
		selectedSession = session;
	};

	const handleModuleChange = (moduleId) => {
		selectedSession = 0; // Reset to Pre-Start

		// Update URL - the $effect will handle processing data
		const url = new URL($page.url);
		url.searchParams.set('module', moduleId);
		goto(url.toString(), { replaceState: true, keepFocus: true });
	};

	const handleSessionTitleChangeFromSidebar = async (sessionId, newTitle) => {
		// Find the session by ID (for existing sessions) or by having id: null (for new sessions)
		let sessionNum;

		if (sessionId) {
			// Existing session - find by ID
			const session = data.sessions.find(s => s.id === sessionId);
			if (!session) return;
			sessionNum = session.session_number;
		} else {
			// New session (id: null) - find the session number from sessionData
			// The sidebar is editing a session that exists in sessionData but not yet in database
			const entry = Object.entries(sessionData).find(([num, data]) => data.id === null);
			if (!entry) return;
			sessionNum = Number(entry[0]);
		}

		// Optimistic update - direct mutation (deep reactivity in $state)
		if (sessionData[sessionNum]) {
			sessionData[sessionNum].title = newTitle;
		}

		saving = true;
		saveMessage = 'Saving...';

		try {
			// For new sessions without ID, we need to create the session first
			if (!sessionId) {
				// Step 1: Create the session using GET (which uses upsert)
				const createResponse = await fetch(`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${sessionNum}`);

				if (!createResponse.ok) {
					throw new Error('Failed to create session');
				}

				const { session: createdSession } = await createResponse.json();

				// Step 2: Update the title with PUT (since GET creates with default title)
				const updateResponse = await fetch('/api/courses/sessions', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						session_id: createdSession.id,
						title: newTitle
					})
				});

				if (!updateResponse.ok) {
					throw new Error('Failed to update session title');
				}

				// Update the local state with the new session ID
				sessionData[sessionNum].id = createdSession.id;

				saving = false;
				saveMessage = 'Saved';
				setTimeout(() => saveMessage = '', 2000);
				return;
			}

			// For existing sessions, update the title
			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ session_id: sessionId, title: newTitle })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Save failed');
			}

			saveMessage = 'Saved';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 800);
		} catch (error) {
			console.error('Error saving session title:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError(`Failed to save: ${error.message}`);
		}
	};

	const addSession = () => {
		// Find the highest session number and add 1
		const existingNumbers = Object.keys(sessionData).map(Number);
		const maxSessionNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
		const newSessionNum = maxSessionNum + 1;

		// Create new session in local state with EMPTY title (let admin name it)
		sessionData[newSessionNum] = {
			id: null,
			title: '',  // Start empty - admin can name it however they want
			description: '',
			materials: [],
			reflection: '',
			reflectionEnabled: false
		};

		// Auto-select the new session
		selectedSession = newSessionNum;
	};

	const handleSessionReorder = async (moduleId, sessionIds) => {
		// Prevent concurrent reorder requests (race condition fix)
		if (saving) return;

		// Filter out any null IDs (unsaved sessions can't be reordered)
		const validSessionIds = sessionIds.filter(id => id != null);
		if (validSessionIds.length === 0) return;

		saving = true;
		saveMessage = 'Reordering...';

		try {
			const response = await fetch('/api/courses/sessions/reorder', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					module_id: moduleId,
					session_order: validSessionIds
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Reorder failed');
			}

			// Refresh data from server to get updated session numbers
			await invalidate('app:sessions-data');

			// Re-process server data to rebuild sessionData with correct session_numbers
			// This is necessary because sessionData keys are session_numbers, which change after reorder
			processServerData(moduleId);

			saveMessage = 'Saved';
			toastSuccess('Sessions reordered');
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 800);
		} catch (error) {
			console.error('Error reordering sessions:', error);
			saveMessage = 'Reorder failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError(`Failed to reorder: ${error.message}`);

			// Refresh to restore original order
			await invalidate('app:sessions-data');
		}
	};

	const removeSession = () => {
		// This is handled by handleSessionDelete with confirmation modal
		// This function is kept for compatibility but not actively used
	};

	const handleSessionDelete = (sessionId, sessionNumber) => {
		if (!sessionId) {
			toastError('Cannot delete session - session not created yet');
			return;
		}
		sessionToDelete = { id: sessionId, number: sessionNumber };
		showDeleteConfirm = true;
	};

	const confirmDeleteSession = async () => {
		if (!sessionToDelete) return;

		const sessionNum = sessionToDelete.number;
		const sessionId = sessionToDelete.id;

		// Store backup in case we need to restore
		const backup = { ...sessionData[sessionNum] };

		// OPTIMISTIC: Remove from UI immediately using object destructuring (triggers reactivity properly)
		const { [sessionNum]: removed, ...rest } = sessionData;
		sessionData = rest;
		showDeleteConfirm = false;
		sessionToDelete = null;

		// If this was the selected session, switch to the nearest one
		if (selectedSession === sessionNum) {
			const numbers = Object.keys(sessionData).map(Number).sort((a, b) => a - b);
			if (numbers.length === 0) {
				// No sessions left, go to Pre-Start (0)
				selectedSession = 0;
			} else {
				// Find the nearest session (prefer next, fallback to previous)
				const nextSession = numbers.find(n => n > sessionNum);
				const prevSession = numbers.reverse().find(n => n < sessionNum);
				selectedSession = nextSession || prevSession || numbers[0];
			}
		}

		// Now make the API call in background
		try {
			const response = await fetch('/api/courses/sessions', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ session_id: sessionId })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Delete failed');
			}

			// Success! Invalidate to refresh from server
			await invalidate('app:sessions-data');
			toastSuccess('Session deleted successfully');
		} catch (error) {
			console.error('Error deleting session:', error);

			// RESTORE: Put the session back in local state (reactivity works with direct assignment)
			sessionData = { ...sessionData, [sessionNum]: backup };
			selectedSession = sessionNum;

			toastError(`Failed to delete: ${error.message}`);
		}
	};


	// Derived state for current session (used by child components)
	const currentSession = $derived(sessionData[selectedSession] || {
		materials: [],
		reflection: '',
		reflectionEnabled: false,
		description: '',
		title: selectedSession === 0 ? 'Pre-Start' : ''  // Empty title for new sessions
	});

	// Merge server sessions with local sessionData for sidebar reactivity
	// This includes both existing sessions AND newly added sessions
	// Trust Svelte 5 reactivity - direct mutations work!
	const sessionsWithUpdatedTitles = $derived((() => {
		const sessionMap = new Map();

		// Start with server sessions
		data.sessions.forEach(session => {
			sessionMap.set(session.session_number, session);
		});

		// Merge with local sessionData (includes new sessions, updated titles, and handles deletions)
		Object.entries(sessionData).forEach(([sessionNum, localData]) => {
			const numKey = Number(sessionNum);
			if (sessionMap.has(numKey)) {
				// Update existing session with local data (optimistic updates)
				sessionMap.set(numKey, {
					...sessionMap.get(numKey),
					title: localData.title,
					description: localData.description
				});
			} else {
				// Add new session from local state (not yet saved to server)
				sessionMap.set(numKey, {
					id: localData.id,
					module_id: selectedModule?.id,
					session_number: numKey,
					title: localData.title,
					description: localData.description,
					learning_objectives: [],
					reflections_enabled: localData.reflectionEnabled
				});
			}
		});

		// Remove sessions that are in server data but not in local sessionData
		// (this handles optimistic deletions before server refresh)
		data.sessions.forEach(session => {
			if (!sessionData.hasOwnProperty(session.session_number)) {
				sessionMap.delete(session.session_number);
			}
		});

		// Convert map back to array, add materials count, and sort by session number
		return Array.from(sessionMap.values())
			.map(session => ({
				...session,
				materials_count: sessionData[session.session_number]?.materials?.length || 0
			}))
			.sort((a, b) => a.session_number - b.session_number);
	})());
</script>

<!-- Sessions Page with Tree Sidebar -->
<div class="flex min-h-screen" style="--course-accent-dark: {accentDark}; --course-accent-light: {accentLight};">
	<!-- Session Tree Sidebar -->
	<div class="w-72 flex-shrink-0 border-r" style="border-color: rgba(255,255,255,0.1);">
		<SessionTreeSidebar
			modules={availableModules}
			sessions={sessionsWithUpdatedTitles}
			selectedModuleId={selectedModuleId}
			selectedSession={selectedSession}
			onModuleChange={handleModuleChange}
			onSessionChange={handleSessionChange}
			onSessionTitleChange={handleSessionTitleChangeFromSidebar}
			onAddSession={addSession}
			onSessionDelete={handleSessionDelete}
			onSessionReorder={handleSessionReorder}
		/>
	</div>

	<!-- Content Area -->
	<div class="flex-1 overflow-y-auto">
		<!-- Top Header with Save Status -->
		<div class="sticky top-0 z-10 backdrop-blur-md border-b px-8 py-4" style="background-color: color-mix(in srgb, var(--course-accent-dark) 95%, transparent); border-color: rgba(255,255,255,0.1);">
			<div class="flex items-center justify-between">
				<div class="flex-1">
					<!-- Editable Session Title -->
					<div class="flex items-center gap-2 group"
						onmouseenter={() => titleHovered = true}
						onmouseleave={() => titleHovered = false}>
						{#if editingTitle}
							<input
								type="text"
								value={currentSession.title}
								oninput={(e) => handleTitleInput(e.target.value)}
								onblur={() => editingTitle = false}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.target.blur();
									} else if (e.key === 'Escape') {
										editingTitle = false;
									}
								}}
								class="text-2xl font-bold text-white bg-white/10 border border-white/20 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-white/40"
								style="background-color: rgba(255,255,255,0.1);"
								autofocus
							/>
						{:else}
							<h1 class="text-2xl font-bold text-white">
								{#if currentSession.title}
									{currentSession.title}
								{:else}
									<span class="text-white/40 italic">Untitled Session</span>
								{/if}
							</h1>
							<button
								onclick={() => editingTitle = true}
								class="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-white/10 rounded"
								title="Edit session title"
								style="opacity: {titleHovered ? '1' : '0'}">
								<Pencil size={16} class="text-white/70" />
							</button>
						{/if}
					</div>
					<p class="text-sm text-white/60 mt-0.5">{selectedModule.name}</p>
				</div>

				<!-- Save Status -->
				<div class="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2 text-white text-sm border border-white/20">
					{#if saving}
						<div class="animate-spin w-3 h-3 border border-white/40 border-t-white rounded-full"></div>
						<span class="text-white/90">{saveMessage || 'Saving...'}</span>
					{:else if saveMessage && saveMessage !== 'Saved'}
						<svg class="w-3 h-3 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
						</svg>
						<span class="text-red-300">{saveMessage}</span>
					{:else}
						<svg class="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
						</svg>
						<span class="text-green-300">Saved</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Session Content -->
		<div class="p-8">
			{#if !dataInitialized}
				<!-- Skeleton Loading State -->
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
					<!-- Left: Materials and Session Overview Skeletons -->
					<div class="lg:col-span-2 space-y-6">
						<!-- Session Overview Skeleton -->
						<div class="bg-white/5 rounded-lg p-6">
							<div class="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
							<div class="h-32 bg-white/10 rounded"></div>
						</div>

						<!-- Materials Skeleton -->
						<div class="bg-white/5 rounded-lg p-6">
							<div class="h-6 bg-white/10 rounded w-1/4 mb-4"></div>
							<div class="space-y-3">
								<div class="h-16 bg-white/10 rounded"></div>
								<div class="h-16 bg-white/10 rounded"></div>
								<div class="h-16 bg-white/10 rounded"></div>
							</div>
						</div>
					</div>

					<!-- Right: Reflection Skeleton -->
					<div>
						<div class="bg-white/5 rounded-lg p-6">
							<div class="h-6 bg-white/10 rounded w-2/3 mb-4"></div>
							<div class="h-24 bg-white/10 rounded"></div>
						</div>
					</div>
				</div>
			{:else}
				<!-- Actual Content with smooth transition -->
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-8 transition-opacity duration-200" style="animation: fadeIn 0.2s ease-in;">
					<!-- Left: Materials and Session Overview -->
					<div class="lg:col-span-2 space-y-6">
						<!-- Session Overview -->
						<SessionOverviewEditor
							sessionOverview={currentSession.description}
							onOverviewChange={handleOverviewChange}
							sessionNumber={selectedSession}
						/>

						<!-- Materials Editor -->
						<MaterialEditor
							materials={currentSession.materials}
							onMaterialsChange={handleMaterialsChange}
							onSaveStatusChange={handleSaveStatusChange}
							allowNativeContent={true}
							allowDocumentUpload={true}
							moduleId={selectedModule.id}
							sessionNumber={selectedSession}
							sessionId={currentSession.id}
							courseId={data.course.id}
						/>
					</div>

					<!-- Right: Reflection & Preview -->
					<div>
						<ReflectionEditor
							reflectionQuestion={currentSession.reflection}
							onReflectionChange={handleReflectionChange}
							sessionNumber={selectedSession}
						/>

						<!-- Student Preview -->
						<div class="mt-6">
							<StudentPreview
								sessionNumber={selectedSession}
								sessionOverview={currentSession.description}
								materials={currentSession.materials}
							/>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	onConfirm={confirmDeleteSession}
	onCancel={() => { showDeleteConfirm = false; sessionToDelete = null; }}
>
	<p>Are you sure you want to delete Session {sessionToDelete?.number}?</p>
	<p class="text-sm text-gray-500 mt-2">This will permanently delete:</p>
	<ul class="text-sm text-gray-500 list-disc list-inside mt-1">
		<li>Session materials</li>
		<li>Reflection questions</li>
		<li>Session description</li>
	</ul>
	<p class="text-sm text-red-600 mt-2 font-medium">This action cannot be undone.</p>
</ConfirmationModal>

<style>
	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
</style>
