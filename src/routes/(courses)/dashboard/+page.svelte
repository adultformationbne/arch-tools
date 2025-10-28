<script>
	import HubCoordinatorBar from '../HubCoordinatorBar.svelte';
	import SessionContent from '../SessionContent.svelte';
	import ReflectionWriter from '../ReflectionWriter.svelte';
	import MaterialViewer from '../MaterialViewer.svelte';
	import PastReflectionsSection from '../PastReflectionsSection.svelte';
	import PublicReflectionsFeed from '../PublicReflectionsFeed.svelte';
	import ReflectionModal from '../ReflectionModal.svelte';

	let { data } = $props();

	// Extract data from server load
	const { materialsBySession, currentSession: initialSession, courseData: initialCourseData, pastReflections, publicReflections, sessionsByNumber } = data;

	// Svelte 5 state with runes
	let currentSession = $state(initialSession);
	let availableSessions = $state(8); // Student can access sessions 1-8
	let showReflectionWriter = $state(false);
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
		const sessionQuestion = data.questionsBySession[sessionNum] || { id: null, text: 'Reflect on this session\'s materials and their impact on your faith journey.' };
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

	const openReflectionWriter = () => {
		showReflectionWriter = true;
	};

	const closeReflectionWriter = () => {
		showReflectionWriter = false;
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
	<HubCoordinatorBar />

	<!-- Main Content with Session Navigation -->
	<SessionContent
		bind:currentSession={currentSession}
		availableSessions={availableSessions}
		courseData={courseData}
		materials={materials}
		currentSessionData={currentSessionData}
		onSessionChange={handleSessionChange}
		onOpenReflectionWriter={openReflectionWriter}
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
				onClose={closeMaterialViewer}
			/>
		</div>
	</div>

	<!-- Reflection Writer Component -->
	<div class="pb-8">
		<div class="max-w-7xl mx-auto">
			<ReflectionWriter
				bind:isVisible={showReflectionWriter}
				questionId={currentSessionData.reflectionQuestion?.id}
				question={currentSessionData.reflectionQuestion?.text || currentSessionData.reflectionQuestion}
				onClose={closeReflectionWriter}
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