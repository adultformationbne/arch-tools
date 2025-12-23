<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { Check, X, AlertTriangle, Home, Loader2, Search, Mail, ArrowRight, UserPlus, Trash2, MapPin, Send, MailCheck, MailX } from 'lucide-svelte';
	import CohortAdminSidebar from '$lib/components/CohortAdminSidebar.svelte';
	import CohortCreationWizard from '$lib/components/CohortCreationWizard.svelte';
	import ParticipantEnrollmentModal from '$lib/components/ParticipantEnrollmentModal.svelte';
	import StudentAdvancementModal from '$lib/components/StudentAdvancementModal.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import EmailSenderModal from '$lib/components/EmailSenderModal.svelte';
	import {
		getUserReflectionStatus,
		formatUserReflectionStatus,
		getStatusBadgeClass,
		fetchReflectionsByCohort
	} from '$lib/utils/reflection-status.js';
	import { toastError, toastSuccess, toastWarning } from '$lib/utils/toast-helpers.js';

	let { data } = $props();

	const courseSlug = data.courseSlug;
	let modules = $state(data.modules || []);
	let cohorts = $state(data.cohorts || []);

	// Modal state
	let showCohortWizard = $state(false);
	let showStudentEnrollment = $state(false);
	let showAdvancementModal = $state(false);
	let showDeleteConfirm = $state(false);
	let showEmailModal = $state(false);
	let showHubAssignModal = $state(false);
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
	let editingSession = $state(null);

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
			const matchesSearch = !searchQuery ||
				s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				s.email.toLowerCase().includes(searchQuery.toLowerCase());
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

	// Handle action param for new cohort wizard
	$effect(() => {
		const actionParam = $page.url.searchParams.get('action');
		if (actionParam === 'new-cohort') {
			showCohortWizard = true;
		}
	});

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
				const userReflections = reflectionsByUser.get(user.auth_user_id) || [];
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

	function startEditSession(participant) {
		editingSession = {
			id: participant.id,
			value: participant.current_session
		};
	}

	async function saveEditSession() {
		if (!editingSession) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_student_session',
					enrollmentId: editingSession.id,
					sessionNumber: editingSession.value
				})
			});

			if (response.ok) {
				toastSuccess('Session updated successfully');
				editingSession = null;
				await loadParticipants();
			} else {
				throw new Error('Failed to update session');
			}
		} catch (err) {
			console.error('Failed to update session:', err);
			toastError('Failed to update session');
		}
	}

	// Sidebar actions
	function handleAdvanceSession() {
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

	// Modal handlers
	async function handleWizardComplete(result) {
		showCohortWizard = false;
		await invalidateAll();

		// Navigate to the new cohort
		if (result?.cohortId) {
			goto(`/admin/courses/${courseSlug}?cohort=${result.cohortId}`);
		}
	}

	async function handleEnrollmentComplete() {
		showStudentEnrollment = false;
		await invalidateAll();
		await loadParticipants();
	}

	async function handleAdvancementComplete() {
		showAdvancementModal = false;
		await loadParticipants();
		await invalidateAll();
	}

	function getReflectionStatusDisplay(participant) {
		if (!participant.reflectionStatus) return '';
		return formatUserReflectionStatus(participant.reflectionStatus.status, participant.reflectionStatus.count);
	}
</script>

<div class="flex h-screen" style="background-color: var(--course-accent-dark);">
	<!-- Left Sidebar -->
	<div class="w-64 border-r flex-shrink-0" style="border-color: rgba(255,255,255,0.1);">
		<CohortAdminSidebar
			cohort={selectedCohort}
			{stats}
			{recentActivity}
			onAdvanceSession={handleAdvanceSession}
			onEmailAll={handleEmailAll}
			onExport={handleExport}
			onAddParticipant={handleAddParticipant}
		/>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 overflow-y-auto" style="background-color: var(--course-accent-dark);">
		{#if !selectedCohort}
			<div class="flex items-center justify-center h-full">
				<div class="text-center">
					<h2 class="text-2xl font-bold text-white mb-2">Select a Cohort</h2>
					<p class="text-white/70">Choose a cohort from the sidebar to view details and manage participants.</p>
				</div>
			</div>
		{:else}
			<div class="p-8">
				<!-- Page Header -->
				<div class="mb-6">
					<h1 class="text-3xl font-bold text-white">Participants</h1>
				</div>

				<!-- Bulk Action Bar (shows when participants selected) -->
				{#if selectedParticipants.size > 0}
					<div class="rounded-lg p-4 mb-4 flex items-center justify-between" style="background-color: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
						<div class="flex items-center gap-4">
							<span class="text-sm font-medium text-white">
								{selectedParticipants.size} selected
							</span>
							<button
								onclick={handleSendWelcome}
								class="px-3 py-1.5 rounded text-sm font-medium text-emerald-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
							>
								<Send size={14} />
								Send Welcome
							</button>
							<button
								onclick={handleEmailSelected}
								class="px-3 py-1.5 rounded text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
							>
								<Mail size={14} />
								Email
							</button>
							{#if participantsBehind.length > 0}
								<button
									onclick={handleAdvanceSelected}
									class="px-3 py-1.5 rounded text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
								>
									<ArrowRight size={14} />
									Advance ({participantsBehind.length})
								</button>
							{/if}
							<button
								onclick={handleAssignHub}
								class="px-3 py-1.5 rounded text-sm font-medium text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
							>
								<MapPin size={14} />
								Assign Hub
							</button>
							<button
								onclick={handleRemoveSelected}
								class="px-3 py-1.5 rounded text-sm font-medium text-red-400 hover:bg-white/10 flex items-center gap-2 transition-colors"
							>
								<Trash2 size={14} />
								Remove
							</button>
						</div>
						<button
							onclick={() => selectedParticipants = new Set()}
							class="text-sm text-white hover:bg-white/10 px-2 py-1 rounded transition-colors"
						>
							Clear selection
						</button>
					</div>
				{/if}

				<!-- Search and Filters -->
				<div class="flex gap-4 mb-4">
					<div class="flex-1 relative">
						<Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search participants..."
							class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
						/>
					</div>
					<select
						bind:value={filterHub}
						class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
					>
						<option value="all">All Hubs</option>
						{#each hubs as hub}
							<option value={hub.id}>{hub.name}</option>
						{/each}
					</select>
				</div>

				<!-- Participants Table -->
				{#if loadingParticipants}
					<div class="flex items-center justify-center py-12">
						<Loader2 size={32} class="animate-spin text-white/40" />
						<span class="ml-3 text-white/70">Loading participants...</span>
					</div>
				{:else if filteredParticipants.length === 0}
					<div class="bg-white rounded-lg border border-gray-200 p-12 text-center">
						<p class="text-gray-500">
							{participants.length === 0 ? 'No participants enrolled yet.' : 'No participants match your search.'}
						</p>
					</div>
				{:else}
					<div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
						<table class="w-full">
							<thead>
								<tr class="bg-gray-50 border-b border-gray-200">
									<th class="w-12 px-4 py-3">
										<input
											type="checkbox"
											onchange={toggleSelectAll}
											checked={selectedParticipants.size > 0 && selectedParticipants.size === participants.length}
											class="rounded border-gray-300"
										/>
									</th>
									<th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
									<th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
									<th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Session</th>
									<th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Hub</th>
									<th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Attendance</th>
									<th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Reflections</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200">
								{#each filteredParticipants as participant}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3">
											<input
												type="checkbox"
												checked={selectedParticipants.has(participant.id)}
												onchange={() => toggleSelectParticipant(participant.id)}
												class="rounded border-gray-300"
											/>
										</td>
										<td class="px-4 py-3">
											<div class="flex items-center gap-2">
												{#if participant.isBehind}
													<AlertTriangle size={16} class="text-orange-500" />
												{/if}
												<div>
													<div class="font-medium text-gray-900">{participant.full_name}</div>
													{#if participant.role === 'coordinator'}
														<div class="flex items-center gap-1 text-xs text-purple-600">
															<Home size={12} />
															<span>Hub Coordinator</span>
														</div>
													{/if}
												</div>
											</div>
										</td>
										<td class="px-4 py-3">
											{#if !participant.welcome_email_sent_at}
												<!-- Step 1: Needs invite -->
												<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
													<MailX size={12} />
													Needs invite
												</span>
											{:else if !participant.last_login_at}
												<!-- Step 2: Invited, awaiting signup -->
												<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700" title="Invited {new Date(participant.welcome_email_sent_at).toLocaleDateString()}">
													<Mail size={12} />
													Awaiting signup
												</span>
											{:else if participant.status === 'held'}
												<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">On Hold</span>
											{:else if participant.status === 'withdrawn'}
												<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">Withdrawn</span>
											{:else}
												<!-- Active user - no badge needed -->
												<span class="text-xs text-gray-400">—</span>
											{/if}
										</td>
										<td class="px-4 py-3">
											{#if editingSession && editingSession.id === participant.id}
												<div class="flex items-center gap-2">
													<input
														type="number"
														bind:value={editingSession.value}
														min="0"
														max={selectedCohort.module?.total_sessions || 8}
														class="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
													/>
													<button
														onclick={saveEditSession}
														class="p-1 text-green-600 hover:text-green-700"
													>
														<Check size={14} />
													</button>
													<button
														onclick={() => editingSession = null}
														class="p-1 text-gray-600 hover:text-gray-700"
													>
														<X size={14} />
													</button>
												</div>
											{:else}
												<button
													onclick={() => startEditSession(participant)}
													class="text-gray-900 hover:text-blue-600"
												>
													{participant.current_session}/{selectedCohort.module?.total_sessions || 8}
													{#if participant.isBehind}
														<AlertTriangle size={12} class="inline text-orange-500" />
													{/if}
												</button>
											{/if}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600">
											{participant.courses_hubs?.name || '-'}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600">
											{#if selectedCohort.current_session === 0}
												<span class="text-gray-400">—</span>
											{:else}
												{participant.attendanceCount}/{selectedCohort.current_session}
												<span class="text-xs text-gray-400 ml-1">
													({Math.round(participant.attendanceCount / selectedCohort.current_session * 100)}%)
												</span>
											{/if}
										</td>
										<td class="px-4 py-3">
											{#if participant.current_session === 0 || selectedCohort.current_session === 0}
												<span class="text-gray-400">—</span>
											{:else if participant.reflectionStatus}
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusBadgeClass(participant.reflectionStatus.status)}">
													{getReflectionStatusDisplay(participant)}
												</span>
											{:else}
												<span class="text-gray-400">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination info -->
					<div class="mt-4 text-sm text-white/70 text-center">
						Showing {filteredParticipants.length} of {participants.length} participants
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Modals -->
<CohortCreationWizard
	{courseSlug}
	{modules}
	show={showCohortWizard}
	onClose={() => showCohortWizard = false}
	onComplete={handleWizardComplete}
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
	bind:show={showAdvancementModal}
	onComplete={handleAdvancementComplete}
/>

<ConfirmationModal
	show={showDeleteConfirm}
	title="Remove Participants"
	confirmText="Remove"
	cancelText="Cancel"
	onConfirm={() => {
		toastWarning('Bulk delete coming soon');
		showDeleteConfirm = false;
	}}
	onCancel={() => showDeleteConfirm = false}
>
	<p>Are you sure you want to remove {selectedParticipants.size} participant(s)?</p>
	<p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
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
