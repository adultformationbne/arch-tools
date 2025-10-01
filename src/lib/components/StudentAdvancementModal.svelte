<script>
	import { Mail, ArrowRight } from 'lucide-svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import { apiPost } from '$lib/utils/api-handler.js';

	let { cohort, students, show = $bindable(false), onComplete } = $props();

	let selectedSession = $state((cohort?.current_session || 0) + 1);
	let selectedStudents = $state([]);
	let sendEmail = $state(true);
	let isProcessing = $state(false);

	// Filter students who haven't reached the target session yet
	const eligibleStudents = $derived(
		students?.filter((s) => s.current_session < selectedSession && s.status === 'active') || []
	);

	const allSelected = $derived(
		eligibleStudents.length > 0 && selectedStudents.length === eligibleStudents.length
	);

	function toggleSelectAll() {
		if (allSelected) {
			selectedStudents = [];
		} else {
			selectedStudents = eligibleStudents.map((s) => s.id);
		}
	}

	async function advanceStudents() {
		if (selectedStudents.length === 0) {
			toastError('Please select at least one student');
			return;
		}

		isProcessing = true;
		try {
			await apiPost(
				'/admin/api',
				{
					action: 'advance_students',
					cohortId: cohort.id,
					studentIds: selectedStudents,
					targetSession: selectedSession,
					sendEmail
				},
				{
					loadingMessage: 'Advancing students...',
					successMessage: `Advanced ${selectedStudents.length} students to Session ${selectedSession}`
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

	// Reset selected session when modal opens
	$effect(() => {
		if (show && cohort) {
			selectedSession = (cohort.current_session || 0) + 1;
			selectedStudents = [];
		}
	});
</script>

{#if show}
	<div class="modal-overlay" onclick={closeModal}>
		<div class="modal" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Advance Students to Session {selectedSession}</h2>
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
						{#each [2, 3, 4, 5, 6, 7, 8] as session}
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
								Select All ({eligibleStudents.length} eligible)
							</span>
						</label>
					</div>

					<div class="student-list">
						{#if eligibleStudents.length === 0}
							<p class="empty-message">No students eligible for Session {selectedSession}</p>
						{:else}
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

				<label class="checkbox-label email-option">
					<input type="checkbox" bind:checked={sendEmail} disabled={isProcessing} />
					<Mail size={18} />
					<span>Send "Session {selectedSession} Available" email notification</span>
				</label>
			</div>

			<div class="modal-actions">
				<button onclick={closeModal} class="btn-secondary" disabled={isProcessing}>
					Cancel
				</button>
				<button
					onclick={advanceStudents}
					disabled={selectedStudents.length === 0 || isProcessing}
					class="btn-primary"
				>
					{#if isProcessing}
						Processing...
					{:else}
						<ArrowRight size={18} />
						Advance {selectedStudents.length} Students
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
		color: var(--accf-darkest, #1e2322);
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
		color: var(--accf-darkest);
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
		color: var(--accf-dark, #334642);
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
		border-color: var(--accf-accent, #c59a6b);
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
		color: var(--accf-dark);
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
		color: var(--accf-darkest);
	}

	.student-meta {
		font-size: 0.875rem;
		color: #6b7280;
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
		background: var(--accf-accent, #c59a6b);
		color: var(--accf-darkest, #1e2322);
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
		color: var(--accf-dark, #334642);
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f9fafb;
		border-color: var(--accf-accent);
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>