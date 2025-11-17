<script>
	import { page, navigating } from '$app/stores';
	import { goto } from '$app/navigation';
	import MaterialEditor from '$lib/components/MaterialEditor.svelte';
	import ReflectionEditor from '$lib/components/ReflectionEditor.svelte';
	import SessionOverviewEditor from '$lib/components/SessionOverviewEditor.svelte';
	import SessionTreeSidebar from '$lib/components/SessionTreeSidebar.svelte';
	import StudentPreview from '$lib/components/StudentPreview.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
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

	// Get module from URL or default to first
	let selectedModuleId = $state($page.url.searchParams.get('module') || availableModules[0]?.id);
	let selectedModule = $derived(availableModules.find(m => m.id === selectedModuleId) || availableModules[0]);
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
	let dataInitialized = $state(false);
	let saving = $state(false);
	let saveMessage = $state('');
	let titleSaveTimeout = null;

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
				const question = data.reflectionQuestions.find(q => q.session_id === session.id);
				sessionReflections[i] = question ? question.question_text : '';

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

	// Initialize data from server on mount
	$effect(() => {
		if (selectedModule?.id) {
			processServerData(selectedModule.id);

			// Fix any inconsistent states in the database (reflections enabled but no question)
			// Run this asynchronously after data is loaded
			setTimeout(async () => {
				for (let i = 0; i <= totalSessions; i++) {
					const hasQuestion = sessionReflections[i]?.trim().length > 0;
					const sessionId = sessionIds[i];

					// If reflections are enabled in DB but no question exists, disable them
					if (sessionId) {
						const dbSession = data.sessions.find(s => s.id === sessionId);
						if (dbSession && dbSession.reflections_enabled && !hasQuestion) {
							// Silently update the database to fix the inconsistency
							await fetch('/api/courses/sessions', {
								method: 'PUT',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									session_id: sessionId,
									reflections_enabled: false
								})
							});
						}
					}
				}
			}, 500);
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
		// Update local state immediately for reactive UI
		sessionReflections[selectedSession] = newReflection;

		// Auto-toggle reflections based on question content
		const shouldEnableReflections = newReflection.trim().length > 0;
		const reflectionsStateChanged = sessionReflectionsEnabled[selectedSession] !== shouldEnableReflections;

		// Update reflections enabled state immediately (optimistic update)
		sessionReflectionsEnabled[selectedSession] = shouldEnableReflections;

		saving = true;
		saveMessage = 'Saving reflection question...';

		try {
			// Ensure session exists before creating/updating reflection question
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

			// Check if reflection question already exists in MODULE
			const existingQuestions = await fetch(`/api/courses/module-reflection-questions?module_id=${selectedModule.id}&session_number=${selectedSession}`);
			const questionsData = await existingQuestions.json();

			const existingQuestion = questionsData.questions?.find(q => q.session_number === selectedSession);

			let response;
			if (existingQuestion) {
				// Update existing question
				response = await fetch('/api/courses/module-reflection-questions', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: existingQuestion.id,
						question_text: newReflection
					})
				});
			} else {
				// Create new question
				response = await fetch('/api/courses/module-reflection-questions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						session_id: sessionIds[selectedSession],
						question_text: newReflection
					})
				});
			}

			if (response.ok) {
				// Auto-update reflections_enabled flag in database if changed
				if (reflectionsStateChanged && sessionIds[selectedSession]) {
					await fetch('/api/courses/sessions', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							session_id: sessionIds[selectedSession],
							reflections_enabled: shouldEnableReflections
						})
					});
				}

				toastSuccess('Reflection question saved');

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
		sessionTitles[selectedSession] = newTitle;

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
		selectedModuleId = moduleId;
		selectedSession = 0; // Start with Pre-Start

		// Update URL to reflect selected module
		const url = new URL($page.url);
		url.searchParams.set('module', moduleId);
		goto(url.toString(), { replaceState: true, keepFocus: true });

		// Process server data for the new module (instant, no API calls)
		processServerData(moduleId);
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

			// Update selected module if it's the one being edited
			if (selectedModule.id === editingModule.id) {
				selectedModule = { ...availableModules[moduleIndex] };
			}
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
</script>

<!-- Sessions Page with Tree Sidebar -->
<div class="flex min-h-screen" style="--course-accent-dark: {accentDark}; --course-accent-light: {accentLight};">
	<!-- Session Tree Sidebar -->
	<div class="w-72 flex-shrink-0 border-r" style="border-color: rgba(255,255,255,0.1);">
		<SessionTreeSidebar
			modules={availableModules}
			sessions={data.sessions}
			selectedModuleId={selectedModuleId}
			selectedSession={selectedSession}
			onModuleChange={handleModuleChange}
			onSessionChange={handleSessionChange}
			onSessionTitleChange={handleSessionTitleChangeFromSidebar}
		/>
	</div>

	<!-- Content Area -->
	<div class="flex-1 overflow-y-auto">
		<!-- Top Header with Save Status -->
		<div class="sticky top-0 z-10 backdrop-blur-md border-b px-8 py-4" style="background-color: color-mix(in srgb, var(--course-accent-dark) 95%, transparent); border-color: rgba(255,255,255,0.1);">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-white">{currentSessionData.sessionTitle}</h1>
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
							weekNumber={selectedSession}
						/>

						<!-- Materials Editor -->
						<MaterialEditor
							materials={currentSessionData.materials}
							onMaterialsChange={handleMaterialsChange}
							onSaveStatusChange={handleSaveStatusChange}
							allowNativeContent={true}
							allowDocumentUpload={true}
							moduleId={selectedModule.id}
							weekNumber={selectedSession}
							sessionId={sessionIds[selectedSession]}
							courseId={data.course.id}
						/>
					</div>

					<!-- Right: Reflection & Preview -->
					<div>
						<ReflectionEditor
							reflectionQuestion={currentSessionData.reflectionQuestion}
							reflectionsEnabled={currentSessionData.reflectionsEnabled}
							onReflectionChange={handleReflectionChange}
							onReflectionsEnabledChange={handleReflectionsEnabledChange}
							weekNumber={selectedSession}
						/>

						<!-- Student Preview -->
						<div class="mt-6">
							<StudentPreview
								weekNumber={selectedSession}
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
