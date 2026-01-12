<script>
	import { X, Mail, Save, User, MapPin, Hash, Clock, Send, AlertTriangle } from 'lucide-svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from './ConfirmationModal.svelte';

	let {
		show = false,
		participant = null,
		courseSlug,
		cohort = null,
		hubs = [],
		totalSessions = 8,
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
		current_session: 0
	});

	let isLoading = $state(false);
	let hasChanges = $state(false);
	let showUnsavedWarning = $state(false);

	// Normalize participant data from different sources
	const normalizedParticipant = $derived(() => {
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
				attendanceCount: participant.attendanceCount,
				reflectionStatus: participant.reflectionStatus,
				isBehind: participant.isBehind,
				cohort_id: participant.cohort_id
			};
		}

		// Handle participants page format (nested user_profile)
		return {
			id: participant.id,
			full_name: participant.user_profile?.full_name || 'Unknown',
			email: participant.user_profile?.email || '',
			status: participant.status || 'active',
			role: participant.role || 'student',
			hub_id: participant.hub_id || '',
			hub_name: participant.courses_hubs?.name || null,
			current_session: participant.current_session || 0,
			user_profile_id: participant.user_profile_id,
			welcome_email_sent_at: participant.welcome_email_sent_at,
			last_login_at: participant.last_login_at,
			login_count: participant.login_count || 0,
			attendanceCount: participant.attendanceCount,
			reflectionStatus: participant.reflectionStatus,
			isBehind: participant.isBehind,
			cohort_id: participant.cohort_id,
			all_cohorts: participant.all_cohorts
		};
	});

	// Reset form when participant changes
	$effect(() => {
		if (participant && show) {
			const np = normalizedParticipant();
			if (np) {
				formData = {
					full_name: np.full_name,
					email: np.email,
					status: np.status,
					role: np.role,
					hub_id: np.hub_id || '',
					current_session: np.current_session
				};
				hasChanges = false;
			}
		}
	});

	// Track changes
	function checkChanges() {
		const np = normalizedParticipant();
		if (!np) return;

		hasChanges =
			formData.full_name !== np.full_name ||
			formData.email !== np.email ||
			formData.status !== np.status ||
			formData.role !== np.role ||
			formData.hub_id !== (np.hub_id || '') ||
			formData.current_session !== np.current_session;
	}

	async function handleSave() {
		const np = normalizedParticipant();
		if (!np) return;

		isLoading = true;

		try {
			const updates = {};

			if (formData.full_name !== np.full_name) {
				updates.full_name = formData.full_name;
			}
			if (formData.email !== np.email) {
				updates.email = formData.email;
			}
			if (formData.status !== np.status) {
				updates.status = formData.status;
			}
			if (formData.role !== np.role) {
				updates.role = formData.role;
			}
			if (formData.hub_id !== (np.hub_id || '')) {
				updates.hub_id = formData.hub_id || null;
			}
			if (formData.current_session !== np.current_session) {
				updates.current_session = formData.current_session;
			}

			if (Object.keys(updates).length === 0) {
				toastSuccess('No changes to save');
				return;
			}

			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_enrollment',
					userId: np.id,
					updates
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
		const np = normalizedParticipant();
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
</script>

{#if show && participant}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-200 flex items-start justify-between" style="background-color: var(--course-surface, #f5f5f5);">
				<div class="flex items-center gap-3">
					<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background-color: var(--course-accent-light, #e5e5e5);">
						<User size={24} style="color: var(--course-accent-darkest, #333);" />
					</div>
					<div>
						<h2 class="text-lg font-bold" style="color: var(--course-accent-darkest, #333);">
							{normalizedParticipant()?.full_name || 'Participant'}
						</h2>
						<p class="text-sm text-gray-500">{normalizedParticipant()?.email}</p>
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
				{#if normalizedParticipant()?.isBehind}
					<div class="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2 text-orange-700">
						<AlertTriangle size={16} />
						<span class="text-sm">This participant is behind the cohort session</span>
					</div>
				{/if}

				<div class="grid grid-cols-3 gap-3 mb-6">
					<div class="p-3 rounded-lg bg-gray-50 text-center">
						<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Welcome Email</p>
						<p class="text-sm font-medium text-gray-900">
							{normalizedParticipant()?.welcome_email_sent_at ? 'Sent' : 'Not sent'}
						</p>
						{#if normalizedParticipant()?.welcome_email_sent_at}
							<p class="text-[10px] text-gray-400 mt-0.5">
								{formatDate(normalizedParticipant()?.welcome_email_sent_at)}
							</p>
						{/if}
					</div>
					<div class="p-3 rounded-lg bg-gray-50 text-center">
						<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Last Login</p>
						<p class="text-sm font-medium text-gray-900">
							{normalizedParticipant()?.last_login_at ? formatDate(normalizedParticipant()?.last_login_at) : 'Never'}
						</p>
						{#if normalizedParticipant()?.login_count > 0}
							<p class="text-[10px] text-gray-400 mt-0.5">
								{normalizedParticipant()?.login_count} logins
							</p>
						{/if}
					</div>
					<div class="p-3 rounded-lg bg-gray-50 text-center">
						<p class="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Attendance</p>
						<p class="text-sm font-medium text-gray-900">
							{#if normalizedParticipant()?.attendanceCount !== undefined && cohort?.current_session > 0}
								{normalizedParticipant()?.attendanceCount}/{cohort.current_session}
							{:else}
								-
							{/if}
						</p>
					</div>
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

				<!-- Cohort Info (for participants page with multiple cohorts) -->
				{#if normalizedParticipant()?.all_cohorts?.length > 0}
					<div class="mt-6 pt-4 border-t border-gray-200">
						<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Cohort Enrollments</h3>
						<div class="space-y-2">
							{#each normalizedParticipant()?.all_cohorts as cohortItem}
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
