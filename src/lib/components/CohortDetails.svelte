<script>
	import { BookOpen, Calendar, Edit2, FileText, Trash2, Save, X, ChevronRight, MoreVertical } from 'lucide-svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let {
		cohort,
		modules = [],
		onUpdate = () => {},
		onDelete = () => {}
	} = $props();

	let editingCohort = $state(false);
	let showSessionModal = $state(false);
	let updatingSession = $state(false);
	let showDropdown = $state(false);
	let cohortForm = $state({
		name: cohort.name,
		moduleId: cohort.module_id || cohort.moduleId,
		startDate: cohort.start_date || cohort.startDate,
		endDate: cohort.end_date || cohort.endDate,
		currentSession: cohort.current_session || cohort.currentSession || 1
	});

	// Reset form when cohort changes
	$effect(() => {
		if (cohort) {
			cohortForm = {
				name: cohort.name,
				moduleId: cohort.module_id || cohort.moduleId,
				startDate: cohort.start_date || cohort.startDate,
				endDate: cohort.end_date || cohort.endDate,
				currentSession: cohort.current_session || cohort.currentSession || 1
			};
		}
	});

	async function saveCohortEdits() {
		try {
			const response = await fetch('/admin/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_cohort',
					cohortId: cohort.id,
					...cohortForm
				})
			});

			if (response.ok) {
				editingCohort = false;
				await onUpdate();
			} else {
				alert('Failed to update cohort');
			}
		} catch (err) {
			console.error('Failed to update cohort:', err);
			alert('Failed to update cohort');
		}
	}

	function openSessionModal() {
		const currentSession = cohort.current_session || cohort.currentSession || 1;
		if (currentSession >= 8) {
			toastError('Already at final session');
			return;
		}
		showSessionModal = true;
	}

	async function confirmAdvanceSession() {
		const currentSession = cohort.current_session || cohort.currentSession || 1;
		const nextSession = Math.min(currentSession + 1, 8);

		updatingSession = true;
		try {
			const response = await fetch('/admin/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_cohort',
					cohortId: cohort.id,
					currentSession: nextSession
				})
			});

			const result = await response.json();

			if (response.ok) {
				toastSuccess(`Cohort advanced to Session ${nextSession}`);
				await onUpdate();
				showSessionModal = false;
			} else {
				toastError(result.message || 'Failed to advance session');
			}
		} catch (err) {
			console.error('Failed to advance session:', err);
			toastError('Failed to advance session');
		} finally {
			updatingSession = false;
		}
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

{#if !editingCohort}
	<div class="details-header">
		<div class="details-content">
			<h2>{cohortForm.name}</h2>
			<div class="details-grid">
				<div class="detail-item">
					<BookOpen size={18} />
					<span class="detail-label">Module</span>
					<span class="detail-value">{cohort.module || `Module ${cohort.module_id || cohort.moduleId}`}</span>
				</div>
				<div class="detail-item">
					<Calendar size={18} />
					<span class="detail-label">Start Date</span>
					<span class="detail-value">{formatDate(cohort.start_date || cohort.startDate)}</span>
				</div>
				<div class="detail-item">
					<Calendar size={18} />
					<span class="detail-label">End Date</span>
					<span class="detail-value">{formatDate(cohort.end_date || cohort.endDate)}</span>
				</div>
				<div class="detail-item">
					<BookOpen size={18} />
					<span class="detail-label">Current Session</span>
					<span class="detail-value">Session {cohort.current_session || cohort.currentSession || 1} of 8</span>
				</div>
			</div>
		</div>
		<div class="details-actions">
			{#if (cohort.current_session || cohort.currentSession || 1) < 8}
				<button
					onclick={openSessionModal}
					class="btn-icon-glassy primary"
				>
					<ChevronRight size={18} />
					<span>Set Current Session to {(cohort.current_session || cohort.currentSession || 1) + 1}</span>
				</button>
			{/if}

			<div class="dropdown-container">
				<button
					onclick={() => showDropdown = !showDropdown}
					class="btn-icon-glassy"
					aria-label="More options"
				>
					<MoreVertical size={18} />
				</button>

				{#if showDropdown}
					<div class="dropdown-menu">
						<button onclick={() => { editingCohort = true; showDropdown = false; }} class="dropdown-item">
							<Edit2 size={16} />
							<span>Edit Cohort</span>
						</button>
						<a href="/admin/materials/{cohort.id}" class="dropdown-item" onclick={() => showDropdown = false}>
							<FileText size={16} />
							<span>Manage Materials</span>
						</a>
						<button onclick={() => { onDelete(); showDropdown = false; }} class="dropdown-item danger">
							<Trash2 size={16} />
							<span>Delete Cohort</span>
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{:else}
	<!-- Edit Form -->
	<div class="section-edit">
		<div class="section-header">
			<h2>Edit Cohort Details</h2>
			<div class="header-actions">
				<button onclick={saveCohortEdits} class="btn-icon-glassy success">
					<Save size={18} />
					<span>Save</span>
				</button>
				<button onclick={() => (editingCohort = false)} class="btn-icon-glassy">
					<X size={18} />
					<span>Cancel</span>
				</button>
			</div>
		</div>

		<div class="settings-grid">
			<div class="form-group">
				<label>Cohort Name</label>
				<input type="text" bind:value={cohortForm.name} />
			</div>

			<div class="form-group">
				<label>Module</label>
				<select bind:value={cohortForm.moduleId}>
					{#each modules as module}
						<option value={module.id}>{module.name}</option>
					{/each}
				</select>
			</div>

			<div class="form-group">
				<label>Start Date</label>
				<input type="date" bind:value={cohortForm.startDate} />
			</div>

			<div class="form-group">
				<label>End Date</label>
				<input type="date" bind:value={cohortForm.endDate} />
			</div>

			<div class="form-group">
				<label>Current Session</label>
				<select bind:value={cohortForm.currentSession}>
					<option value={1}>Session 1</option>
					<option value={2}>Session 2</option>
					<option value={3}>Session 3</option>
					<option value={4}>Session 4</option>
					<option value={5}>Session 5</option>
					<option value={6}>Session 6</option>
					<option value={7}>Session 7</option>
					<option value={8}>Session 8</option>
				</select>
			</div>
		</div>
	</div>
{/if}

<!-- Session Advancement Modal -->
<ConfirmationModal
	show={showSessionModal}
	title="Advance Cohort Session"
	loading={updatingSession}
	loadingMessage="Advancing Session..."
	confirmText="Advance to Session {(cohort.current_session || cohort.currentSession || 1) + 1}"
	confirmIcon={ChevronRight}
	onConfirm={confirmAdvanceSession}
	onCancel={() => showSessionModal = false}
>
	{#snippet children()}
		<p>
			You are about to set the current session for <strong>{cohort.name}</strong> to Session {(cohort.current_session || cohort.currentSession || 1) + 1}.
		</p>
		<p class="modal-note">
			<strong>Note:</strong> Participants will not be able to see Session {(cohort.current_session || cohort.currentSession || 1) + 1} materials until you manually advance them to this session. Setting the cohort session only controls what content is available—individual participant progression must be managed separately.
		</p>
	{/snippet}
</ConfirmationModal>

<style>
	.details-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 32px;
		padding: 32px 0;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.details-content {
		flex: 1;
	}

	.details-content h2 {
		margin: 0 0 24px 0;
		font-size: 2.25rem;
		font-weight: 700;
		color: white;
	}

	.details-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 24px;
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 8px;
		color: rgba(255, 255, 255, 0.8);
	}

	.detail-item :global(svg) {
		color: var(--accf-accent, #c59a6b);
		margin-bottom: 4px;
	}

	.detail-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.6);
	}

	.detail-value {
		font-size: 1.125rem;
		font-weight: 600;
		color: white;
	}

	.details-actions {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.dropdown-container {
		position: relative;
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		min-width: 200px;
		background: rgba(30, 35, 34, 0.98);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
		z-index: 100;
		overflow: hidden;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 12px 16px;
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.9);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		text-align: left;
		text-decoration: none;
		transition: background 0.2s ease;
	}

	.dropdown-item:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	.dropdown-item.danger {
		color: #fca5a5;
	}

	.dropdown-item.danger:hover {
		background: rgba(239, 68, 68, 0.15);
	}

	.dropdown-item :global(svg) {
		flex-shrink: 0;
	}

	.btn-icon-glassy {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 12px;
		color: white;
		font-weight: 600;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
	}

	.btn-icon-glassy:hover {
		background: rgba(255, 255, 255, 0.15);
		border-color: rgba(197, 154, 107, 0.5);
		transform: translateY(-1px);
	}

	.btn-icon-glassy.primary {
		background: rgba(197, 154, 107, 0.2);
		border-color: rgba(197, 154, 107, 0.4);
		color: var(--accf-accent, #c59a6b);
		font-weight: 700;
	}

	.btn-icon-glassy.primary:hover {
		background: rgba(197, 154, 107, 0.3);
		border-color: rgba(197, 154, 107, 0.6);
	}

	.btn-icon-glassy.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-icon-glassy.success {
		background: rgba(16, 185, 129, 0.15);
		border-color: rgba(16, 185, 129, 0.3);
		color: #6ee7b7;
	}

	.btn-icon-glassy.success:hover {
		background: rgba(16, 185, 129, 0.25);
		border-color: rgba(16, 185, 129, 0.5);
	}

	.btn-icon-glassy.danger {
		background: rgba(239, 68, 68, 0.15);
		border-color: rgba(239, 68, 68, 0.3);
		color: #fca5a5;
	}

	.btn-icon-glassy.danger:hover {
		background: rgba(239, 68, 68, 0.25);
		border-color: rgba(239, 68, 68, 0.5);
	}

	/* Edit Form Styles */
	.section-edit {
		background: rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		padding: 24px;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.section-header h2 {
		margin: 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: white;
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
		font-size: 0.875rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.8);
	}

	.form-group input,
	.form-group select {
		padding: 10px 12px;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		font-size: 0.9375rem;
		background: rgba(255, 255, 255, 0.05);
		color: white;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--accf-accent, #c59a6b);
		background: rgba(255, 255, 255, 0.1);
	}

	/* Modal note styling (used in snippet) */
	:global(.modal-note) {
		background: rgba(197, 154, 107, 0.1);
		border-left: 3px solid var(--accf-accent, #c59a6b);
		padding: 12px 16px;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	@media (max-width: 768px) {
		.details-header {
			flex-direction: column;
		}

		.details-actions {
			flex-direction: row;
			width: 100%;
		}

		.btn-icon-glassy {
			flex: 1;
			justify-content: center;
		}

		.details-grid {
			grid-template-columns: 1fr;
		}

		.settings-grid {
			grid-template-columns: 1fr;
		}
	}
</style>