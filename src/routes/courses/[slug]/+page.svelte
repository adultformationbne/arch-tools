<script>
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import HubCoordinatorBar from './HubCoordinatorBar.svelte';
	import SessionContent from './SessionContent.svelte';
	import PastReflectionsSection from './PastReflectionsSection.svelte';
	import PublicReflectionsFeed from './PublicReflectionsFeed.svelte';
	import ReflectionModal from './ReflectionModal.svelte';
	import { isComplete, normalizeStatus } from '$lib/utils/reflection-status';

	let { data } = $props();

	// Extract data from server load using $derived for reactivity
	const materialsBySession = $derived(data.materialsBySession);
	const pastReflections = $derived(data.pastReflections);
	const publicReflections = $derived(data.publicReflections);
	const sessionsByNumber = $derived(data.sessionsByNumber);
	const courseSlug = $derived(data.courseSlug);
	const hubData = $derived(data.hubData);
	const totalSessions = $derived(data.totalSessions);
	const maxSessionNumber = $derived(data.maxSessionNumber);
	const featureSettings = $derived(data.featureSettings);
	const quizzesBySession = $derived(data.quizzesBySession ?? {});

	// Track page view
	onMount(async () => {
		try {
			const response = await fetch(`/api/courses/${courseSlug}/track-view`, {
				method: 'POST'
			});

			// track-view call intentionally fire-and-forget
		} catch (err) {
			console.error('Failed to track page view:', err);
		}

		// Re-fetch session data when returning to tab (e.g. after qualitative quiz gets marked)
		let lastInvalidate = 0;
		const handleVisibility = () => {
			if (document.visibilityState === 'visible') {
				const now = Date.now();
				if (now - lastInvalidate > 60_000) {
					lastInvalidate = now;
					invalidateAll();
				}
			}
		};
		document.addEventListener('visibilitychange', handleVisibility);
		return () => document.removeEventListener('visibilitychange', handleVisibility);
	});

	// Svelte 5 state with runes
	let currentSession = $state(1);
	// Available sessions is calculated server-side based on role and coordinator access settings
	// - Students: only up to their current_session
	// - Coordinators: based on course settings (all or N sessions ahead)
	// - Admins: all sessions
	let availableSessions = $state([]);
	let showReflectionModal = $state(false);
	let selectedReflection = $state(null);

	// Real data from database
	let courseData = $state(null);

	// Initialize state from server data
	$effect(() => {
		if (data.currentSession !== undefined) currentSession = data.currentSession;
		if (data.availableSessions) availableSessions = data.availableSessions;
		if (data.courseData) courseData = data.courseData;
	});

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

		const nextNum = sessionNum + 1;
		const nextSessionMaterials = nextNum <= maxSessionNumber
			? (materialsBySession[nextNum] || []).filter(m => m.available_early)
			: [];

		courseData = {
			...courseData,
			currentSessionData: {
				sessionNumber: sessionNum,
				sessionTitle: sessionInfo?.title || `Session ${sessionNum}`,
				sessionOverview: sessionInfo?.description || `Session ${sessionNum} content and materials`,
				materials: sessionMaterials,
				nextSessionMaterials,
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

	// Derived values (with null safety)
	const currentSessionData = $derived(courseData?.currentSessionData ?? null);
	const materials = $derived(currentSessionData?.materials ?? []);
</script>

<!-- Single content wrapper with consistent margins -->
{#if courseData && currentSessionData}
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
		{quizzesBySession}
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
{/if}

<!-- Reflection Reading Modal (no margin needed - it's a modal) -->
<ReflectionModal
	bind:isVisible={showReflectionModal}
	reflection={selectedReflection}
	onClose={closeReflectionModal}
	onNavigate={navigateReflection}
/>

