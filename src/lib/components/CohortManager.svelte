<script>
	import { Plus, Edit2, X, Mail, Trash2, Check, Home, AlertTriangle, MoreVertical, ArrowRight, Loader2 } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import {
		getUserReflectionStatus,
		formatUserReflectionStatus,
		getStatusBadgeClass,
		fetchReflectionsByCohort
	} from '$lib/utils/reflection-status.js';
	import { toastError, toastSuccess, toastWarning } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let {
		cohort,
		modules = [],
		courseSlug,
		onUpdate = () => {},
		onDelete = () => {},
		onAddStudents = () => {},
		refreshTrigger = 0,
		totalSessions = 8  // Default to 8, can be passed from parent
	} = $props();

	let students = $state([]);
	let hubs = $state([]);
	let reflectionsByUser = $state(new Map()); // Map of user_id -> reflections array
	let sessionsWithQuestions = $state([]); // Session numbers that have reflection questions
	let loadingStudents = $state(false);
	let editingStudent = $state(null);
	let selectedStudents = $state(new Set());
	let openDropdown = $state(null); // Track which student's dropdown is open
	let dropdownPosition = $state({ top: 0, right: 0 }); // Track dropdown position
	let editingSession = $state(null); // Track which student's session is being edited

	// Confirmation modal state
	let showDeleteConfirm = $state(false);
	let studentToDelete = $state(null);
	let showAdvanceConfirm = $state(false);
	let studentsToAdvance = $state([]);

	// Derived state: students who are behind the cohort's current session
	// Only show advance option if cohort has started (session > 0)
	const studentsBehind = $derived(
		cohort.current_session > 0
			? Array.from(selectedStudents)
					.map(id => students.find(s => s.id === id))
					.filter(s => s && s.current_session < cohort.current_session)
			: []
	);

	const canAdvance = $derived(studentsBehind.length > 0 && cohort.current_session > 0);

	// Reload when cohort changes
	$effect(() => {
		if (cohort?.id) {
			loadStudents();
			loadHubs();
		}
	});

	// Reload when refresh trigger changes (from parent)
	$effect(() => {
		if (refreshTrigger > 0 && cohort?.id) {
			loadStudents();
			loadHubs();
		}
	});

	async function loadStudents() {
		loadingStudents = true;
		try {
			// Get module ID for fetching sessions with questions
			const moduleId = cohort.module?.id || cohort.module_id;

			// Fetch all data in parallel instead of sequentially
			const [enrollmentResponse, attendanceResponse, reflectionsData, sessionsResponse] = await Promise.all([
				fetch(`/admin/courses/${courseSlug}/api?endpoint=courses_enrollments&cohort_id=${cohort.id}`).then(r => r.json()),
				fetch(`/admin/courses/${courseSlug}/api?endpoint=attendance&cohort_id=${cohort.id}`).then(r => r.json()),
				fetchReflectionsByCohort(cohort.id, courseSlug),
				moduleId
					? fetch(`/admin/courses/${courseSlug}/api?endpoint=sessions_with_questions&module_id=${moduleId}`).then(r => r.json())
					: Promise.resolve({ success: true, data: [] })
			]);

			const result = enrollmentResponse;
			const attendanceResult = attendanceResponse;
			reflectionsByUser = reflectionsData;
			sessionsWithQuestions = sessionsResponse.success ? sessionsResponse.data : [];

			// Create attendance map: enrollment_id -> attendance_count
			const attendanceMap = new Map();
			if (attendanceResult.success && attendanceResult.data) {
				attendanceResult.data.forEach(record => {
					if (record.present) {
						const count = attendanceMap.get(record.enrollment_id) || 0;
						attendanceMap.set(record.enrollment_id, count + 1);
					}
				});
			}

			students = (result.success ? result.data : []).map(user => {
				// Get reflection status for this student
				const userReflections = reflectionsByUser.get(user.auth_user_id) || [];
				const reflectionStatus = getUserReflectionStatus(userReflections, user.current_session, sessionsWithQuestions);

				return {
					...user,
					// Mark if they can be selected for invitations (pending status only)
					canInvite: user.status === 'pending',
					// Mark if they can be edited/deleted (not yet active)
					canEdit: !user.auth_user_id,
					// Add attendance data (use enrollment ID, not auth_user_id)
					attendanceCount: attendanceMap.get(user.id) || 0,
					// Calculate if student is behind
					// Don't mark as behind if cohort is at session 0 (not started) or if student is at session 0
					isBehind: cohort.current_session > 0 && user.current_session > 0 && user.current_session < cohort.current_session,
					// Add reflection status
					reflectionStatus: reflectionStatus
				};
			});

			selectedStudents = new Set();
		} catch (err) {
			console.error('Failed to load students:', err);
		} finally {
			loadingStudents = false;
		}
	}

	async function loadHubs() {
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/hubs/api`);
			const result = await response.json();
			if (result.success) {
				hubs = result.data;
			}
		} catch (err) {
			console.error('Failed to load hubs:', err);
		}
	}


	function toggleSelectStudent(studentId) {
		const newSelected = new Set(selectedStudents);
		if (newSelected.has(studentId)) {
			newSelected.delete(studentId);
		} else {
			newSelected.add(studentId);
		}
		selectedStudents = newSelected;
	}

	function toggleSelectAll() {
		// Allow selecting all students (not just pending for invitations)
		if (selectedStudents.size === students.length) {
			selectedStudents = new Set();
		} else {
			selectedStudents = new Set(students.map(s => s.id));
		}
	}

	function startEditStudent(student) {
		editingStudent = { ...student };
	}

	async function saveEditStudent() {
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_enrollment',
					userId: editingStudent.id,
					updates: {
						full_name: editingStudent.full_name,
						role: editingStudent.role,
						hub_id: editingStudent.hub_id
					}
				})
			});

			if (response.ok) {
				editingStudent = null;
				await loadStudents();
				await onUpdate();
			}
		} catch (err) {
			console.error('Failed to update student:', err);
			toastError('Failed to update student', 'Update Failed');
		}
	}

	function confirmDeleteStudent(studentId) {
		studentToDelete = studentId;
		showDeleteConfirm = true;
	}

	async function deleteStudent() {
		const studentId = studentToDelete;
		showDeleteConfirm = false;
		studentToDelete = null;

		if (!studentId) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_enrollment',
					userId: studentId
				})
			});

			if (response.ok) {
				await loadStudents();
				await onUpdate();
			}
		} catch (err) {
			console.error('Failed to delete student:', err);
			toastError('Failed to delete student', 'Delete Failed');
		}
	}

	function confirmAdvanceStudents() {
		studentsToAdvance = studentsBehind.map(s => s.id);
		showAdvanceConfirm = true;
	}

	async function advanceSelectedStudents() {
		const studentIds = studentsToAdvance;
		showAdvanceConfirm = false;
		studentsToAdvance = [];

		if (!studentIds || studentIds.length === 0) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'advance_students',
					cohortId: cohort.id,
					studentIds: studentIds,
					targetSession: cohort.current_session,
					sendEmail: false
				})
			});

			const result = await response.json();

			if (result.success) {
				toastSuccess(`Successfully advanced ${studentIds.length} student(s) to Session ${cohort.current_session}`, 'Students Advanced');
				selectedStudents = new Set();
				await loadStudents();
				await onUpdate();
			} else {
				toastError('Failed to advance students: ' + result.message, 'Advance Failed');
			}
		} catch (err) {
			console.error('Error advancing students:', err);
			toastError('Failed to advance students', 'Advance Failed');
		}
	}

	function startEditSession(student) {
		editingSession = {
			id: student.id,
			value: student.current_session,
			studentName: student.full_name
		};
	}

	async function saveEditSession() {
		if (!editingSession) return;

		// Validate session number
		if (editingSession.value < 0 || editingSession.value > totalSessions) {
			toastWarning(`Session must be between 0 (not started) and ${totalSessions}`, 'Invalid Session');
			return;
		}

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_enrollment',
					userId: editingSession.id,
					updates: {
						current_session: editingSession.value
					}
				})
			});

			const result = await response.json();

			if (response.ok && result.success) {
				editingSession = null;
				await loadStudents();
				await onUpdate();
			} else {
				const errorMsg = result.message || 'Failed to update session. Please try again.';
				console.error('Session update failed:', result);
				toastError(errorMsg, 'Update Failed');
			}
		} catch (err) {
			console.error('Failed to update session:', err);
			toastError('Failed to update session: ' + (err.message || 'Unknown error'), 'Update Failed');
		}
	}

	function toggleDropdown(studentId, event) {
		event?.stopPropagation(); // Prevent event bubbling

		if (openDropdown === studentId) {
			openDropdown = null;
		} else {
			// Calculate position for fixed positioning
			const button = event.currentTarget;
			const rect = button.getBoundingClientRect();

			dropdownPosition = {
				top: rect.bottom + 4, // 4px below the button
				right: window.innerWidth - rect.right // Align to right edge of button
			};

			openDropdown = studentId;
		}
	}

	// Close dropdown when clicking outside
	$effect(() => {
		function handleClickOutside(event) {
			if (openDropdown !== null) {
				const target = event.target;
				const dropdown = target.closest('.actions-dropdown');
				if (!dropdown) {
					openDropdown = null;
				}
			}
		}

		if (typeof document !== 'undefined') {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});

	// Helper function for reflection status display
	function getReflectionStatusDisplay(student) {
		if (!student.reflectionStatus) return '';
		return formatUserReflectionStatus(student.reflectionStatus.status, student.reflectionStatus.count);
	}

	const getRoleBadgeClass = (role) => {
		switch (role) {
			case 'coordinator': return 'bg-purple-100 text-purple-800';
			case 'student': return 'bg-green-100 text-green-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

	const getEnrollmentStatusBadgeClass = (status) => {
		switch (status) {
			case 'pending': return 'bg-yellow-100 text-yellow-800';
			case 'invited': return 'bg-blue-100 text-blue-800';
			case 'accepted': return 'bg-purple-100 text-purple-800';
			case 'active': return 'bg-emerald-100 text-emerald-800';
			case 'held': return 'bg-orange-100 text-orange-800';
			case 'completed': return 'bg-green-100 text-green-800';
			case 'withdrawn': return 'bg-gray-100 text-gray-800';
			case 'error': return 'bg-red-100 text-red-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

	const formatRole = (role) => {
		const roles = {
			coordinator: 'Hub Coordinator',
			student: 'Participant'
		};
		return roles[role] || role;
	};

	const formatStatus = (status) => {
		const statuses = {
			pending: 'Pending',
			invited: 'Invited',
			accepted: 'Accepted',
			active: 'Active',
			held: 'Held',
			completed: 'Completed',
			withdrawn: 'Withdrawn',
			error: 'Error'
		};
		return statuses[status] || status;
	};
</script>

<div class="cohort-manager">
	<!-- Participants Section -->
	<div class="section">
		<div class="section-header">
			<h2>Participants ({students.length})</h2>
			<div class="header-actions">
				{#if canAdvance}
					<button
						onclick={confirmAdvanceStudents}
						class="btn-primary-small"
					>
						<ArrowRight size={16} />
						Advance {studentsBehind.length} to Session {cohort.current_session}
					</button>
				{/if}
				<button type="button" onclick={() => {
					console.log('Add Participants button clicked!');
					console.log('onAddStudents function:', onAddStudents);
					onAddStudents();
				}} class="btn-primary-small">
					<Plus size={16} />
					Add Participants
				</button>
			</div>
		</div>

		{#if loadingStudents}
			<div class="loading-state">
				<Loader2 size={32} class="spinner" />
				<p>Loading participants...</p>
			</div>
		{:else if students.length === 0}
			<div class="empty-state">No participants yet. Click "Add Participants" to get started.</div>
		{:else}
			<div class="table-container">
				<div class="table-wrapper">
					<table>
					<thead>
						<tr>
							<th class="w-12">
								<input
									type="checkbox"
									onchange={toggleSelectAll}
									checked={selectedStudents.size > 0 && selectedStudents.size === students.length}
								/>
							</th>
							<th>Name</th>
							<th>Hub</th>
							<th>Current Session</th>
							<th>Attendance</th>
							<th>Reflection Status</th>
							<th class="text-right w-12">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each students as student}
							<tr>
								<td>
									<input
										type="checkbox"
										checked={selectedStudents.has(student.id)}
										onchange={() => toggleSelectStudent(student.id)}
									/>
								</td>
								<td>
									<div class="name-cell">
										{#if student.isBehind}
											<AlertTriangle size={16} class="warning-icon" />
										{/if}
										<div class="name-content">
											<span class="student-name">{student.full_name}</span>
											{#if student.role === 'coordinator'}
												<div class="hub-coordinator-badge">
													<Home size={12} />
													<span>Hub Coordinator</span>
												</div>
											{/if}
										</div>
									</div>
								</td>
								<td>{student.courses_hubs?.name || '-'}</td>
								<td>
									{#if editingSession && editingSession.id === student.id}
										<div class="session-edit">
											<input
												type="number"
												bind:value={editingSession.value}
												min="0"
												max={totalSessions}
												class="table-input-small"
												placeholder="0-{totalSessions}"
											/>
											<button
												onclick={saveEditSession}
												class="btn-icon-tiny success"
												title="Save session change"
											>
												<Check size={14} />
											</button>
											<button
												onclick={() => editingSession = null}
												class="btn-icon-tiny"
												title="Cancel"
											>
												<X size={14} />
											</button>
										</div>
									{:else}
										<div
											class="session-display"
											onclick={() => startEditSession(student)}
											onkeydown={(e) => e.key === 'Enter' && startEditSession(student)}
											role="button"
											tabindex="0"
											title="Click to edit {student.full_name}'s current session"
										>
											{#if student.current_session === 0}
												<span class="session-not-started">Not Started</span>
											{:else}
												Session {student.current_session}
											{/if}
											<span class="edit-hint">✏️</span>
										</div>
									{/if}
								</td>
								<td>
									{#if cohort.current_session === 0}
										<span class="text-gray-400">—</span>
									{:else}
										<span class="attendance-display">
											{student.attendanceCount}/{cohort.current_session}
										</span>
									{/if}
								</td>
								<td>
									{#if student.current_session === 0 || cohort.current_session === 0}
										<span class="text-gray-400">—</span>
									{:else if student.reflectionStatus}
										<span class="badge {getStatusBadgeClass(student.reflectionStatus.status)}">
											{getReflectionStatusDisplay(student)}
										</span>
									{:else}
										<span class="text-gray-400">—</span>
									{/if}
								</td>
								<td class="actions-dropdown">
									<button
										type="button"
										class="btn-icon"
										onclick={(e) => toggleDropdown(student.id, e)}
									>
										<MoreVertical size={16} />
									</button>
								</td>
							</tr>

							<!-- Editing row (shown below the normal row when editing) -->
							{#if editingStudent && editingStudent.id === student.id}
								<tr class="editing-row">
									<td colspan="7">
										<div class="edit-form">
											<div class="form-row">
												<label>
													Name:
													<input type="text" bind:value={editingStudent.full_name} class="table-input" />
												</label>
												<label>
													Role:
													<select bind:value={editingStudent.role} class="table-input">
														<option value="student">Participant</option>
														<option value="coordinator">Hub Coordinator</option>
													</select>
												</label>
												<label>
													Hub:
													<select bind:value={editingStudent.hub_id} class="table-input">
														<option value={null}>No Hub</option>
														{#each hubs as hub}
															<option value={hub.id}>{hub.name}</option>
														{/each}
													</select>
												</label>
											</div>
											<div class="form-actions">
												<button onclick={saveEditStudent} class="btn-primary-small">
													<Check size={16} />
													Save Changes
												</button>
												<button onclick={() => editingStudent = null} class="btn-secondary-small">
													<X size={16} />
													Cancel
												</button>
											</div>
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
				</div>
			</div>
		{/if}
	</div>

	<!-- Fixed position dropdown menu (rendered outside table to avoid clipping) -->
	{#if openDropdown !== null}
		{#each students.filter(s => s.id === openDropdown) as student}
			<div
				class="dropdown-menu-fixed"
				style="top: {dropdownPosition.top}px; right: {dropdownPosition.right}px;"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.key === 'Escape' && (openDropdown = null)}
				role="menu"
				tabindex="-1"
			>
				{#if student.canEdit}
					<button
						type="button"
						onclick={() => {
							startEditStudent(student);
							openDropdown = null;
						}}
						class="dropdown-item"
					>
						<Edit2 size={14} />
						Edit Details
					</button>
					<button
						type="button"
						onclick={() => {
							confirmDeleteStudent(student.id);
							openDropdown = null;
						}}
						class="dropdown-item danger"
					>
						<Trash2 size={14} />
						Remove
					</button>
				{:else}
					<button
						type="button"
						onclick={() => {
							/* TODO: View profile */
							openDropdown = null;
						}}
						class="dropdown-item"
					>
						View Profile
					</button>
					<button
						type="button"
						onclick={() => {
							/* TODO: Send message */
							openDropdown = null;
						}}
						class="dropdown-item"
					>
						Send Message
					</button>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<!-- Confirmation Modals -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Remove Student"
	confirmText="Remove"
	cancelText="Cancel"
	onConfirm={deleteStudent}
	onCancel={() => {
		showDeleteConfirm = false;
		studentToDelete = null;
	}}
>
	<p>Are you sure you want to remove this student from the cohort?</p>
	<p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
</ConfirmationModal>

<ConfirmationModal
	show={showAdvanceConfirm}
	title="Advance Students"
	confirmText="Advance"
	cancelText="Cancel"
	onConfirm={advanceSelectedStudents}
	onCancel={() => {
		showAdvanceConfirm = false;
		studentsToAdvance = [];
	}}
>
	<p>Advance {studentsToAdvance.length} student(s) to Session {cohort.current_session}?</p>
	<p class="text-sm text-gray-600 mt-2">This will update their current session progress.</p>
</ConfirmationModal>

<style>
	.cohort-manager {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}

	.section {
		background: white;
		border: 1px solid var(--course-surface);
		border-radius: 12px;
		padding: 24px;
		overflow: visible; /* Allow dropdowns to overflow */
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	h2 {
		margin: 0;
		font-weight: 700;
		font-size: 1.75rem;
		color: var(--course-accent-darkest);
	}

	.header-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
	}

	.readonly-field {
		padding: 10px 12px;
		background: var(--course-surface);
		border: 1px solid var(--course-surface);
		border-radius: 6px;
		color: var(--course-accent-dark);
	}

	.table-container {
		overflow-x: auto; /* Handle horizontal scroll on outer container */
		overflow-y: visible; /* Allow dropdowns to overflow vertically */
	}

	.table-wrapper {
		overflow: visible; /* Inner wrapper allows dropdown to escape */
		min-width: 100%;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		position: relative;
	}

	thead {
		background: var(--course-surface);
	}

	th {
		padding: 12px;
		text-align: left;
		font-weight: 600;
		font-size: 0.75rem;
		text-transform: uppercase;
		color: var(--course-accent-darkest);
		border-bottom: 2px solid var(--course-accent-light);
	}

	th.w-12 {
		width: 48px;
	}

	th.text-right {
		text-align: right;
	}

	td {
		padding: 12px;
		border-bottom: 1px solid var(--course-surface);
		font-size: 0.875rem;
	}

	tr {
		position: relative;
	}

	tr:hover:not(.editing-row) {
		background: var(--course-surface);
	}

	tr.editing-row {
		background: #fffbf0;
	}

	.table-input {
		width: 100%;
		padding: 4px 8px;
		border: 1px solid var(--course-surface);
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 4px;
	}

	.badge {
		display: inline-block;
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.btn-icon {
		padding: 8px;
		border: none;
		background: transparent;
		color: var(--course-accent-dark);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		position: relative;
		z-index: 1;
	}

	.btn-icon:hover {
		background: var(--course-surface);
		color: var(--course-accent-darkest);
	}

	.btn-icon:active {
		transform: scale(0.95);
		background: var(--course-accent-light);
	}

	.btn-icon.success {
		color: #10B981;
	}

	.btn-icon.success:hover {
		background: #D1FAE5;
	}

	.btn-icon.danger {
		color: #EF4444;
	}

	.btn-icon.danger:hover {
		background: #FEE2E2;
	}

	.btn-primary-small {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: var(--course-accent-light);
		color: var(--course-accent-darkest);
		border: none;
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-primary-small:hover:not(:disabled) {
		background: var(--course-accent-dark);
		color: white;
	}

	.btn-primary-small:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.empty-state {
		text-align: center;
		padding: 48px;
		color: var(--course-accent-dark);
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 64px 48px;
		gap: 16px;
	}

	.loading-state p {
		color: var(--course-accent-dark);
		font-size: 1rem;
		font-weight: 500;
	}

	.loading-state :global(.spinner) {
		color: var(--course-accent-light);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* New table styles */
	.name-cell {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}

	.name-content {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.student-name {
		font-weight: 500;
		color: var(--course-accent-darkest);
	}

	.warning-icon {
		color: #EF4444;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.hub-coordinator-badge {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75rem;
		color: #6B7280;
		font-weight: 400;
	}

	.hub-coordinator-badge :global(svg) {
		color: #6B7280;
	}

	.session-display {
		cursor: pointer;
		padding: 6px 12px;
		border-radius: 6px;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: 1px solid transparent;
		font-weight: 500;
	}

	.session-display:hover {
		background: var(--course-surface);
		border-color: var(--course-accent-light);
	}

	.session-display .edit-hint {
		opacity: 0;
		font-size: 0.75rem;
		transition: opacity 0.2s ease;
	}

	.session-display:hover .edit-hint {
		opacity: 0.5;
	}

	.session-not-started {
		color: #6B7280;
		font-style: italic;
		font-weight: 400;
	}

	.text-gray-400 {
		color: #9CA3AF;
	}

	.session-edit {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.table-input-small {
		width: 70px;
		padding: 6px 10px;
		border: 2px solid var(--course-accent-light);
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		transition: border-color 0.2s ease;
	}

	.table-input-small:focus {
		outline: none;
		border-color: var(--course-accent-dark);
		background: #FFFBF0;
	}

	.btn-icon-tiny {
		padding: 4px;
		border: none;
		background: transparent;
		color: var(--course-accent-dark);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
	}

	.btn-icon-tiny:hover {
		background: var(--course-surface);
	}

	.btn-icon-tiny.success {
		color: #10B981;
	}

	.btn-icon-tiny.success:hover {
		background: #D1FAE5;
	}

	.attendance-display {
		font-weight: 500;
		color: var(--course-accent-darkest);
	}

	.reflection-status {
		font-size: 0.875rem;
		color: var(--course-accent-dark);
	}

	.actions-dropdown {
		position: relative;
		text-align: right;
		overflow: visible !important;
	}

	.dropdown-menu-fixed {
		position: fixed;
		background: white;
		border: 2px solid var(--course-accent-light);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		min-width: 180px;
		z-index: 9999;
		animation: dropdownFade 0.15s ease-out;
	}

	@keyframes dropdownFade {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 12px;
		border: none;
		background: white;
		color: var(--course-accent-darkest);
		text-align: left;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.dropdown-item:hover {
		background: var(--course-surface);
	}

	.dropdown-item.danger {
		color: #EF4444;
	}

	.dropdown-item.danger:hover {
		background: #FEE2E2;
	}

	.editing-row {
		background: #FFFBF0 !important;
	}

	.editing-row:hover {
		background: #FFFBF0 !important;
	}

	.edit-form {
		padding: 16px;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		margin-bottom: 16px;
	}

	.form-row label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--course-accent-darkest);
	}

	.form-actions {
		display: flex;
		gap: 8px;
	}

	.btn-secondary-small {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		background: white;
		color: var(--course-accent-darkest);
		border: 1px solid var(--course-surface);
		border-radius: 6px;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-secondary-small:hover {
		background: var(--course-surface);
	}
</style>
