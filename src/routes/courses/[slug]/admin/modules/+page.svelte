<script>
	import { onMount } from 'svelte';
	import MaterialEditor from '$lib/components/MaterialEditor.svelte';
	import ReflectionEditor from '$lib/components/ReflectionEditor.svelte';
	import SessionOverviewEditor from '$lib/components/SessionOverviewEditor.svelte';
	import SessionNavigationTabs from '$lib/components/SessionNavigationTabs.svelte';
	import StudentPreview from '$lib/components/StudentPreview.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

	// Available modules from database
	let availableModules = $state([
		{ id: 'f29f35b3-a651-4b86-b067-458a56db73c4', name: 'Module 1: Foundations of Faith', description: 'Introduction to Catholic doctrine, scripture, and the basics of Christian faith', order_number: 1 },
		{ id: '0e8b0cd7-b019-4a81-95cc-548a1eed346d', name: 'Module 2: Scripture & Tradition', description: 'Deep dive into biblical studies and the role of tradition in Catholic teaching', order_number: 2 },
		{ id: '926f8a52-f4b2-4ede-9a13-ffa0dc21fea7', name: 'Module 3: Sacraments & Liturgy', description: 'Understanding the seven sacraments and liturgical practices of the Church', order_number: 3 },
		{ id: '4a14089f-50ff-491b-a4d6-61cc576b2165', name: 'Module 4: Moral Teaching', description: 'Catholic social teaching, ethics, and moral decision-making in modern life', order_number: 4 }
	]);

	// Currently selected module
	let selectedModule = $state(availableModules[0]); // Default to first module
	let totalSessions = $state(8); // Default sessions, can be adjusted per module
	let showCreateModule = $state(false);
	let editingModule = $state(null); // For inline editing

	// Editable module fields
	let editModuleName = $state('');
	let editModuleDescription = $state('');

	let selectedSession = $state(1);
	let sessionMaterials = $state({});
	let sessionReflections = $state({});
	let loading = $state(false);
	let saving = $state(false);
	let saveMessage = $state('');

	// Initialize empty sessions (will be called when module changes)
	const initializeSessions = () => {
		sessionMaterials = {};
		sessionReflections = {};
		for (let i = 1; i <= totalSessions; i++) {
			sessionMaterials[i] = [];
			sessionReflections[i] = '';
		}
	};

	// Initialize for default module
	initializeSessions();

	// Load data for a specific session from MODULE
	const loadSessionData = async (session) => {
		loading = true;
		try {
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
						module_id: selectedModule.id,
						session_number: selectedSession,
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

	const handleOverviewChange = (newOverview) => {
		// TODO: Implement session overview database integration when that table is created
		console.log('Session overview updated for session', selectedSession, newOverview);
		toastSuccess('Session overview updated (local only)');
	};

	const handleSessionChange = async (session) => {
		selectedSession = session;
		// Load data for the new session if not already loaded
		if (!sessionMaterials[session] || sessionMaterials[session].length === 0) {
			await loadSessionData(session);
		}
	};

	const handleModuleChange = async (module) => {
		selectedModule = module;
		selectedSession = 1;
		initializeSessions();
		await loadSessionData(1);
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

	const currentSessionData = $derived(() => ({
		materials: sessionMaterials[selectedSession] || [],
		reflectionQuestion: sessionReflections[selectedSession] || '',
		sessionOverview: '' // TODO: Implement when session overview table exists
	}));
</script>

<div class="px-16 py-12">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-5xl font-bold text-white mb-2">Modules</h1>
			<p class="text-lg text-white/80">Create and manage course modules</p>
		</div>

		<!-- Module Selection & Details (Top Section) -->
		<div class="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 mb-8">
			<div class="grid grid-cols-5 gap-8 p-6">
				<!-- Left: Module List -->
				<div class="col-span-2">
					<div class="flex items-center justify-between mb-4">
						<h2 class="text-xl font-semibold text-white">Modules</h2>
					<button
						onclick={() => showCreateModule = true}
						class="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
						title="Create new module"
						aria-label="Create new module"
					>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
							</svg>
						</button>
					</div>

					<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each availableModules as module}
						<div
							onclick={() => handleModuleChange(module)}
							onkeydown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleModuleChange(module);
								}
							}}
							role="button"
							tabindex="0"
							class="p-3 rounded-lg cursor-pointer transition-colors group {selectedModule.id === module.id ? 'bg-white/20 text-white' : 'bg-white/5 text-white/80 hover:bg-white/10'}"
						>
								<div class="flex items-start justify-between">
									<div class="flex-1 min-w-0">
										<div class="font-semibold mb-1 truncate">{module.name}</div>
										<div class="text-sm opacity-75 line-clamp-1">{module.description}</div>
									</div>
							<button
								onclick={(event) => {
									event.stopPropagation();
									startEditingModule(module);
								}}
								class="ml-2 p-1 opacity-0 group-hover:opacity-100 text-white/60 hover:text-white transition-all"
								title="Edit module"
								aria-label={`Edit module ${module.name}`}
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
								</svg>
							</button>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Right: Module Details & Session Management -->
				<div class="col-span-3">
					{#if editingModule}
						<!-- Edit Mode -->
						<div class="space-y-4">
							<h3 class="text-xl font-semibold text-white">Edit Module</h3>
							<input
								bind:value={editModuleName}
								class="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50"
								placeholder="Module name"
							/>
							<textarea
								bind:value={editModuleDescription}
								rows="3"
								class="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 resize-none"
								placeholder="Module description"
							></textarea>
							<div class="flex gap-3">
								<button
									onclick={saveModuleChanges}
									class="bg-green-500/20 text-green-300 px-6 py-2 rounded-lg hover:bg-green-500/30 font-semibold"
								>
									Save Changes
								</button>
								<button
									onclick={cancelEditingModule}
									class="bg-red-500/20 text-red-300 px-6 py-2 rounded-lg hover:bg-red-500/30 font-semibold"
								>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<!-- View Mode -->
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<h3 class="text-2xl font-semibold text-white mb-2">{selectedModule.name}</h3>
								<p class="text-white/80 text-lg mb-4">{selectedModule.description}</p>
								<p class="text-white/60 text-sm">Currently {totalSessions} sessions • Changes affect all cohorts using this module</p>
							</div>

							<!-- Session Management -->
							<div class="flex items-center gap-4 ml-6">
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

					<div class="flex items-center gap-3">
						<span class="text-white/80 text-sm">{totalSessions} sessions</span>
						<button
							onclick={removeSession}
							disabled={totalSessions <= 1}
							class="p-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
							title="Remove session"
							aria-label="Remove session"
						>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
										</svg>
									</button>
						<button
							onclick={addSession}
							class="p-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors"
							title="Add session"
							aria-label="Add session"
						>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
										</svg>
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Session Navigation (Full Width) - Sticky -->
		<div class="sticky top-12 z-10 bg-gray-900/95 backdrop-blur-md rounded-2xl border border-gray-700 mb-8 p-6 shadow-lg">
			<div class="flex items-center justify-between mb-4">
				<h4 class="text-xl font-semibold text-white">{selectedModule.name}</h4>
				<span class="text-white/60 text-sm">Editing: Session {selectedSession} of {totalSessions}</span>
			</div>

			<div class="flex gap-3 overflow-x-auto pb-2">
				{#each Array(totalSessions).fill(0) as _, i}
					<button
						onclick={() => handleSessionChange(i + 1)}
						class="flex-shrink-0 px-6 py-3 rounded-xl font-semibold transition-all {selectedSession === i + 1 ? 'bg-white text-gray-800' : 'bg-white/20 text-white hover:bg-white/30'}"
					>
						Session {i + 1}
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
						sessionOverview={currentSessionData().sessionOverview}
						onOverviewChange={handleOverviewChange}
					/>

					<!-- Materials Editor -->
					<MaterialEditor
						materials={currentSessionData().materials}
						onMaterialsChange={handleMaterialsChange}
						onSaveStatusChange={handleSaveStatusChange}
						allowNativeContent={true}
						allowDocumentUpload={true}
						moduleId={selectedModule.id}
						sessionNumber={selectedSession}
					/>
				</div>

				<!-- Right: Reflection & Preview -->
				<div>
					<ReflectionEditor
						reflectionQuestion={currentSessionData().reflectionQuestion}
						onReflectionChange={handleReflectionChange}
					/>

					<!-- Student Preview -->
					<div class="mt-6">
						<StudentPreview
							sessionNumber={selectedSession}
							sessionOverview={currentSessionData().sessionOverview}
							materials={currentSessionData().materials}
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
