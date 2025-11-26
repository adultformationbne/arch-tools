<script>
	import HubCoordinatorBar from './HubCoordinatorBar.svelte';
	import SessionContent from './SessionContent.svelte';
	import PastReflectionsSection from './PastReflectionsSection.svelte';
	import PublicReflectionsFeed from './PublicReflectionsFeed.svelte';
	import ReflectionModal from './ReflectionModal.svelte';

	let { data } = $props();

	// Extract data from server load
	const { materialsBySession, currentSession: initialSession, courseData: initialCourseData, pastReflections, publicReflections, sessionsByNumber, courseSlug, hubData, totalSessions, maxSessionNumber } = data;

	// Svelte 5 state with runes
	let currentSession = $state(initialSession);
	// Students can only access sessions up to their current_session
	// If current_session is 0 (not started), they can't access any sessions
	let availableSessions = $state(initialSession);
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

		// Calculate reflection status for this session
		let reflectionStatus = null;
		if (sessionQuestion) {
			// Find if user has a response for this session
			const existingResponse = pastReflections.find(r => r.session === sessionNum);
			if (!existingResponse) {
				reflectionStatus = 'not_started';
			} else {
				// Map pastReflections status (which uses 'graded' for passed) to display status
				const status = existingResponse.status;
				if (status === 'graded' || status === 'passed') {
					reflectionStatus = 'completed';
				} else if (status === 'needs_revision') {
					reflectionStatus = 'needs_revision';
				} else {
					// submitted, under_review, etc. -> in_progress
					reflectionStatus = 'in_progress';
				}
			}
		}

		courseData = {
			...courseData,
			currentSessionData: {
				sessionNumber: sessionNum,
				sessionTitle: sessionInfo?.title || `Session ${sessionNum}`,
				sessionOverview: sessionInfo?.description || `Session ${sessionNum} content and materials`,
				materials: sessionMaterials,
				reflectionQuestion: sessionQuestion,
				reflectionStatus
			}
		};
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
		totalSessions={totalSessions}
		maxSessionNumber={maxSessionNumber}
	/>

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