<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import MaterialEditor from '$lib/components/MaterialEditor.svelte';
	import ReflectionEditor from '$lib/components/ReflectionEditor.svelte';
	import SessionOverviewEditor from '$lib/components/SessionOverviewEditor.svelte';
	import SessionNavigationTabs from '$lib/components/SessionNavigationTabs.svelte';
	import StudentPreview from '$lib/components/StudentPreview.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

	let { data } = $props();

	// Available modules from server
	let availableModules = $state(data.modules || []);

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
	let sessionIds = $state({}); // Track session IDs for updates
	let loading = $state(false);
	let saving = $state(false);
	let saveMessage = $state('');

	// Initialize empty sessions (will be called when module changes)
	const initializeSessions = () => {
		sessionMaterials = {};
		sessionReflections = {};
		sessionReflectionsEnabled = {};
		sessionDescriptions = {};
		sessionIds = {};
		// Include Week 0 (session 0)
		for (let i = 0; i <= totalSessions; i++) {
			sessionMaterials[i] = [];
			sessionReflections[i] = '';
			sessionReflectionsEnabled[i] = true; // Default to enabled
			sessionDescriptions[i] = '';
			sessionIds[i] = null;
		}
	};

	// Initialize for default module
	initializeSessions();

	// Load data for a specific session from MODULE
	const loadSessionData = async (session) => {
		loading = true;
		try {
			// Load session metadata (including reflections_enabled)
			const sessionResponse = await fetch(`/api/courses/sessions?module_id=${selectedModule.id}&session_number=${session}`);
			const sessionData = await sessionResponse.json();

			if (sessionResponse.ok && sessionData.session) {
				sessionReflectionsEnabled[session] = sessionData.session.reflections_enabled ?? true;
				sessionDescriptions[session] = sessionData.session.description || '';
				sessionIds[session] = sessionData.session.id;
				console.log('Loaded session data:', { session, reflectionsEnabled: sessionReflectionsEnabled[session], description: sessionDescriptions[session], sessionId: sessionIds[session] });
			} else {
				console.error('Failed to load session metadata:', sessionData);
			}

			// Load materials from MODULE
			const materialsResponse = await fetch(`/api/courses/module-materials?module_id=${selectedModule.id}&session_number=${session}`);
			const materialsData = await materialsResponse.json();

			if (materialsResponse.ok) {
				// Convert database format to component format
				sessionMaterials[session] = materialsData.materials.map(m => ({
					id: m.id,
					type: m.type,
					title: m.title,
					url: m.type === 'native' ? '' : m.content, // For non-native types, content contains URL
					content: m.type === 'native' ? m.content : '', // For native types, content contains HTML
					description: m.description || '',
					order: m.display_order
				}));
			} else {
				toastError(`Failed to load materials: ${materialsData.error}`);
			}

			// Load reflection question from MODULE
			const reflectionResponse = await fetch(`/api/courses/module-reflection-questions?module_id=${selectedModule.id}&session_number=${session}`);
			const reflectionData = await reflectionResponse.json();

			if (reflectionResponse.ok) {
				const question = reflectionData.questions.find(q => q.session_number === session);
				sessionReflections[session] = question ? question.question_text : '';
			} else {
				toastError(`Failed to load reflection question: ${reflectionData.error}`);
			}
		} catch (error) {
			console.error('Error loading session data:', error);
			toastError('Failed to load session data');
		} finally {
			loading = false;
		}
	};

	// Load initial data
	onMount(() => {
		loadSessionData(selectedSession);
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
				toastSuccess(newEnabled ? 'Reflections enabled' : 'Reflections disabled');
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
		sessionReflections[selectedSession] = newReflection;

		saving = true;
		saveMessage = 'Saving reflection question...';

		try {
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
			const response = await fetch('/api/courses/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					session_id: sessionIds[selectedSession],
					description: newOverview
				})
			});

			if (response.ok) {
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

	const handleSessionChange = async (session) => {
		selectedSession = session;
		// Load data for the new session if not already loaded
		if (!sessionMaterials[session] || sessionMaterials[session].length === 0) {
			await loadSessionData(session);
		}
	};

	const handleModuleChange = async (moduleId) => {
		selectedModuleId = moduleId;
		selectedSession = 0; // Start with Pre-Start

		// Update URL to reflect selected module
		const url = new URL($page.url);
		url.searchParams.set('module', moduleId);
		goto(url.toString(), { replaceState: true, keepFocus: true });

		initializeSessions();
		await loadSessionData(0);
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
		sessionOverview: sessionDescriptions[selectedSession] || ''
	});
</script>

<div class="px-16 py-12">
	<div class="max-w-7xl mx-auto">
		<!-- Header with Module Dropdown -->
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="text-5xl font-bold text-white mb-2">Session Materials</h1>
				<p class="text-lg text-white/80">Edit content for each session</p>
			</div>

			<!-- Module Selector Dropdown & Save Status -->
			<div class="flex items-center gap-4">
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

				<select
					value={selectedModuleId}
					onchange={(e) => handleModuleChange(e.target.value)}
					class="bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white font-semibold text-base"
				>
					{#each availableModules as module}
						<option value={module.id} class="bg-gray-800 text-white">{module.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Session Navigation (Full Width) - Sticky -->
		<div class="sticky top-12 z-10 bg-gray-900/95 backdrop-blur-md rounded-2xl border border-gray-700 mb-8 p-6 shadow-lg">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl font-bold text-white">
					{selectedSession === 0 ? 'Pre-Start' : `Session ${selectedSession}`}
				</h2>
				<span class="text-white/70 text-sm">{selectedModule.name}</span>
			</div>

			<div class="flex gap-2 items-center flex-wrap">
				<!-- Pre-Start Button -->
				<button
					onclick={() => handleSessionChange(0)}
					class="px-4 h-12 rounded-lg font-bold text-sm transition-all {selectedSession === 0 ? 'bg-white text-gray-800 shadow-lg' : 'bg-white/20 text-white hover:bg-white/30'}"
					title="Pre-Start"
				>
					Pre-Start
				</button>

				<!-- Regular Sessions (1-8) -->
				{#each Array(totalSessions).fill(0) as _, i}
					<button
						onclick={() => handleSessionChange(i + 1)}
						class="w-12 h-12 rounded-lg font-bold text-xl transition-all {selectedSession === i + 1 ? 'bg-white text-gray-800 shadow-lg scale-110' : 'bg-white/20 text-white hover:bg-white/30'}"
						title="Session {i + 1}"
					>
						{i + 1}
					</button>
				{/each}
			</div>
		</div>

		<!-- Session Content (Full Width) -->
		<div class="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
					/>
				</div>

				<!-- Right: Reflection & Preview -->
				<div>
					<ReflectionEditor
						reflectionQuestion={currentSessionData.reflectionQuestion}
						reflectionsEnabled={currentSessionData.reflectionsEnabled}
						onReflectionChange={handleReflectionChange}
						onReflectionsEnabledChange={handleReflectionsEnabledChange}
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
		</div>
	</div>
</div>
