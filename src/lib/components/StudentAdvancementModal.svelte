<script>
	import { Mail, ArrowRight, Settings, Home } from '$lib/icons';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import { apiPost } from '$lib/utils/api-handler.js';

	let {
		cohort,
		students,
		show = $bindable(false),
		onComplete,
		courseSlug,
		// Optional: pre-select specific student IDs when modal opens
		initialSelectedIds = []
	} = $props();

	let selectedSession = $state((cohort?.current_session || 0) + 1);
	let selectedStudents = $state([]);
	let sendEmail = $state(true);
	let isProcessing = $state(false);

	// Filter eligible enrollments by session and status
	const eligibleEnrollments = $derived(
		students?.filter((s) => s.current_session < selectedSession && s.status === 'active') || []
	);

	// Separate coordinators from students - coordinators are always auto-selected
	const eligibleCoordinators = $derived(
		eligibleEnrollments.filter((s) => s.role === 'coordinator')
	);
	const eligibleStudents = $derived(
		eligibleEnrollments.filter((s) => s.role !== 'coordinator')
	);

	// Coordinator IDs are always included
	const coordinatorIds = $derived(eligibleCoordinators.map((c) => c.id));

	// All selected = all students selected (coordinators are always included separately)
	const allSelected = $derived(
		eligibleStudents.length > 0 && selectedStudents.length === eligibleStudents.length
	);

	// Combined IDs for advancement (selected students + all coordinators)
	const allSelectedIds = $derived([...selectedStudents, ...coordinatorIds]);

	function toggleSelectAll() {
		if (allSelected) {
			selectedStudents = [];
		} else {
			selectedStudents = eligibleStudents.map((s) => s.id);
		}
	}

	async function advanceStudents() {
		if (allSelectedIds.length === 0) {
			toastError('Please select at least one student');
			return;
		}

		isProcessing = true;
		try {
			await apiPost(
				`/admin/courses/${courseSlug}/api`,
				{
					action: 'advance_students',
					cohortId: cohort.id,
					studentIds: allSelectedIds,
					targetSession: selectedSession,
					sendEmail
				},
				{
					loadingMessage: 'Advancing participants...',
					successMessage: `Advanced ${allSelectedIds.length} participant${allSelectedIds.length === 1 ? '' : 's'} to Session ${selectedSession}`
				}
			);

			// Reset and close
			selectedStudents = [];
			show = false;
			onComplete?.();
		} catch (err) {
			console.error('Error advancing students:', err);
		} finally {
			isProcessing = false;
		}
	}

	function closeModal() {
		if (!isProcessing) {
			show = false;
			selectedStudents = [];
		}
	}

	// Reset selected session when modal opens, pre-select students if provided
	$effect(() => {
		if (show && cohort) {
			selectedSession = (cohort.current_session || 0) + 1;

			// If initialSelectedIds provided, pre-select eligible students from that list
			if (initialSelectedIds && initialSelectedIds.length > 0) {
				// Filter to only include IDs that are eligible students (not coordinators)
				const eligibleStudentIds = eligibleStudents.map(s => s.id);
				selectedStudents = initialSelectedIds.filter(id => eligibleStudentIds.includes(id));
			} else {
				selectedStudents = [];
			}
		}
	});
</script>

{#if show}
	<div class="modal-overlay" onmousedown={(e) => e.target === e.currentTarget && closeModal()} onkeydown={(e) => e.key === 'Enter' && !isProcessing && closeModal()} role="presentation">
		<div class="modal" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && !isProcessing && closeModal()} role="dialog" aria-modal="true" aria-labelledby="advancement-title" tabindex="-1">
			<div class="modal-header">
				<h2 id="advancement-title">Advance Students to Session {selectedSession}</h2>
				<button onclick={closeModal} class="close-button" disabled={isProcessing}>×</button>
			</div>

			<div class="modal-content">
				<div class="form-group">
					<label for="target-session">Target Session</label>
					<select
						id="target-session"
						bind:value={selectedSession}
						class="session-select"
						disabled={isProcessing}
					>
						{#each [1, 2, 3, 4, 5, 6, 7, 8] as session}
							<option value={session}>Session {session}</option>
						{/each}
					</select>
				</div>

				<div class="student-selection">
					<div class="selection-header">
						<label class="checkbox-label">
							<input
								type="checkbox"
								checked={allSelected}
								onchange={toggleSelectAll}
								disabled={isProcessing || eligibleStudents.length === 0}
							/>
							<span class="select-all-text">
								Select All Students ({eligibleStudents.length} eligible)
							</span>
						</label>
					</div>

					<div class="student-list">
						{#if eligibleEnrollments.length === 0}
							<p class="empty-message">No participants eligible for Session {selectedSession}</p>
						{:else}
							<!-- Coordinators first - always selected, shown greyed out -->
							{#each eligibleCoordinators as coordinator}
								<div class="student-checkbox coordinator-row">
									<input
										type="checkbox"
										checked={true}
										disabled={true}
									/>
									<span class="student-info">
										<span class="student-name coordinator-name">
											{coordinator.full_name}
											<span class="coordinator-badge">
												<Home size={12} />
												Coordinator
											</span>
										</span>
										<span class="student-meta"
											>Currently on Session {coordinator.current_session} · Auto-included</span
										>
									</span>
								</div>
							{/each}
							<!-- Regular students -->
							{#each eligibleStudents as student}
								<label class="student-checkbox">
									<input
										type="checkbox"
										bind:group={selectedStudents}
										value={student.id}
										disabled={isProcessing}
									/>
									<span class="student-info">
										<span class="student-name">{student.full_name}</span>
										<span class="student-meta"
											>Currently on Session {student.current_session}</span
										>
									</span>
								</label>
							{/each}
						{/if}
					</div>
				</div>

				<div class="flex flex-col gap-2">
					<label class="checkbox-label email-option">
						<input type="checkbox" bind:checked={sendEmail} disabled={isProcessing} />
						<Mail size={18} />
						<span>Send "Session {selectedSession} Available" email notification</span>
					</label>
					<a
						href="/admin/courses/{courseSlug}/emails"
						target="_blank"
						class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:underline pl-3"
						title="Edit the Session Materials Ready template"
					>
						<Settings size={14} />
						<span>Edit email template</span>
					</a>
				</div>
			</div>

			<div class="modal-actions">
				<button onclick={closeModal} class="btn-secondary" disabled={isProcessing}>
					Cancel
				</button>
				<button
					onclick={advanceStudents}
					disabled={allSelectedIds.length === 0 || isProcessing}
					class="btn-primary"
				>
					{#if isProcessing}
						Processing...
					{:else}
						<ArrowRight size={18} />
						Advance {allSelectedIds.length} Participant{allSelectedIds.length === 1 ? '' : 's'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: white;
		border-radius: 12px;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--course-accent-darkest, #1e2322);
		margin: 0;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 2rem;
		color: #6b7280;
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover:not(:disabled) {
		background: #f3f4f6;
		color: var(--course-accent-darkest);
	}

	.close-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-content {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		font-weight: 500;
		color: var(--course-accent-dark, #334642);
		margin-bottom: 0.5rem;
	}

	.session-select {
		width: 100%;
		padding: 0.625rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.9375rem;
		background: white;
		cursor: pointer;
	}

	.session-select:focus {
		outline: none;
		border-color: var(--course-accent-light, #c59a6b);
		box-shadow: 0 0 0 3px rgba(197, 154, 107, 0.1);
	}

	.session-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.student-selection {
		margin-bottom: 1.5rem;
	}

	.selection-header {
		padding: 0.75rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px 8px 0 0;
	}

	.select-all-text {
		font-weight: 500;
		color: var(--course-accent-dark);
	}

	.student-list {
		border: 1px solid #e5e7eb;
		border-top: none;
		border-radius: 0 0 8px 8px;
		max-height: 300px;
		overflow-y: auto;
	}

	.student-checkbox,
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.student-checkbox {
		padding: 0.75rem;
		border-bottom: 1px solid #f3f4f6;
		transition: background 0.2s;
	}

	.student-checkbox:hover {
		background: #f9fafb;
	}

	.student-checkbox:last-child {
		border-bottom: none;
	}

	.student-checkbox input,
	.checkbox-label input {
		cursor: pointer;
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}

	.student-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.student-name {
		font-weight: 500;
		color: var(--course-accent-darkest);
	}

	.student-meta {
		font-size: 0.875rem;
		color: #6b7280;
	}

	/* Coordinator styling */
	.coordinator-row {
		background: #f9fafb;
		opacity: 0.75;
		cursor: default;
	}

	.coordinator-row:hover {
		background: #f9fafb;
	}

	.coordinator-row input {
		cursor: default;
		accent-color: #9ca3af;
	}

	.coordinator-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.coordinator-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: #7c3aed;
		background: #ede9fe;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}

	.empty-message {
		padding: 2rem;
		text-align: center;
		color: #9ca3af;
		font-style: italic;
	}

	.email-option {
		padding: 0.75rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		font-size: 0.9375rem;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		padding: 1.5rem;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
		border-radius: 0 0 12px 12px;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		font-weight: 500;
		font-size: 0.9375rem;
		cursor: pointer;
		transition: all 0.2s;
		border: none;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: center;
	}

	.btn-primary {
		background: var(--course-accent-light, #c59a6b);
		color: var(--course-accent-darkest, #1e2322);
		flex: 1;
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	.btn-secondary {
		background: white;
		color: var(--course-accent-dark, #334642);
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f9fafb;
		border-color: var(--course-accent-light);
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>