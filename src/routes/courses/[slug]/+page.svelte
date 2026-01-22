<script>
	import HubCoordinatorBar from './HubCoordinatorBar.svelte';
	import SessionContent from './SessionContent.svelte';
	import PastReflectionsSection from './PastReflectionsSection.svelte';
	import PublicReflectionsFeed from './PublicReflectionsFeed.svelte';
	import ReflectionModal from './ReflectionModal.svelte';
	import { isComplete, normalizeStatus } from '$lib/utils/reflection-status';

	let { data } = $props();

	// Extract data from server load
	const { materialsBySession, currentSession: initialSession, availableSessions: serverAvailableSessions, courseData: initialCourseData, pastReflections, publicReflections, sessionsByNumber, courseSlug, hubData, totalSessions, maxSessionNumber, featureSettings } = data;

	// Svelte 5 state with runes
	let currentSession = $state(initialSession);
	// Available sessions is calculated server-side based on role and coordinator access settings
	// - Students: only up to their current_session
	// - Coordinators: based on course settings (all or N sessions ahead)
	// - Admins: all sessions
	let availableSessions = $state(serverAvailableSessions);
	let showReflectionModal = $state(false);
	let selectedReflection = $state(null);

	// Real data from database
	let courseData = $state(initialCourseData);

	const handleSessionChange = (sessionNum) => {
		currentSession = sessionNum;

		// Update course data for the selected session
		const sessionMaterials = materialsBySession[sessionNum] || [];
		const sessionQuestion = data.questionsBySession[sessionNum] || null;
		const sessionInfo = sessionsByNumber[sessionNum];

		// Get raw database status for this session (utility handles display)
		let reflectionStatus = null;
		if (sessionQuestion) {
			// Find if user has a response for this session
			const existingResponse = pastReflections.find(r => r.session === sessionNum);
			if (!existingResponse) {
				reflectionStatus = 'not_started';
			} else {
				// Pass raw database status - SessionContent uses utility for display
				reflectionStatus = normalizeStatus(existingResponse.status);
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
	};

	// Derived values
	const currentSessionData = $derived(courseData.currentSessionData);
	const materials = $derived(currentSessionData.materials);
</script>

<!-- Single content wrapper with consistent margins -->
<div class="px-4 sm:px-8 lg:px-16" class:pt-6={!hubData}>
	<!-- Hub Coordinator Bar (only shows for hub coordinators) -->
	<HubCoordinatorBar {hubData} {courseSlug} />

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
		featureSettings={featureSettings}
	/>

	<!-- Past Reflections Section (only if reflections enabled) -->
	{#if featureSettings?.reflectionsEnabled !== false}
		<div class="pb-16">
			<div class="max-w-7xl mx-auto">
				<PastReflectionsSection reflections={pastReflections} onReadReflection={openReflectionModal} />
			</div>
		</div>
	{/if}

	<!-- Public Reflections Feed (only if community feed enabled) -->
	{#if featureSettings?.communityFeedEnabled !== false}
		<div class="pb-16">
			<div class="max-w-7xl mx-auto">
				<PublicReflectionsFeed reflections={publicReflections} />
			</div>
		</div>
	{/if}
</div>

	<!-- Reflection Reading Modal (no margin needed - it's a modal) -->
	<ReflectionModal
		bind:isVisible={showReflectionModal}
		reflection={selectedReflection}
		onClose={closeReflectionModal}
		onNavigate={navigateReflection}
	/>