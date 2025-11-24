<script>
	import { page, navigating } from '$app/stores';
	import { goto, invalidate } from '$app/navigation';
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

	// Available modules from server
	let availableModules = $state(data.modules || []);

	// Course theme colors
	const courseTheme = data.courseTheme || {};
	const accentDark = courseTheme.accentDark || '#334642';
	const accentLight = courseTheme.accentLight || '#c59a6b';

	// Get module from URL (derived from URL params)
	const selectedModuleId = $derived($page.url.searchParams.get('module'));
	const selectedModule = $derived(
		availableModules.find(m => m.id === selectedModuleId) || availableModules[0]
	);
	let totalSessions = $state(8); // Default sessions, can be adjusted per module
	let showCreateModule = $state(false);
	let editingModule = $state(null); // For inline editing

	// Editable module fields
	let editModuleName = $state('');
	let editModuleDescription = $state('');

	let selectedSession = $state(0); // Start with Week 0
	let sessionMaterials = $state({});
	let sessionReflections = $state({});
	let sessionReflectionsEnabled = $state({}); // Track reflections_enabled per session
	let sessionDescriptions = $state({}); // Track session descriptions/overviews
	let sessionTitles = $state({}); // Track session titles
	let sessionIds = $state({}); // Track session IDs for updates
	let modifiedReflections = $state(new Set()); // Track which sessions have modified reflections (don't overwrite on reload)
	let dataInitialized = $state(false);
	let saving = $state(false);
	let saveMessage = $state('');
	let titleSaveTimeout = null;
	let editingTitle = $state(false);
	let titleHovered = $state(false);
	let showDeleteConfirm = $state(false);
	let sessionToDelete = $state(null);

	// Process server-loaded data into component state
	const processServerData = (moduleId) => {
		const moduleSessions = data.sessions.filter(s => s.module_id === moduleId);

		// Initialize all session slots (0-8)
		for (let i = 0; i <= totalSessions; i++) {
			const session = moduleSessions.find(s => s.session_number === i);

			if (session) {
				sessionIds[i] = session.id;
				sessionDescriptions[i] = session.description || '';
				sessionTitles[i] = session.title || (i === 0 ? 'Pre-Start' : `Session ${i}`);

				// Get materials for this session
				sessionMaterials[i] = data.materials
					.filter(m => m.session_id === session.id)
					.map(m => ({
						id: m.id,
						type: m.type,
						title: m.title,
						url: m.type === 'native' ? '' : m.content,
						content: m.type === 'native' ? m.content : '',
						description: m.description || '',
						order: m.display_order
					}));

				// Get reflection question for this session
				// Don't overwrite if this session's reflection was recently modified
				if (!modifiedReflections.has(i)) {
					const question = data.reflectionQuestions.find(q => q.session_id === session.id);
					sessionReflections[i] = question ? question.question_text : '';
				}

				// Only enable reflections if there's actually a question
				// This prevents inconsistent state where reflections are enabled but no question exists
				const hasQuestion = sessionReflections[i]?.trim().length > 0;
				sessionReflectionsEnabled[i] = hasQuestion ? (session.reflections_enabled ?? true) : false;
			} else {
				// Session doesn't exist yet - initialize empty
				sessionIds[i] = null;
				sessionDescriptions[i] = '';
				sessionTitles[i] = i === 0 ? 'Pre-Start' : `Session ${i}`;
				sessionReflectionsEnabled[i] = false; // Default to false for new sessions
				sessionMaterials[i] = [];
				sessionReflections[i] = '';
			}
		}

		dataInitialized = true;
	};

	// Initialize data from server when module changes
	$effect(() => {
		if (selectedModule?.id) {
			processServerData(selectedModule.id);
		}
	});

	// Handler functions for component events
	const handleMaterialsChange = async (newMaterials) => {
		// Update local state immediately for responsive UI
		sessionMaterials[selectedSession] = newMaterials;

		// Note: Individual CRUD operations are handled in MaterialEditor component
		// This handler is mainly for UI state management
		console.log('Materials updated for session', selectedSession);
	};

	const handleSaveStatusChange = (isSaving, message) => {
		saving = isSaving;
		saveMessage = message;
	};

	const handleReflectionsEnabledChange = async (newEnabled) => {
		// Prevent enabling reflections if there's no question
		if (newEnabled && !sessionReflections[selectedSession]?.trim()) {
			toastError('Cannot enable reflections without a reflection question', 'Missing Question');
			return;
		}

		sessionReflectionsEnabled[selectedSession] = newEnabled;

		saving = true;
		saveMessage = 'Updating reflection settings...';

		try {
			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionIds[selectedSession],
					reflections_enabled: newEnabled
				})
			});

			if (response.ok) {
				saveMessage = 'Saved';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 1000);
			} else {
				const errorData = await response.json();
				saveMessage = 'Save failed';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 2000);
				toastError(`Failed to update reflection settings: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error updating reflection settings:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError('Failed to update reflection settings');
		}
	};

	const handleReflectionChange = async (newReflection) => {
		// Update local state immediately for reactive UI (use spread to trigger Svelte 5 reactivity)
		sessionReflections = {
			...sessionReflections,
			[selectedSession]: newReflection
		};

		// Reflections are always enabled when a question exists (default to ON)
		const shouldEnableReflections = newReflection.trim().length > 0;
		sessionReflectionsEnabled[selectedSession] = shouldEnableReflections;

		saving = true;
		saveMessage = 'Saving reflection question...';

		try {
			// Check if reflection question already exists
			console.log('[Reflection] Fetching existing questions for module:', selectedModule.id, 'session:', selectedSession);
			const existingQuestions = await fetch(`/api/courses/module-reflection-questions?module_id=${selectedModule.id}&session_number=${selectedSession}`);
			const questionsData = await existingQuestions.json();
			console.log('[Reflection] Questions response:', questionsData);

			// Find question for this session and always use the most recently updated one
			const matchingQuestions = questionsData.questions?.filter(q => q.courses_sessions?.session_number === selectedSession) || [];
			const existingQuestion = matchingQuestions.sort((a, b) =>
				new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
			)[0];
			console.log('[Reflection] Found existing question:', existingQuestion);

			let response;
			let savedData;

			// If question is empty, delete it
			if (newReflection.trim().length === 0 && existingQuestion) {
				console.log('[Reflection] DELETING empty question with ID:', existingQuestion.id);
				response = await fetch('/api/courses/module-reflection-questions', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: existingQuestion.id })
				});
				console.log('[Reflection] DELETE response status:', response.status);
				if (response.ok) {
					savedData = { success: true };
					toastSuccess('Reflection question removed');
				}
			} else if (newReflection.trim().length > 0) {
				// Ensure session exists before creating/updating
				if (!sessionIds[selectedSession]) {
					const getSessionResponse = await fetch(
						`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${selectedSession}`
					);
					if (!getSessionResponse.ok) {
						throw new Error('Failed to get or create session');
					}
					const sessionData = await getSessionResponse.json();
					sessionIds[selectedSession] = sessionData.session.id;
				}

				if (existingQuestion) {
					// Update existing question
					console.log('[Reflection] UPDATING existing question with ID:', existingQuestion.id);
					console.log('[Reflection] New question text:', newReflection);
					response = await fetch('/api/courses/module-reflection-questions', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							id: existingQuestion.id,
							question_text: newReflection
						})
					});
					console.log('[Reflection] PUT response status:', response.status);
					savedData = await response.json();
					console.log('[Reflection] PUT response data:', savedData);
				} else {
					// Create new question
					console.log('[Reflection] CREATING new question for session_id:', sessionIds[selectedSession]);
					console.log('[Reflection] New question text:', newReflection);
					response = await fetch('/api/courses/module-reflection-questions', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							session_id: sessionIds[selectedSession],
							question_text: newReflection
						})
					});
					console.log('[Reflection] POST response status:', response.status);
					savedData = await response.json();
					console.log('[Reflection] POST response data:', savedData);
				}
			} else {
				// Empty question and no existing question - nothing to do
				saving = false;
				saveMessage = '';
				return;
			}

			if (response && response.ok) {
				// savedData is already populated from above
				console.log('[Reflection] Saved question data:', savedData);

				// Update local state with the server response to ensure reactivity
				if (savedData && savedData.question) {
					// Use object spread to trigger Svelte 5 reactivity
					sessionReflections = {
						...sessionReflections,
						[selectedSession]: savedData.question.question_text
					};
					// Mark this session as modified so processServerData doesn't overwrite it
					modifiedReflections = new Set([...modifiedReflections, selectedSession]);
					console.log('[Reflection] Updated local state with saved question:', sessionReflections[selectedSession]);
				}

				// No need to invalidate - optimistic update is instant!
				// The unique constraint ensures no duplicates, and we always pick the most recent

				// Update reflections_enabled flag in database (always enabled when question exists)
				if (sessionIds[selectedSession]) {
					await fetch('/api/courses/sessions', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							session_id: sessionIds[selectedSession],
							reflections_enabled: shouldEnableReflections
						})
					});
				}

				if (!savedData.success) {
					toastSuccess('Reflection question saved');
				}

				saveMessage = 'Saved';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 1000);
			} else if (response && !response.ok) {
				let errorData;
				try {
					errorData = await response.json();
				} catch (e) {
					errorData = { error: 'Unknown error' };
				}
				saveMessage = 'Save failed';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 2000);
				toastError(`Failed to save reflection question: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error saving reflection question:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError('Failed to save reflection question');
		}
	};

	const handleOverviewChange = async (newOverview) => {
		// Update session description in database
		saving = true;
		saveMessage = 'Saving session overview...';

		try {
			// Ensure session exists before updating
			if (!sessionIds[selectedSession]) {
				// Get/create the session (GET auto-creates if doesn't exist)
				const getSessionResponse = await fetch(
					`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${selectedSession}`
				);

				if (!getSessionResponse.ok) {
					throw new Error('Failed to get or create session');
				}

				const sessionData = await getSessionResponse.json();
				sessionIds[selectedSession] = sessionData.session.id;
			}

			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionIds[selectedSession],
					description: newOverview
				})
			});

			if (response.ok) {
				sessionDescriptions[selectedSession] = newOverview;
				saveMessage = 'Saved';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 1000);
				toastSuccess('Session overview saved');
			} else {
				const errorData = await response.json();
				saveMessage = 'Save failed';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 2000);
				toastError(`Failed to save session overview: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error saving session overview:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError('Failed to save session overview');
		}
	};

	const handleTitleInput = (newTitle) => {
		// Update local state immediately for responsive UI
		// Use spread operator to trigger Svelte 5 reactivity
		sessionTitles = {
			...sessionTitles,
			[selectedSession]: newTitle
		};

		// Clear existing timeout
		if (titleSaveTimeout) {
			clearTimeout(titleSaveTimeout);
		}

		// Debounce save - wait 1 second after user stops typing
		titleSaveTimeout = setTimeout(() => {
			saveTitleToDatabase(newTitle);
		}, 1000);
	};

	const saveTitleToDatabase = async (newTitle) => {
		// Update session title in database
		saving = true;
		saveMessage = 'Saving session title...';

		try {
			// Ensure session exists before updating
			if (!sessionIds[selectedSession]) {
				// Get/create the session (GET auto-creates if doesn't exist)
				const getSessionResponse = await fetch(
					`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${selectedSession}`
				);

				if (!getSessionResponse.ok) {
					throw new Error('Failed to get or create session');
				}

				const sessionData = await getSessionResponse.json();
				sessionIds[selectedSession] = sessionData.session.id;
			}

			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionIds[selectedSession],
					title: newTitle
				})
			});

			if (response.ok) {
				saveMessage = 'Saved';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 1000);
			} else {
				const errorData = await response.json();
				saveMessage = 'Save failed';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 2000);
				toastError(`Failed to save session title: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error saving session title:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError('Failed to save session title');
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
		// Find the session to update
		const session = data.sessions.find(s => s.id === sessionId);
		if (!session) return;

		// Update local state
		sessionTitles[session.session_number] = newTitle;

		// Save to database
		saving = true;
		saveMessage = 'Saving session title...';

		try {
			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionId,
					title: newTitle
				})
			});

			if (response.ok) {
				saveMessage = 'Saved';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 1000);
			} else {
				const errorData = await response.json();
				saveMessage = 'Save failed';
				setTimeout(() => {
					saving = false;
					saveMessage = '';
				}, 2000);
				toastError(`Failed to save session title: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error saving session title:', error);
			saveMessage = 'Save failed';
			setTimeout(() => {
				saving = false;
				saveMessage = '';
			}, 2000);
			toastError('Failed to save session title');
		}
	};

	const addSession = () => {
		totalSessions += 1;
		sessionMaterials[totalSessions] = [];
		sessionReflections[totalSessions] = '';
		toastSuccess(`Added Session ${totalSessions}`);
	};

	const removeSession = () => {
		if (totalSessions > 1) {
			delete sessionMaterials[totalSessions];
			delete sessionReflections[totalSessions];
			totalSessions -= 1;
			if (selectedSession > totalSessions) {
				selectedSession = totalSessions;
			}
			toastSuccess(`Removed session (now ${totalSessions} sessions)`);
		}
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

		saving = true;
		saveMessage = 'Deleting session...';

		try {
			const response = await fetch('/api/courses/sessions', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionToDelete.id
				})
			});

			if (response.ok) {
				// Clear local state for this session
				const sessionNum = sessionToDelete.number;
				delete sessionIds[sessionNum];
				delete sessionDescriptions[sessionNum];
				delete sessionTitles[sessionNum];
				delete sessionMaterials[sessionNum];
				delete sessionReflections[sessionNum];
				delete sessionReflectionsEnabled[sessionNum];

				// If we deleted the currently selected session, switch to session 0
				if (selectedSession === sessionNum) {
					selectedSession = 0;
				}

				toastSuccess('Session deleted successfully');
				await invalidate('session:data');
			} else {
				const errorData = await response.json();
				toastError(`Failed to delete session: ${errorData.error}`);
			}
		} catch (error) {
			console.error('Error deleting session:', error);
			toastError('Failed to delete session');
		} finally {
			saving = false;
			saveMessage = '';
			showDeleteConfirm = false;
			sessionToDelete = null;
		}
	};

	const startEditingModule = (module) => {
		editingModule = module;
		editModuleName = module.name;
		editModuleDescription = module.description;
	};

	const saveModuleChanges = async () => {
		// TODO: API call to update module
		const moduleIndex = availableModules.findIndex(m => m.id === editingModule.id);
		if (moduleIndex >= 0) {
			availableModules[moduleIndex].name = editModuleName;
			availableModules[moduleIndex].description = editModuleDescription;

			// selectedModule will auto-update via $derived reactivity
		}
		editingModule = null;
		toastSuccess('Module updated');
	};

	const cancelEditingModule = () => {
		editingModule = null;
		editModuleName = '';
		editModuleDescription = '';
	};

	const currentSessionData = $derived({
		materials: sessionMaterials[selectedSession] || [],
		reflectionQuestion: sessionReflections[selectedSession] || '',
		reflectionsEnabled: sessionReflectionsEnabled[selectedSession] ?? true,
		sessionOverview: sessionDescriptions[selectedSession] || '',
		sessionTitle: sessionTitles[selectedSession] || (selectedSession === 0 ? 'Pre-Start' : `Session ${selectedSession}`)
	});

	// Merge server sessions with updated titles for sidebar reactivity
	const sessionsWithUpdatedTitles = $derived(
		data.sessions.map(session => ({
			...session,
			title: sessionTitles[session.session_number] || session.title
		}))
	);
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
			totalSessions={totalSessions}
			onModuleChange={handleModuleChange}
			onSessionChange={handleSessionChange}
			onSessionTitleChange={handleSessionTitleChangeFromSidebar}
			onAddSession={addSession}
			onSessionDelete={handleSessionDelete}
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
								value={currentSessionData.sessionTitle}
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
							<h1 class="text-2xl font-bold text-white">{currentSessionData.sessionTitle}</h1>
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
							sessionOverview={currentSessionData.sessionOverview}
							onOverviewChange={handleOverviewChange}
							sessionNumber={selectedSession}
						/>

						<!-- Materials Editor -->
						<MaterialEditor
							materials={currentSessionData.materials}
							onMaterialsChange={handleMaterialsChange}
							onSaveStatusChange={handleSaveStatusChange}
							allowNativeContent={true}
							allowDocumentUpload={true}
							moduleId={selectedModule.id}
							sessionNumber={selectedSession}
							sessionId={sessionIds[selectedSession]}
							courseId={data.course.id}
						/>
					</div>

					<!-- Right: Reflection & Preview -->
					<div>
						<ReflectionEditor
							reflectionQuestion={currentSessionData.reflectionQuestion}
							onReflectionChange={handleReflectionChange}
							sessionNumber={selectedSession}
						/>

						<!-- Student Preview -->
						<div class="mt-6">
							<StudentPreview
								sessionNumber={selectedSession}
								sessionOverview={currentSessionData.sessionOverview}
								materials={currentSessionData.materials}
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
