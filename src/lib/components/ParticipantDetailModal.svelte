<script>
	import { X, Mail, Save, User, MapPin, Hash, Clock, Send, AlertTriangle, CheckCircle, XCircle, FileText, Calendar, ChevronDown, ChevronRight } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from './ConfirmationModal.svelte';

	let {
		show = false,
		participant = null,
		courseSlug,
		cohort = null,
		hubs = [],
		totalSessions = 8,
		showCohortHistory = true,
		courseFeatures = {},
		onClose = () => {},
		onUpdate = () => {},
		onEmail = () => {}
	} = $props();

	// Editable form state
	let formData = $state({
		full_name: '',
		email: '',
		status: 'active',
		role: 'student',
		hub_id: '',
		current_session: 0,
		phone: '',
		parish_community: '',
		parish_role: '',
		address: '',
		notes: ''
	});

	let isLoading = $state(false);
	let hasChanges = $state(false);
	let showUnsavedWarning = $state(false);

	// History data
	let attendanceHistory = $state([]);
	let reflectionHistory = $state([]);
	let loadingHistory = $state(false);
	let showAttendance = $state(true);
	let showReflections = $state(true);
	let otherCourses = $state([]);
	let showPlatformHistory = $state(true);

	// Normalize participant data from different sources
	const normalizedParticipant = $derived.by(() => {
		if (!participant) return null;

		// Handle cohort dashboard format (flat structure)
		if (participant.full_name !== undefined) {
			return {
				id: participant.id,
				full_name: participant.full_name,
				email: participant.email,
				status: participant.status || 'active',
				role: participant.role || 'student',
				hub_id: participant.hub_id || '',
				hub_name: participant.courses_hubs?.name || null,
				current_session: participant.current_session || 0,
				user_profile_id: participant.user_profile_id,
				welcome_email_sent_at: participant.welcome_email_sent_at,
				last_login_at: participant.last_login_at,
				login_count: participant.login_count || 0,
				last_viewed_at: participant.last_viewed_at,
				view_count: participant.view_count || 0,
				attendanceCount: participant.attendanceCount,
				reflectionStatus: participant.reflectionStatus,
				isBehind: participant.isBehind,
				cohort_id: participant.cohort_id,
				phone: participant.user_profile?.phone || '',
				parish_community: participant.user_profile?.parish_community || '',
				parish_role: participant.user_profile?.parish_role || '',
				address: participant.user_profile?.address || '',
				notes: participant.notes || ''
			};
		}

		// Handle participants page format (nested user_profile)
		return {
			id: participant.id,
			full_name: participant.user_profile?.full_name || 'Unknown',
			first_name: participant.user_profile?.first_name || '',
			last_name: participant.user_profile?.last_name || '',
			email: participant.user_profile?.email || '',
			phone: participant.user_profile?.phone || '',
			parish_community: participant.user_profile?.parish_community || '',
			parish_role: participant.user_profile?.parish_role || '',
			address: participant.user_profile?.address || '',
			status: participant.status || 'active',
			role: participant.role || 'student',
			hub_id: participant.hub_id || '',
			hub_name: participant.hub?.name || participant.courses_hubs?.name || null,
			current_session: participant.current_session || 0,
			user_profile_id: participant.user_profile_id,
			welcome_email_sent_at: participant.welcome_email_sent_at,
			last_login_at: participant.last_login_at,
			login_count: participant.login_count || 0,
			last_viewed_at: participant.last_viewed_at,
			view_count: participant.view_count || 0,
			attendanceCount: participant.attendanceCount,
			reflectionStatus: participant.reflectionStatus,
			isBehind: participant.isBehind,
			cohort_id: participant.cohort_id,
			all_cohorts: participant.all_cohorts,
			progress: participant.progress,
			notes: participant.notes || ''
		};
	});

	// Reset form when participant changes
	$effect(() => {
		if (participant && show) {
			const np = normalizedParticipant;
			if (np) {
				formData = {
					full_name: np.full_name,
					email: np.email,
					status: np.status,
					role: np.role,
					hub_id: np.hub_id || '',
					current_session: np.current_session,
					phone: np.phone || '',
					parish_community: np.parish_community || '',
					parish_role: np.parish_role || '',
					address: np.address || '',
					notes: np.notes || ''
				};
				hasChanges = false;
				// Load history data (only for cohort dashboard view)
				if (showCohortHistory) {
					loadParticipantHistory(np);
				}
			}
		}
	});

	// Fetch attendance and reflection history for participant
	async function loadParticipantHistory(np) {
		if (!np || !courseSlug) return;

		const cohortId = cohort?.id || np.cohort_id;
		if (!cohortId) return;

		loadingHistory = true;

		try {
			const fetches = [
				fetch(`/admin/courses/${courseSlug}/api/participant-history?type=attendance&enrollment_id=${np.id}&cohort_id=${cohortId}`),
				fetch(`/admin/courses/${courseSlug}/api/participant-history?type=reflections&enrollment_id=${np.id}&cohort_id=${cohortId}`)
			];
			if (np.user_profile_id) {
				fetches.push(fetch(`/admin/courses/${courseSlug}/api/participant-history?type=other_courses&user_profile_id=${np.user_profile_id}&enrollment_id=${np.id}`));
			}
			const [attendanceRes, reflectionsRes, otherCoursesRes] = await Promise.all(fetches);

			if (attendanceRes.ok) {
				const data = await attendanceRes.json();
				attendanceHistory = data.success ? data.data : [];
			}

			if (reflectionsRes.ok) {
				const data = await reflectionsRes.json();
				reflectionHistory = data.success ? data.data : [];
			}

			if (otherCoursesRes?.ok) {
				const data = await otherCoursesRes.json();
				otherCourses = data.success ? data.data : [];
			}
		} catch (err) {
			console.error('Error loading participant history:', err);
		} finally {
			loadingHistory = false;
		}
	}

	// Track changes
	function checkChanges() {
		const np = normalizedParticipant;
		if (!np) return;

		hasChanges =
			formData.full_name !== np.full_name ||
			formData.email !== np.email ||
			formData.status !== np.status ||
			formData.role !== np.role ||
			formData.hub_id !== (np.hub_id || '') ||
			formData.current_session !== np.current_session ||
			formData.phone !== (np.phone || '') ||
			formData.parish_community !== (np.parish_community || '') ||
			formData.parish_role !== (np.parish_role || '') ||
			formData.address !== (np.address || '') ||
			formData.notes !== (np.notes || '');
	}

	async function handleSave() {
		const np = normalizedParticipant;
		if (!np) return;

		isLoading = true;

		try {
			const updates = {};
			const profileUpdates = {};

			if (formData.full_name !== np.full_name) updates.full_name = formData.full_name;
			if (formData.email !== np.email) updates.email = formData.email;
			if (formData.status !== np.status) updates.status = formData.status;
			if (formData.role !== np.role) updates.role = formData.role;
			if (formData.hub_id !== (np.hub_id || '')) updates.hub_id = formData.hub_id || null;
			if (formData.current_session !== np.current_session) updates.current_session = formData.current_session;
			if (formData.notes !== (np.notes || '')) updates.notes = formData.notes;

			if (formData.phone !== (np.phone || '')) profileUpdates.phone = formData.phone;
			if (formData.parish_community !== (np.parish_community || '')) profileUpdates.parish_community = formData.parish_community;
			if (formData.parish_role !== (np.parish_role || '')) profileUpdates.parish_role = formData.parish_role;
			if (formData.address !== (np.address || '')) profileUpdates.address = formData.address;

			if (Object.keys(updates).length === 0 && Object.keys(profileUpdates).length === 0) {
				toastSuccess('No changes to save');
				return;
			}

			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_enrollment',
					userId: np.id,
					updates,
					profileUpdates
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to update participant');
			}

			toastSuccess('Participant updated successfully');
			hasChanges = false;
			onUpdate();
		} catch (err) {
			console.error('Error updating participant:', err);
			toastError(err.message || 'Failed to update participant');
		} finally {
			isLoading = false;
		}
	}

	function handleClose() {
		if (hasChanges) {
			showUnsavedWarning = true;
		} else {
			onClose();
		}
	}

	function confirmClose() {
		showUnsavedWarning = false;
		hasChanges = false;
		onClose();
	}

	function handleEmailClick() {
		const np = normalizedParticipant;
		if (np) {
			onEmail(np);
		}
	}

	function formatDate(dateString) {
		if (!dateString) return 'Never';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function formatRelativeTime(dateString) {
		if (!dateString) return 'Never signed in';
		const diffMs = Date.now() - new Date(dateString).getTime();
		const diffDays = Math.floor(diffMs / 86400000);
		if (diffDays === 0) return 'today';
		if (diffDays === 1) return 'yesterday';
		if (diffDays < 7) return `${diffDays} days ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
		if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
		return `${Math.floor(diffDays / 365)} years ago`;
	}

	function getStatusColor(status) {
		const colors = {
			active: 'bg-green-100 text-green-700',
			pending: 'bg-yellow-100 text-yellow-700',
			invited: 'bg-blue-100 text-blue-700',
			held: 'bg-orange-100 text-orange-700',
			withdrawn: 'bg-gray-100 text-gray-500',
			completed: 'bg-purple-100 text-purple-700'
		};
		return colors[status] || 'bg-gray-100 text-gray-700';
	}

	function getReflectionStatusBadge(status) {
		const badges = {
			draft: { label: 'Draft', class: 'bg-gray-100 text-gray-600' },
			submitted: { label: 'Submitted', class: 'bg-blue-100 text-blue-700' },
			passed: { label: 'Passed', class: 'bg-green-100 text-green-700' },
			needs_revision: { label: 'Needs Revision', class: 'bg-amber-100 text-amber-700' },
			resubmitted: { label: 'Resubmitted', class: 'bg-purple-100 text-purple-700' }
		};
		return badges[status] || { label: status, class: 'bg-gray-100 text-gray-600' };
	}

	function formatDateTime(dateString) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

{#if show && participant}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="presentation"
		tabindex="-1"
	>
		<div
			class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl flex flex-col"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-200 flex items-start justify-between" style="background-color: var(--course-surface, #f5f5f5);">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background-color: var(--course-accent-light, #e5e5e5);">
						<User size={24} style="color: var(--course-accent-darkest, #333);" />
					</div>
					<div>
						<h2 class="text-lg font-bold" style="color: var(--course-accent-darkest, #333);">
							{normalizedParticipant?.full_name || 'Participant'}
						</h2>
						<p class="text-sm text-gray-500">{normalizedParticipant?.email}</p>
					</div>
				</div>
				<button
					onclick={handleClose}
					class="p-2 rounded-lg hover:bg-white/50 transition-colors"
					aria-label="Close"
				>
					<X size={20} class="text-gray-500" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				<!-- Quick Stats -->
				{#if normalizedParticipant?.isBehind}
					<div class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-700">
						<AlertTriangle size={16} />
						<span class="text-sm">This participant is behind the cohort session</span>
					</div>
				{/if}

				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
					<div class="p-3 rounded-lg bg-gray-50 text-center">
						<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Welcome Email</p>
						<p class="text-sm font-medium text-gray-900">
							{normalizedParticipant?.welcome_email_sent_at ? 'Sent' : 'Not sent'}
						</p>
						{#if normalizedParticipant?.welcome_email_sent_at}
							<p class="text-[10px] text-gray-400 mt-0.5">
								{formatDate(normalizedParticipant?.welcome_email_sent_at)}
							</p>
						{/if}
					</div>
					<div class="p-3 rounded-lg bg-gray-50 text-center">
						<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Logins</p>
						<p class="text-sm font-medium text-gray-900">
							{normalizedParticipant?.login_count || 0}
						</p>
						{#if normalizedParticipant?.last_login_at}
							<p class="text-[10px] text-gray-400 mt-0.5">
								Last: {formatDate(normalizedParticipant?.last_login_at)}
							</p>
						{/if}
					</div>
					<div class="p-3 rounded-lg bg-gray-50 text-center">
						<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Page Views</p>
						<p class="text-sm font-medium text-gray-900">
							{normalizedParticipant?.view_count || 0}
						</p>
						{#if normalizedParticipant?.last_viewed_at}
							<p class="text-[10px] text-gray-400 mt-0.5">
								Last: {formatDate(normalizedParticipant?.last_viewed_at)}
							</p>
						{/if}
					</div>
					{#if courseFeatures.attendanceEnabled !== false}
					<div class="p-3 rounded-lg bg-gray-50 text-center">
						<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Attendance</p>
						<p class="text-sm font-medium text-gray-900">
							{#if normalizedParticipant?.attendanceCount !== undefined && cohort?.current_session > 0}
								{normalizedParticipant?.attendanceCount}/{cohort.current_session}
							{:else}
								-
							{/if}
						</p>
					</div>
					{/if}
				</div>

				<!-- Edit Form -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider">Profile Information</h3>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="participant-name" class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
							<input
								id="participant-name"
								type="text"
								bind:value={formData.full_name}
								oninput={checkChanges}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
							/>
						</div>
						<div>
							<label for="participant-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
							<input
								id="participant-email"
								type="email"
								bind:value={formData.email}
								oninput={checkChanges}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="participant-status" class="block text-sm font-medium text-gray-700 mb-1">Status</label>
							<select
								id="participant-status"
								bind:value={formData.status}
								onchange={checkChanges}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
							>
								<option value="active">Active</option>
								<option value="pending">Pending</option>
								<option value="invited">Invited</option>
								<option value="held">Held</option>
								<option value="withdrawn">Withdrawn</option>
								<option value="completed">Completed</option>
							</select>
						</div>
						<div>
							<label for="participant-role" class="block text-sm font-medium text-gray-700 mb-1">Role</label>
							<select
								id="participant-role"
								bind:value={formData.role}
								onchange={checkChanges}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
							>
								<option value="student">Participant</option>
								<option value="coordinator">Hub Coordinator</option>
							</select>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-4">
						{#if courseFeatures.hubsEnabled !== false}
						<div>
							<label for="participant-hub" class="block text-sm font-medium text-gray-700 mb-1">Hub</label>
							<select
								id="participant-hub"
								bind:value={formData.hub_id}
								onchange={checkChanges}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
							>
								<option value="">No Hub</option>
								{#each hubs as hub}
									<option value={hub.id}>{hub.name}</option>
								{/each}
							</select>
						</div>
						{/if}
						<div>
							<label for="participant-session" class="block text-sm font-medium text-gray-700 mb-1">Current Session</label>
							<select
								id="participant-session"
								bind:value={formData.current_session}
								onchange={checkChanges}
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
							>
								{#each Array(totalSessions + 1) as _, i}
									<option value={i}>Session {i}{i === 0 ? ' (Not Started)' : ''}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>

				<!-- Contact & Parish Information (editable) -->
				<div class="mt-6 pt-4 border-t border-gray-200">
					<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Contact & Parish Info</h3>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="participant-phone" class="block text-xs font-medium text-gray-500 mb-1">Phone</label>
							<input
								id="participant-phone"
								type="tel"
								bind:value={formData.phone}
								oninput={checkChanges}
								placeholder="e.g. +61 400 123 456"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
							/>
						</div>
						<div>
							<label for="participant-parish" class="block text-xs font-medium text-gray-500 mb-1">Parish / Community</label>
							<input
								id="participant-parish"
								type="text"
								bind:value={formData.parish_community}
								oninput={checkChanges}
								placeholder="e.g. St Mary's Cathedral"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
							/>
						</div>
						<div>
							<label for="participant-parish-role" class="block text-xs font-medium text-gray-500 mb-1">Parish Role</label>
							<input
								id="participant-parish-role"
								type="text"
								bind:value={formData.parish_role}
								oninput={checkChanges}
								placeholder="e.g. Catechist, Reader"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
							/>
						</div>
						<div>
							<label for="participant-address" class="block text-xs font-medium text-gray-500 mb-1">Mailing Address (for certificates)</label>
							<input
								id="participant-address"
								type="text"
								bind:value={formData.address}
								oninput={checkChanges}
								placeholder="e.g. 123 Church St, Brisbane QLD 4000"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm"
							/>
						</div>
					</div>
				</div>

				<!-- Admin Notes (editable, enrollment-specific) -->
				<div class="mt-6 pt-4 border-t border-gray-200">
					<label for="participant-notes" class="block text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Admin Notes</label>
					<textarea
						id="participant-notes"
						bind:value={formData.notes}
						oninput={checkChanges}
						rows="3"
						placeholder="Internal notes visible only to admins..."
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 text-sm resize-none"
					></textarea>
				</div>

				<!-- Progress Stats -->
				{#if normalizedParticipant?.progress}
					<div class="mt-6 pt-4 border-t border-gray-200">
						<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Progress</h3>
						<div class="grid grid-cols-3 gap-3">
							<div class="p-3 rounded-lg bg-gray-50 text-center">
								<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Session</p>
								<p class="text-lg font-bold text-gray-900">
									{normalizedParticipant?.current_session || 0}/{totalSessions}
								</p>
							</div>
							<div class="p-3 rounded-lg bg-gray-50 text-center">
								<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Attendance</p>
								<p class="text-lg font-bold text-gray-900">
									{normalizedParticipant?.progress?.attendance?.attended || 0}/{normalizedParticipant?.progress?.attendance?.total || 0}
								</p>
							</div>
							<div class="p-3 rounded-lg bg-gray-50 text-center">
								<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Reflections</p>
								<p class="text-lg font-bold text-gray-900">
									{normalizedParticipant?.progress?.reflections?.passed || 0}/{normalizedParticipant?.current_session || 0}
								</p>
							</div>
						</div>
					</div>
				{/if}

				{#if showCohortHistory}
					<!-- Attendance History -->
					{#if courseFeatures.attendanceEnabled !== false}
					<div class="mt-6 pt-4 border-t border-gray-200">
						<button
							onclick={() => showAttendance = !showAttendance}
							class="w-full flex items-center justify-between text-left"
						>
							<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
								<Calendar size={14} />
								Attendance History
							</h3>
							{#if showAttendance}
								<ChevronDown size={16} class="text-gray-400" />
							{:else}
								<ChevronRight size={16} class="text-gray-400" />
							{/if}
						</button>
						{#if showAttendance}
							<div class="mt-3">
								{#if loadingHistory}
									<p class="text-sm text-gray-500 text-center py-4">Loading...</p>
								{:else if attendanceHistory.length === 0}
									<p class="text-sm text-gray-500 text-center py-4">No attendance records</p>
								{:else}
									<div class="border border-gray-200 rounded-lg overflow-hidden">
										<table class="w-full text-sm">
											<thead class="bg-gray-50">
												<tr>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Session</th>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Status</th>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Marked</th>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">By</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-gray-100">
												{#each attendanceHistory as record}
													<tr>
														<td class="px-3 py-2 text-gray-900">Session {record.session_number}</td>
														<td class="px-3 py-2">
															{#if record.present}
																<span class="inline-flex items-center gap-1 text-green-700">
																	<CheckCircle size={14} />
																	Present
																</span>
															{:else}
																<span class="inline-flex items-center gap-1 text-red-600">
																	<XCircle size={14} />
																	Absent
																</span>
															{/if}
														</td>
														<td class="px-3 py-2 text-gray-500">{formatDateTime(record.created_at)}</td>
														<td class="px-3 py-2 text-gray-500">{record.marked_by_name || '-'}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
							</div>
						{/if}
					</div>
					{/if}

					<!-- Reflection History -->
					<div class="mt-6 pt-4 border-t border-gray-200">
						<button
							onclick={() => showReflections = !showReflections}
							class="w-full flex items-center justify-between text-left"
						>
							<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
								<FileText size={14} />
								Reflection Submissions
							</h3>
							{#if showReflections}
								<ChevronDown size={16} class="text-gray-400" />
							{:else}
								<ChevronRight size={16} class="text-gray-400" />
							{/if}
						</button>
						{#if showReflections}
							<div class="mt-3">
								{#if loadingHistory}
									<p class="text-sm text-gray-500 text-center py-4">Loading...</p>
								{:else if reflectionHistory.length === 0}
									<p class="text-sm text-gray-500 text-center py-4">No reflection submissions</p>
								{:else}
									<div class="border border-gray-200 rounded-lg overflow-hidden">
										<table class="w-full text-sm">
											<thead class="bg-gray-50">
												<tr>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Session</th>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Status</th>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Submitted</th>
													<th class="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase">Words</th>
												</tr>
											</thead>
											<tbody class="divide-y divide-gray-100">
												{#each reflectionHistory as reflection}
													{@const badge = getReflectionStatusBadge(reflection.status)}
													<tr>
														<td class="px-3 py-2 text-gray-900">Session {reflection.session_number}</td>
														<td class="px-3 py-2">
															<span class="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full {badge.class}">
																{badge.label}
															</span>
														</td>
														<td class="px-3 py-2 text-gray-500">{formatDateTime(reflection.submitted_at || reflection.updated_at)}</td>
														<td class="px-3 py-2 text-gray-500">{reflection.word_count || '-'}</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Platform History -->
				{#if otherCourses.length > 0}
					<div class="mt-6 pt-4 border-t border-gray-200">
						<button
							onclick={() => showPlatformHistory = !showPlatformHistory}
							class="w-full flex items-center justify-between text-left"
						>
							<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
								<Hash size={14} />
								Platform History
							</h3>
							{#if showPlatformHistory}
								<ChevronDown size={16} class="text-gray-400" />
							{:else}
								<ChevronRight size={16} class="text-gray-400" />
							{/if}
						</button>
						{#if showPlatformHistory}
							<div class="mt-3 space-y-2">
								{#each otherCourses as enrollment}
									<div class="p-3 bg-gray-50 rounded-lg">
										<div class="flex items-start justify-between gap-2">
											<div>
												<p class="text-sm font-medium text-gray-900">{enrollment.course_name}</p>
												<p class="text-xs text-gray-500">{enrollment.cohort_name} · {enrollment.module_name}</p>
											</div>
											<span class="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full shrink-0 {getStatusColor(enrollment.status)}">
												{enrollment.status}
											</span>
										</div>
										<p class="text-xs text-gray-400 mt-1">
											{#if enrollment.last_login_at}
												Last signed in {formatRelativeTime(enrollment.last_login_at)}
											{:else}
												Never signed in
											{/if}
										</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				<!-- Cohort Info (for participants page with multiple cohorts) -->
				{#if normalizedParticipant?.all_cohorts?.length > 0}
					<div class="mt-6 pt-4 border-t border-gray-200">
						<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Cohort Enrollments</h3>
						<div class="space-y-2">
							{#each normalizedParticipant?.all_cohorts as cohortItem}
								<div class="p-3 bg-gray-50 rounded-lg">
									<p class="text-sm font-medium text-gray-900">{cohortItem.name}</p>
									{#if cohortItem.module}
										<p class="text-xs text-gray-500">{cohortItem.module.name}</p>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
				<button
					onclick={handleEmailClick}
					class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
					style="color: var(--course-accent-darkest, #333); background-color: var(--course-surface, #f5f5f5);"
				>
					<Mail size={16} />
					Send Email
				</button>

				<div class="flex items-center gap-3">
					<button
						onclick={handleClose}
						class="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleSave}
						disabled={isLoading || !hasChanges}
						class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						style="background-color: var(--course-accent-dark, #333);"
					>
						<Save size={16} />
						{isLoading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<!-- Unsaved Changes Warning -->
<ConfirmationModal
	show={showUnsavedWarning}
	title="Unsaved Changes"
	confirmText="Discard"
	cancelText="Keep Editing"
	onConfirm={confirmClose}
	onCancel={() => showUnsavedWarning = false}
>
	<p>You have unsaved changes. Are you sure you want to close without saving?</p>
</ConfirmationModal>
