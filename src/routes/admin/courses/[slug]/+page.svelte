<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { getContext } from 'svelte';
	import { AlertTriangle, Home, Loader2, Search, Mail, ArrowRight, Trash2, MapPin, Send, MailCheck, UserMinus, Users, Plus } from '$lib/icons';

	// Get modal opener from layout context
	const openCohortWizard = getContext('openCohortWizard');
	import CohortAdminSidebar from '$lib/components/CohortAdminSidebar.svelte';
	import CohortSettingsModal from '$lib/components/CohortSettingsModal.svelte';
	import ParticipantEnrollmentModal from '$lib/components/ParticipantEnrollmentModal.svelte';
	import ParticipantDetailModal from '$lib/components/ParticipantDetailModal.svelte';
	import StudentAdvancementModal from '$lib/components/StudentAdvancementModal.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import EmailSenderModal from '$lib/components/EmailSenderModal.svelte';
	import {
		getUserReflectionStatus,
		formatUserReflectionStatus,
		fetchReflectionsByCohort
	} from '$lib/utils/reflection-status.js';
	import { toastError, toastSuccess, toastWarning } from '$lib/utils/toast-helpers.js';

	let { data } = $props();

	const courseSlug = data.courseSlug;
	let modules = $derived(data.modules || []);
	let cohorts = $derived(data.cohorts || []);

	// Modal state
	let showCohortSettings = $state(false);
	let showStudentEnrollment = $state(false);
	let showAdvancementModal = $state(false);
	let advancementInitialIds = $state([]);
	let showDeleteConfirm = $state(false);
	let deleteLoading = $state(false);
	let deleteLoadingMessage = $state('');
	let showEmailModal = $state(false);
	let showHubAssignModal = $state(false);
	let showParticipantDetail = $state(false);
	let selectedParticipantForDetail = $state(null);
	let emailRecipients = $state([]);
	let initialTemplateSlug = $state('');
	let selectedHubId = $state('');

	// Participants state
	let participants = $state([]);
	let hubs = $state([]);
	let loadingParticipants = $state(false);
	let selectedParticipants = $state(new Set());
	let searchQuery = $state('');
	let filterHub = $state('all');
	let reflectionsByUser = $state(new Map());
	let sessionsWithQuestions = $state([]);

	// Get selected cohort from URL params
	const selectedCohortId = $derived($page.url.searchParams.get('cohort'));
	const selectedCohort = $derived(cohorts.find(c => c.id === selectedCohortId));

	// Calculate stats for sidebar
	const stats = $derived({
		participantCount: participants.length,
		avgAttendance: participants.length > 0
			? Math.round(participants.reduce((sum, s) => sum + (s.attendanceCount || 0), 0) / participants.length / (selectedCohort?.current_session || 1) * 100)
			: 0,
		pendingReflections: participants.reduce((sum, s) => {
			if (!s.reflectionStatus) return sum;
			return sum + (s.reflectionStatus.status === 'submitted' ? s.reflectionStatus.count : 0);
		}, 0)
	});

	// Recent activity
	let recentActivity = $state([]);

	// Filtered participants
	const filteredParticipants = $derived(
		participants.filter(s => {
			const query = searchQuery.toLowerCase();
			const matchesSearch = !searchQuery ||
				s.full_name?.toLowerCase().includes(query) ||
				s.email?.toLowerCase().includes(query) ||
				s.user_profile?.phone?.toLowerCase().includes(query);
			const matchesHub = filterHub === 'all' || s.hub_id === filterHub;
			return matchesSearch && matchesHub;
		})
	);

	// Participants who can be advanced
	const participantsBehind = $derived(
		selectedCohort?.current_session > 0
			? Array.from(selectedParticipants)
					.map(id => participants.find(s => s.id === id))
					.filter(s => s && s.current_session < selectedCohort.current_session)
			: []
	);

	// Load participants when cohort changes
	$effect(() => {
		if (selectedCohortId) {
			loadParticipants();
			loadHubs();
		} else {
			participants = [];
		}
	});

	async function loadParticipants() {
		if (!selectedCohortId) return;

		// Use local lookup to avoid $derived reactivity issues
		const currentCohort = cohorts.find(c => c.id === selectedCohortId);
		if (!currentCohort) return;

		loadingParticipants = true;
		try {
			// Get module ID for fetching sessions with questions
			const moduleId = currentCohort.module?.id || currentCohort.module_id;

			const [enrollmentResponse, attendanceResponse, reflectionsData, sessionsResponse, activityResponse] = await Promise.all([
				fetch(`/admin/courses/${courseSlug}/api?endpoint=courses_enrollments&cohort_id=${selectedCohortId}`).then(r => r.json()),
				fetch(`/admin/courses/${courseSlug}/api?endpoint=attendance&cohort_id=${selectedCohortId}`).then(r => r.json()),
				fetchReflectionsByCohort(selectedCohortId, courseSlug),
				moduleId
					? fetch(`/admin/courses/${courseSlug}/api?endpoint=sessions_with_questions&module_id=${moduleId}`).then(r => r.json())
					: Promise.resolve({ success: true, data: [] }),
				fetch(`/admin/courses/${courseSlug}/api?endpoint=recent_activity&cohort_id=${selectedCohortId}`).then(r => r.json())
			]);

			// Update activity
			recentActivity = activityResponse.success ? activityResponse.data : [];

			reflectionsByUser = reflectionsData;
			sessionsWithQuestions = sessionsResponse.success ? sessionsResponse.data : [];

			// Create attendance map
			const attendanceMap = new Map();
			if (attendanceResponse.success && attendanceResponse.data) {
				attendanceResponse.data.forEach(record => {
					if (record.present) {
						const count = attendanceMap.get(record.enrollment_id) || 0;
						attendanceMap.set(record.enrollment_id, count + 1);
					}
				});
			}

			participants = (enrollmentResponse.success ? enrollmentResponse.data : []).map(user => {
				const userReflections = reflectionsByUser.get(user.user_profile_id) || [];
				const reflectionStatus = getUserReflectionStatus(userReflections, user.current_session, sessionsWithQuestions);

				return {
					...user,
					attendanceCount: attendanceMap.get(user.id) || 0,
					reflectionStatus,
					isBehind: currentCohort && user.current_session < currentCohort.current_session
				};
			});
		} catch (err) {
			console.error('Failed to load participants:', err);
			participants = [];
		} finally {
			loadingParticipants = false;
		}
	}

	async function loadHubs() {
		if (!selectedCohortId) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api?endpoint=hubs&cohort_id=${selectedCohortId}`);
			const result = await response.json();
			hubs = result.success ? result.data : [];
		} catch (err) {
			console.error('Failed to load hubs:', err);
			hubs = [];
		}
	}

	function toggleSelectAll() {
		if (selectedParticipants.size === participants.length) {
			selectedParticipants = new Set();
		} else {
			selectedParticipants = new Set(participants.map(s => s.id));
		}
	}

	function toggleSelectParticipant(id) {
		if (selectedParticipants.has(id)) {
			selectedParticipants.delete(id);
		} else {
			selectedParticipants.add(id);
		}
		selectedParticipants = new Set(selectedParticipants);
	}

	// Sidebar actions
	function handleAdvanceSession() {
		// Pass any selected students to the modal
		advancementInitialIds = Array.from(selectedParticipants);
		showAdvancementModal = true;
	}

	function handleEmailAll() {
		emailRecipients = participants;
		initialTemplateSlug = '';
		showEmailModal = true;
	}

	function handleExport() {
		toastWarning('Export feature coming soon');
	}

	function handleAddParticipant() {
		showStudentEnrollment = true;
	}

	function handleCohortSettings() {
		showCohortSettings = true;
	}

	async function handleCohortUpdate() {
		await invalidateAll();
		await loadParticipants();
	}

	async function handleCohortDelete() {
		await invalidateAll();
		// Navigate to dashboard without cohort selected
		goto(`/admin/courses/${courseSlug}`);
	}

	// Bulk actions
	function handleEmailSelected() {
		emailRecipients = participants.filter(p => selectedParticipants.has(p.id));
		initialTemplateSlug = '';
		showEmailModal = true;
	}

	function handleAdvanceSelected() {
		if (participantsBehind.length === 0) {
			toastWarning('Selected participants are already at current session');
			return;
		}
		// Pre-select the participants that are behind
		advancementInitialIds = Array.from(selectedParticipants);
		showAdvancementModal = true;
	}

	function handleAssignHub() {
		if (selectedParticipants.size === 0) {
			toastWarning('No participants selected');
			return;
		}
		selectedHubId = '';
		showHubAssignModal = true;
	}

	async function handleBulkHubAssignment() {
		if (selectedParticipants.size === 0) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'bulk_assign_hub',
					enrollmentIds: Array.from(selectedParticipants),
					hubId: selectedHubId || null
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to assign hub');
			}

			toastSuccess(result.message);
			showHubAssignModal = false;
			selectedParticipants = new Set();
			await loadParticipants();
		} catch (err) {
			console.error('Error assigning hub:', err);
			toastError(err.message || 'Failed to assign hub');
		}
	}

	function handleRemoveSelected() {
		if (selectedParticipants.size === 0) return;
		showDeleteConfirm = true;
	}

	async function confirmRemoveEnrollment() {
		deleteLoading = true;
		deleteLoadingMessage = 'Removing enrollments...';

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'bulk_delete_enrollments',
					enrollmentIds: Array.from(selectedParticipants),
					forceDelete: true
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to remove participants');
			}

			toastSuccess(result.message);
			selectedParticipants = new Set();
			await loadParticipants();
		} catch (err) {
			console.error('Error removing participants:', err);
			toastError(err.message || 'Failed to remove participants');
		} finally {
			deleteLoading = false;
			showDeleteConfirm = false;
		}
	}

	async function confirmDeleteAccounts() {
		deleteLoading = true;
		deleteLoadingMessage = 'Deleting accounts...';

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_user_accounts',
					enrollmentIds: Array.from(selectedParticipants)
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to delete accounts');
			}

			toastSuccess(result.message);
			selectedParticipants = new Set();
			await loadParticipants();
		} catch (err) {
			console.error('Error deleting accounts:', err);
			toastError(err.message || 'Failed to delete accounts');
		} finally {
			deleteLoading = false;
			showDeleteConfirm = false;
		}
	}

	function handleSendWelcome() {
		if (selectedParticipants.size === 0) return;

		// Get selected participants who haven't received welcome email
		const pendingParticipants = participants.filter(
			p => selectedParticipants.has(p.id) && !p.welcome_email_sent_at
		);

		if (pendingParticipants.length === 0) {
			toastWarning('All selected participants have already received welcome emails');
			return;
		}

		// Open email modal with welcome template pre-selected
		emailRecipients = pendingParticipants;
		initialTemplateSlug = 'welcome_enrolled';
		showEmailModal = true;
	}

	function handleResendWelcome() {
		if (selectedParticipants.size === 0) return;

		// Get selected participants who HAVE already received welcome email
		const alreadySentParticipants = participants.filter(
			p => selectedParticipants.has(p.id) && p.welcome_email_sent_at
		);

		if (alreadySentParticipants.length === 0) {
			toastWarning('None of the selected participants have received welcome emails yet. Use "Welcome" instead.');
			return;
		}

		// Open email modal with welcome template pre-selected
		emailRecipients = alreadySentParticipants;
		initialTemplateSlug = 'welcome_enrolled';
		showEmailModal = true;
	}

	// Modal handlers
	async function handleEnrollmentComplete() {
		showStudentEnrollment = false;
		await invalidateAll();
		await loadParticipants();
	}

	async function handleAdvancementComplete() {
		showAdvancementModal = false;
		selectedParticipants = new Set(); // Clear selection after advancement
		advancementInitialIds = [];
		await loadParticipants();
		await invalidateAll();
	}

	function getReflectionStatusDisplay(participant) {
		if (!participant.reflectionStatus) return '';
		return formatUserReflectionStatus(participant.reflectionStatus.status, participant.reflectionStatus.count);
	}

	// Participant detail modal handlers
	function openParticipantDetail(participant) {
		selectedParticipantForDetail = participant;
		showParticipantDetail = true;
	}

	function handleParticipantDetailUpdate() {
		loadParticipants();
	}

	function handleParticipantDetailEmail(participant) {
		showParticipantDetail = false;
		emailRecipients = [participant];
		initialTemplateSlug = '';
		showEmailModal = true;
	}

	// Status badge styling
	function getStatusBadge(participant) {
		if (!participant.welcome_email_sent_at) {
			return { label: 'Not Invited', class: 'bg-gray-100 text-gray-600' };
		}
		if (!participant.last_login_at) {
			return { label: 'Invited', class: 'bg-blue-100 text-blue-700' };
		}
		if (participant.status === 'held') {
			return { label: 'On Hold', class: 'bg-orange-100 text-orange-700' };
		}
		if (participant.status === 'withdrawn') {
			return { label: 'Withdrawn', class: 'bg-red-100 text-red-700' };
		}
		if (participant.status === 'completed') {
			return { label: 'Completed', class: 'bg-purple-100 text-purple-700' };
		}
		return { label: 'Active', class: 'bg-green-100 text-green-700' };
	}

</script>

<div class="flex h-screen" style="background-color: var(--course-accent-dark);">
	<!-- Left Sidebar - Compact width -->
	<div class="w-48 border-r flex-shrink-0" style="border-color: rgba(255,255,255,0.1);">
		<CohortAdminSidebar
			cohort={selectedCohort}
			{stats}
			{recentActivity}
			onAdvanceSession={handleAdvanceSession}
			onEmailAll={handleEmailAll}
			onExport={handleExport}
			onAddParticipant={handleAddParticipant}
			onCohortSettings={handleCohortSettings}
		/>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 overflow-y-auto" style="background-color: var(--course-accent-dark);">
		{#if cohorts.length === 0}
			<!-- No cohorts exist yet -->
			<div class="flex items-center justify-center h-full p-8">
				<div class="text-center max-w-md">
					<div class="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
						<Users size={40} class="text-white/60" />
					</div>
					<h2 class="text-2xl font-bold text-white mb-3">Create Your First Cohort</h2>
					<p class="text-white/70 mb-8">
						Cohorts are groups of participants taking your course together. Create one to start enrolling participants.
					</p>
					<button
						onclick={openCohortWizard}
						class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
						style="background-color: var(--course-accent-light); color: white;"
					>
						<Plus size={20} />
						Create a Cohort
					</button>
				</div>
			</div>
		{:else if !selectedCohort}
			<!-- Cohorts exist but none selected -->
			<div class="flex items-center justify-center h-full">
				<div class="text-center">
					<h2 class="text-xl font-bold text-white mb-2">Select a Cohort</h2>
					<p class="text-sm text-white/70">Choose a cohort from the sidebar to view details and manage participants.</p>
				</div>
			</div>
		{:else}
			<div class="p-4 lg:p-6">
				<!-- Page Header + Search inline -->
				<div class="flex items-center justify-between gap-4 mb-3">
					<h1 class="text-xl font-bold text-white">Participants</h1>
					<div class="flex items-center gap-2 flex-1 max-w-md">
						<div class="flex-1 relative">
							<Search size={16} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search..."
								class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
							/>
						</div>
						<select
							bind:value={filterHub}
							class="px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
						>
							<option value="all">All Hubs</option>
							{#each hubs as hub}
								<option value={hub.id}>{hub.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Compact Bulk Action Bar (shows when participants selected) -->
				{#if selectedParticipants.size > 0}
					<div class="rounded px-3 py-2 mb-3 flex items-center justify-between flex-wrap gap-2" style="background-color: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
						<div class="flex items-center gap-2 flex-wrap">
							<span class="text-xs font-medium text-white">
								{selectedParticipants.size} selected
							</span>
							<button
								onclick={handleSendWelcome}
								class="px-2 py-1 rounded text-xs font-medium text-emerald-300 hover:bg-white/10 flex items-center gap-1.5 transition-colors"
							>
								<Send size={12} />
								Welcome
							</button>
							<button
								onclick={handleResendWelcome}
								class="px-2 py-1 rounded text-xs font-medium text-amber-300 hover:bg-white/10 flex items-center gap-1.5 transition-colors"
							>
								<MailCheck size={12} />
								Resend
							</button>
							<button
								onclick={handleEmailSelected}
								class="px-2 py-1 rounded text-xs font-medium text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors"
							>
								<Mail size={12} />
								Email
							</button>
							{#if participantsBehind.length > 0}
								<button
									onclick={handleAdvanceSelected}
									class="px-2 py-1 rounded text-xs font-medium text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors"
								>
									<ArrowRight size={12} />
									Advance ({participantsBehind.length})
								</button>
							{/if}
							<button
								onclick={handleAssignHub}
								class="px-2 py-1 rounded text-xs font-medium text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors"
							>
								<MapPin size={12} />
								Hub
							</button>
							<button
								onclick={handleRemoveSelected}
								class="px-2 py-1 rounded text-xs font-medium text-red-400 hover:bg-white/10 flex items-center gap-1.5 transition-colors"
							>
								<Trash2 size={12} />
								Remove
							</button>
						</div>
						<button
							onclick={() => selectedParticipants = new Set()}
							class="text-xs text-white/70 hover:bg-white/10 px-2 py-1 rounded transition-colors"
						>
							Clear
						</button>
					</div>
				{/if}

				<!-- Participants Table -->
				{#if loadingParticipants}
					<div class="flex items-center justify-center py-8">
						<Loader2 size={24} class="animate-spin text-white/40" />
						<span class="ml-2 text-sm text-white/70">Loading...</span>
					</div>
				{:else if filteredParticipants.length === 0}
					<div class="bg-white rounded border border-gray-200 p-8 text-center">
						<p class="text-sm text-gray-500">
							{participants.length === 0 ? 'No participants enrolled yet.' : 'No participants match your search.'}
						</p>
					</div>
				{:else}
					<div class="bg-white rounded border border-gray-200 overflow-x-auto">
						<table class="w-full min-w-[900px]">
							<thead>
								<tr class="border-b border-gray-200 bg-gray-100">
									<th class="w-8 px-3 py-2.5">
										<input
											type="checkbox"
											onchange={toggleSelectAll}
											checked={selectedParticipants.size > 0 && selectedParticipants.size === participants.length}
											class="rounded border-gray-300 w-3.5 h-3.5"
										/>
									</th>
									<th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600">Participant</th>
									<th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600">Phone</th>
									<th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600">Hub</th>
									<th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600">Status</th>
									<th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600">Session</th>
									<th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600">Attendance</th>
									<th class="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600">Reflections</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each filteredParticipants as participant}
									{@const totalSessions = selectedCohort.module?.total_sessions || 8}
									{@const cohortSession = selectedCohort.current_session || 0}
									{@const statusBadge = getStatusBadge(participant)}
									<tr
										onclick={() => openParticipantDetail(participant)}
										class="hover:bg-gray-50 transition-colors cursor-pointer"
									>
										<td class="px-3 py-2" onclick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedParticipants.has(participant.id)}
												onchange={() => toggleSelectParticipant(participant.id)}
												class="rounded border-gray-300 w-3.5 h-3.5"
											/>
										</td>
										<!-- Participant: Name • email + Coordinator badge -->
										<td class="px-3 py-2">
											<div class="flex items-center gap-1.5">
												<span class="text-sm font-medium text-gray-900">
													{participant.full_name}
												</span>
												{#if participant.role === 'coordinator'}
													<span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">
														<Home size={9} />
														Hub Coordinator
													</span>
												{/if}
												{#if participant.isBehind}
													<AlertTriangle size={12} class="text-orange-500" />
												{/if}
											</div>
											<span class="text-xs text-gray-500">{participant.email}</span>
										</td>
										<!-- Phone -->
										<td class="px-3 py-2">
											<span class="text-xs text-gray-600">{participant.user_profile?.phone || '-'}</span>
										</td>
										<!-- Hub -->
										<td class="px-3 py-2">
											<span class="text-xs text-gray-600">{participant.courses_hubs?.name || '-'}</span>
										</td>
										<!-- Status badge -->
										<td class="px-3 py-2">
											<span class="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full {statusBadge.class}">
												{statusBadge.label}
											</span>
										</td>
										<!-- Session progress -->
										<td class="px-3 py-2">
											<span class="text-xs tabular-nums text-gray-700">
												{participant.current_session}/{totalSessions}
											</span>
										</td>
										<!-- Attendance -->
										<td class="px-3 py-2">
											<span class="text-xs tabular-nums text-gray-700">
												{#if cohortSession > 0}
													{participant.attendanceCount}/{cohortSession}
												{:else}
													-
												{/if}
											</span>
										</td>
										<!-- Reflections -->
										<td class="px-3 py-2">
											{#if participant.reflectionStatus && participant.current_session > 0}
												<span class="text-xs tabular-nums text-gray-700">
													{getReflectionStatusDisplay(participant)}
												</span>
											{:else}
												<span class="text-xs text-gray-400">-</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination info -->
					<div class="mt-2 text-xs text-white/70 text-center">
						{filteredParticipants.length} of {participants.length} participants
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Modals -->
<CohortSettingsModal
	show={showCohortSettings}
	cohort={selectedCohort}
	{courseSlug}
	onClose={() => showCohortSettings = false}
	onUpdate={handleCohortUpdate}
	onDelete={handleCohortDelete}
/>

<ParticipantEnrollmentModal
	{courseSlug}
	cohort={selectedCohort}
	show={showStudentEnrollment}
	onClose={() => showStudentEnrollment = false}
	onComplete={handleEnrollmentComplete}
/>

<StudentAdvancementModal
	{courseSlug}
	cohort={selectedCohort}
	students={participants}
	initialSelectedIds={advancementInitialIds}
	bind:show={showAdvancementModal}
	onComplete={handleAdvancementComplete}
/>

<ConfirmationModal
	show={showDeleteConfirm}
	title="Remove Participants"
	loading={deleteLoading}
	loadingMessage={deleteLoadingMessage}
	onCancel={() => showDeleteConfirm = false}
	actions={[
		{
			label: 'Remove from this cohort',
			description: 'Removes the enrollment from this cohort only. Their user account remains active and they can be re-enrolled later.',
			icon: UserMinus,
			variant: 'secondary',
			onClick: confirmRemoveEnrollment
		},
		{
			label: 'Permanently delete account',
			description: 'Completely removes their user account, all enrollments, and associated data. This cannot be undone.',
			icon: Trash2,
			variant: 'danger',
			onClick: confirmDeleteAccounts
		}
	]}
>
	<p>You are about to remove <strong>{selectedParticipants.size} participant(s)</strong>.</p>
	<p class="text-sm text-white/70">Choose an action:</p>
</ConfirmationModal>

<EmailSenderModal
	show={showEmailModal}
	{courseSlug}
	course={data.courseInfo}
	recipients={emailRecipients}
	cohortId={selectedCohort?.id}
	currentUserEmail={data.currentUserEmail}
	{initialTemplateSlug}
	onClose={() => {
		showEmailModal = false;
		initialTemplateSlug = '';
	}}
	onSent={async () => {
		selectedParticipants = new Set();
		await loadParticipants();
	}}
/>

<ParticipantDetailModal
	show={showParticipantDetail}
	participant={selectedParticipantForDetail}
	{courseSlug}
	cohort={selectedCohort}
	{hubs}
	totalSessions={selectedCohort?.module?.total_sessions || 8}
	onClose={() => {
		showParticipantDetail = false;
		selectedParticipantForDetail = null;
	}}
	onUpdate={handleParticipantDetailUpdate}
	onEmail={handleParticipantDetailEmail}
/>

<!-- Hub Assignment Modal -->
{#if showHubAssignModal}
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
	<div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
		<h3 class="text-lg font-bold text-gray-900 mb-4">Assign to Hub</h3>
		<p class="text-sm text-gray-600 mb-4">
			Assign {selectedParticipants.size} selected participant(s) to a hub.
		</p>

		<select
			bind:value={selectedHubId}
			class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
		>
			<option value="">No hub (remove from hub)</option>
			{#each hubs as hub}
				<option value={hub.id}>{hub.name}</option>
			{/each}
		</select>

		{#if hubs.length === 0}
			<p class="text-sm text-amber-600 mb-4">
				No hubs available. Create hubs in the Hubs page first.
			</p>
		{/if}

		<div class="flex justify-end gap-3">
			<button
				onclick={() => showHubAssignModal = false}
				class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				onclick={handleBulkHubAssignment}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
			>
				Assign
			</button>
		</div>
	</div>
</div>
{/if}
