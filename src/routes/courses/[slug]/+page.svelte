<script>
	import HubCoordinatorBar from './HubCoordinatorBar.svelte';
	import SessionContent from './SessionContent.svelte';
	import MaterialViewer from './MaterialViewer.svelte';
	import PastReflectionsSection from './PastReflectionsSection.svelte';
	import PublicReflectionsFeed from './PublicReflectionsFeed.svelte';
	import ReflectionModal from './ReflectionModal.svelte';

	let { data } = $props();

	// Extract data from server load
	const { materialsBySession, currentSession: initialSession, courseData: initialCourseData, pastReflections, publicReflections, sessionsByNumber, courseSlug, hubData } = data;

	// Svelte 5 state with runes
	let currentSession = $state(initialSession);
	// Students can only access sessions up to their current_session
	// If current_session is 0 (not started), they can't access any sessions
	let availableSessions = $state(initialSession);
	let showMaterialViewer = $state(false);
	let selectedMaterial = $state(null);
	let showReflectionModal = $state(false);
	let selectedReflection = $state(null);

	// Real data from database
	let courseData = $state(initialCourseData);

	const handleSessionChange = (sessionNum) => {
		console.log(`Switched to session ${sessionNum}`);
		currentSession = sessionNum;

		// Update course data for the selected session
		const sessionMaterials = materialsBySession[sessionNum] || [];
		const sessionQuestion = data.questionsBySession[sessionNum] || null;
		const sessionInfo = sessionsByNumber[sessionNum];

		courseData = {
			...courseData,
			currentSessionData: {
				sessionNumber: sessionNum,
				sessionTitle: sessionInfo?.title || `Session ${sessionNum}`,
				sessionOverview: sessionInfo?.description || `Session ${sessionNum} content and materials`,
				materials: sessionMaterials,
				reflectionQuestion: sessionQuestion,
				reflectionStatus: 'not_started' // TODO: Get actual status
			}
		};
	};

	const openMaterial = (material) => {
		if (material.viewable) {
			selectedMaterial = material;
			showMaterialViewer = true;
		}
	};

	const closeMaterialViewer = () => {
		showMaterialViewer = false;
		selectedMaterial = null;
	};

	const openReflectionModal = (reflection) => {
		selectedReflection = reflection;
		showReflectionModal = true;
	};

	const closeReflectionModal = () => {
		showReflectionModal = false;
		selectedReflection = null;
	};

	const navigateReflection = (currentSession, direction) => {
		// In real app, this would navigate to adjacent reflections
		console.log(`Navigate ${direction} from session ${currentSession}`);
	};

	// Derived values
	const currentSessionData = $derived(courseData.currentSessionData);
	const materials = $derived(currentSessionData.materials);
</script>

<!-- Single content wrapper with consistent margins -->
<div class="px-16">
	<!-- Hub Coordinator Bar (only shows for hub coordinators) -->
	<HubCoordinatorBar {hubData} />

	<!-- Main Content with Session Navigation -->
	<SessionContent
		bind:currentSession={currentSession}
		availableSessions={availableSessions}
		courseData={courseData}
		courseSlug={courseSlug}
		materials={materials}
		currentSessionData={currentSessionData}
		onSessionChange={handleSessionChange}
		onOpenMaterial={openMaterial}
	/>

	<!-- Material Viewer Component -->
	<div class="pb-8">
		<div class="max-w-7xl mx-auto">
			<MaterialViewer
				bind:isVisible={showMaterialViewer}
				material={selectedMaterial}
				currentSession={currentSession}
				materialsBySession={materialsBySession}
				courseName={courseData.title || 'Course Materials'}
				onClose={closeMaterialViewer}
			/>
		</div>
	</div>

	<!-- Past Reflections Section -->
	<div class="pb-16">
		<div class="max-w-7xl mx-auto">
			<PastReflectionsSection reflections={pastReflections} onReadReflection={openReflectionModal} />
		</div>
	</div>

	<!-- Public Reflections Feed -->
	<div class="pb-16">
		<div class="max-w-7xl mx-auto">
			<PublicReflectionsFeed reflections={publicReflections} onReadReflection={openReflectionModal} />
		</div>
	</div>
</div>

	<!-- Reflection Reading Modal (no margin needed - it's a modal) -->
	<ReflectionModal
		bind:isVisible={showReflectionModal}
		reflection={selectedReflection}
		onClose={closeReflectionModal}
		onNavigate={navigateReflection}
	/>