<script>
	import { Plus, Edit2, X, Mail, Trash2, Check, Home, AlertTriangle, MoreVertical, ArrowRight } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import {
		getUserReflectionStatus,
		formatUserReflectionStatus,
		getStatusBadgeClass,
		fetchReflectionsByCohort
	} from '$lib/utils/reflection-status.js';

	let {
		cohort,
		modules = [],
		onUpdate = () => {},
		onDelete = () => {},
		onAddStudents = () => {},
		refreshTrigger = 0
	} = $props();

	let students = $state([]);
	let hubs = $state([]);
	let reflectionsByUser = $state(new Map()); // Map of user_id -> reflections array
	let loadingStudents = $state(false);
	let editingStudent = $state(null);
	let selectedStudents = $state(new Set());
	let sendingInvitations = $state(false);
	let openDropdown = $state(null); // Track which student's dropdown is open
	let editingSession = $state(null); // Track which student's session is being edited

	// Derived state: students who are behind the cohort's current session
	const studentsBehind = $derived(
		Array.from(selectedStudents)
			.map(id => students.find(s => s.id === id))
			.filter(s => s && s.current_session < cohort.current_session)
	);

	const canAdvance = $derived(studentsBehind.length > 0);

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
			const response = await fetch(`/admin/api?endpoint=courses_enrollments&cohort_id=${cohort.id}`);
			const result = await response.json();

			// Fetch attendance data for all students
			const attendanceResponse = await fetch(`/admin/api?endpoint=attendance&cohort_id=${cohort.id}`);
			const attendanceResult = await attendanceResponse.json();

			// Fetch reflection data for all students
			reflectionsByUser = await fetchReflectionsByCohort(cohort.id);

			// Create attendance map: user_id -> attendance_count
			const attendanceMap = new Map();
			if (attendanceResult.success) {
				attendanceResult.data.forEach(record => {
					const count = attendanceMap.get(record.user_id) || 0;
					attendanceMap.set(record.user_id, count + (record.present ? 1 : 0));
				});
			}

			students = (result.success ? result.data : []).map(user => {
				// Get reflection status for this student
				const userReflections = reflectionsByUser.get(user.auth_user_id) || [];
				const reflectionStatus = getUserReflectionStatus(userReflections, user.current_session);

				return {
					...user,
					// Mark if they can be selected for invitations (pending status only)
					canInvite: user.status === 'pending',
					// Mark if they can be edited/deleted (not yet active)
					canEdit: !user.auth_user_id,
					// Add attendance data
					attendanceCount: attendanceMap.get(user.auth_user_id) || 0,
					// Calculate if student is behind (more than 1 session)
					isBehind: user.current_session < (cohort.current_session - 1),
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
			const response = await fetch('/admin/hubs/api');
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

	async function sendInvitations() {
		if (selectedStudents.size === 0) return;

		if (!confirm(`Send invitations to ${selectedStudents.size} student(s)?`)) return;

		sendingInvitations = true;
		try {
			const response = await fetch('/admin/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'send_invitations',
					userIds: Array.from(selectedStudents)
				})
			});

			const result = await response.json();
			if (result.success) {
				alert(`Successfully sent ${result.data.sent} invitations. ${result.data.failed} failed.`);
				await loadStudents();
				await onUpdate();
			} else {
				alert('Failed to send invitations: ' + result.message);
			}
		} catch (err) {
			console.error('Failed to send invitations:', err);
			alert('Failed to send invitations');
		} finally {
			sendingInvitations = false;
		}
	}

	function startEditStudent(student) {
		editingStudent = { ...student };
	}

	async function saveEditStudent() {
		try {
			const response = await fetch('/admin/api', {
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
			alert('Failed to update student');
		}
	}

	async function deleteStudent(studentId) {
		if (!confirm('Remove this student?')) return;

		try {
			const response = await fetch('/admin/api', {
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
			alert('Failed to delete student');
		}
	}

	async function advanceSelectedStudents() {
		const studentIds = studentsBehind.map(s => s.id);

		if (!confirm(`Advance ${studentIds.length} student(s) to Session ${cohort.current_session}?`)) {
			return;
		}

		try {
			const response = await fetch('/admin/api', {
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
				alert(`Successfully advanced ${studentIds.length} student(s) to Session ${cohort.current_session}`);
				selectedStudents = new Set();
				await loadStudents();
				await onUpdate();
			} else {
				alert('Failed to advance students: ' + result.message);
			}
		} catch (err) {
			console.error('Error advancing students:', err);
			alert('Failed to advance students');
		}
	}

	function startEditSession(student) {
		editingSession = { id: student.id, value: student.current_session };
	}

	async function saveEditSession() {
		if (!editingSession) return;

		try {
			const response = await fetch('/admin/api', {
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

			if (response.ok) {
				editingSession = null;
				await loadStudents();
				await onUpdate();
			}
		} catch (err) {
			console.error('Failed to update session:', err);
			alert('Failed to update session');
		}
	}

	function toggleDropdown(studentId) {
		openDropdown = openDropdown === studentId ? null : studentId;
	}

	// Helper function for reflection status display
	function getReflectionStatusDisplay(student) {
		if (!student.reflectionStatus) return '';
		return formatUserReflectionStatus(student.reflectionStatus.status, student.reflectionStatus.count);
	}

	const getRoleBadgeClass = (role) => {
		switch (role) {
			case 'admin': return 'bg-blue-100 text-blue-800';
			case 'hub_coordinator': return 'bg-purple-100 text-purple-800';
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
			admin: 'Admin',
			hub_coordinator: 'Hub Coordinator',
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
						onclick={advanceSelectedStudents}
						class="btn-primary-small"
					>
						<ArrowRight size={16} />
						Advance {studentsBehind.length} to Session {cohort.current_session}
					</button>
				{/if}
				{#if selectedStudents.size > 0 && Array.from(selectedStudents).some(id => students.find(s => s.id === id)?.canInvite)}
					<button
						onclick={sendInvitations}
						disabled={sendingInvitations}
						class="btn-primary-small"
					>
						<Mail size={16} />
						{sendingInvitations ? 'Sending...' : `Send Invitations (${selectedStudents.size})`}
					</button>
				{/if}
				<button onclick={onAddStudents} class="btn-primary-small">
					<Plus size={16} />
					Add Participants
				</button>
			</div>
		</div>

		{#if loadingStudents}
			<div class="empty-state">Loading participants...</div>
		{:else if students.length === 0}
			<div class="empty-state">No participants yet. Click "Add Participants" to get started.</div>
		{:else}
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
											{#if student.role === 'hub_coordinator'}
												<div class="hub-coordinator-badge">
													<Home size={12} />
													<span>Hub Coordinator</span>
												</div>
											{/if}
										</div>
									</div>
								</td>
								<td>{student.hubs?.name || '-'}</td>
								<td>
									{#if editingSession && editingSession.id === student.id}
										<div class="session-edit">
											<input
												type="number"
												bind:value={editingSession.value}
												min="1"
												max="8"
												class="table-input-small"
											/>
											<button onclick={saveEditSession} class="btn-icon-tiny success">
												<Check size={14} />
											</button>
											<button onclick={() => editingSession = null} class="btn-icon-tiny">
												<X size={14} />
											</button>
										</div>
									{:else}
										<div class="session-display" onclick={() => startEditSession(student)}>
											Session {student.current_session}
										</div>
									{/if}
								</td>
								<td>
									<span class="attendance-display">
										{student.attendanceCount}/{cohort.current_session}
									</span>
								</td>
								<td>
									{#if student.reflectionStatus}
										<span class="badge {getStatusBadgeClass(student.reflectionStatus.status)}">
											{getReflectionStatusDisplay(student)}
										</span>
									{:else}
										<span class="text-gray-400">-</span>
									{/if}
								</td>
								<td class="actions-dropdown">
									<button onclick={() => toggleDropdown(student.id)} class="btn-icon">
										<MoreVertical size={16} />
									</button>
									{#if openDropdown === student.id}
										<div class="dropdown-menu">
											{#if student.canEdit}
												<button onclick={() => { startEditStudent(student); openDropdown = null; }} class="dropdown-item">
													<Edit2 size={14} />
													Edit Details
												</button>
												<button onclick={() => { deleteStudent(student.id); openDropdown = null; }} class="dropdown-item danger">
													<Trash2 size={14} />
													Remove
												</button>
											{:else}
												<button onclick={() => { /* TODO: View profile */ openDropdown = null; }} class="dropdown-item">
													View Profile
												</button>
												<button onclick={() => { /* TODO: Send message */ openDropdown = null; }} class="dropdown-item">
													Send Message
												</button>
											{/if}
										</div>
									{/if}
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
														<option value="hub_coordinator">Hub Coordinator</option>
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
		{/if}
	</div>
</div>

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

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.form-group label {
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--course-accent-darkest);
	}

	.section-edit .form-group label {
		color: rgba(255, 255, 255, 0.8);
	}

	.form-group input,
	.form-group select {
		padding: 10px 12px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		font-size: 0.9375rem;
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.section .form-group input,
	.section .form-group select {
		border: 1px solid var(--course-surface);
		background: white;
		color: var(--course-accent-darkest);
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--course-accent-light);
		background: rgba(255, 255, 255, 0.15);
	}

	.section .form-group input:focus,
	.section .form-group select:focus {
		background: white;
	}

	.readonly-field {
		padding: 10px 12px;
		background: var(--course-surface);
		border: 1px solid var(--course-surface);
		border-radius: 6px;
		color: var(--course-accent-dark);
	}

	.table-wrapper {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
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

	tr:hover:not(.editing) {
		background: var(--course-surface);
	}

	tr.editing {
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
	}

	.btn-icon:hover {
		background: var(--course-surface);
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
		padding: 4px 8px;
		border-radius: 4px;
		transition: background 0.2s ease;
		display: inline-block;
	}

	.session-display:hover {
		background: var(--course-surface);
	}

	.session-edit {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.table-input-small {
		width: 60px;
		padding: 4px 8px;
		border: 1px solid var(--course-accent-light);
		border-radius: 4px;
		font-size: 0.875rem;
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
	}

	.dropdown-menu {
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: 4px;
		background: white;
		border: 1px solid var(--course-surface);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 160px;
		z-index: 10;
		overflow: hidden;
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
