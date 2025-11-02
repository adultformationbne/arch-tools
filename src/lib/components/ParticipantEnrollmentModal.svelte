<script>
	import { createEventDispatcher } from 'svelte';
	import { X, UserPlus, Upload, Users } from 'lucide-svelte';
	import CsvUpload from './CsvUpload.svelte';

	let { cohort = null, show = false, courseSlug, onClose = () => {} } = $props();

	const dispatch = createEventDispatcher();

	let mode = $state('choice'); // 'choice', 'single', 'bulk'
	let isLoading = $state(false);
	let error = $state('');
	let uploadResult = $state(null);

	// Single participant form
	let participantData = $state({
		full_name: '',
		email: '',
		role: 'student',
		hub: ''
	});

	function selectMode(selectedMode) {
		mode = selectedMode;
		error = '';
	}

	function goBack() {
		if (mode === 'single' || mode === 'bulk') {
			mode = 'choice';
			error = '';
			uploadResult = null;
		}
	}

	async function handleSingleParticipant() {
		if (!participantData.full_name || !participantData.email) {
			error = 'Name and email are required';
			return;
		}

		isLoading = true;
		error = '';

		try {
			const response = await fetch('/courses/${courseSlug}/admin/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'upload_csv',
					filename: 'single-participant.csv',
					cohortId: cohort.id,
					data: [{
						...participantData
					}]
				})
			});

			const result = await response.json();

			if (result.success) {
				dispatch('complete', { cohortId: cohort.id });
				handleClose();
			} else {
				error = result.message || 'Failed to add participant';
			}
		} catch (err) {
			console.error('Error adding participant:', err);
			error = 'Failed to add participant. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	async function handleCsvUpload(csvData) {
		isLoading = true;
		error = '';

		try {
			const response = await fetch('/courses/${courseSlug}/admin/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'upload_csv',
					filename: csvData.filename,
					cohortId: cohort.id,
					data: csvData.data
				})
			});

			const result = await response.json();

			if (result.success) {
				uploadResult = result.data;
				// Auto-close after 2 seconds on success
				setTimeout(() => {
					dispatch('complete', { cohortId: cohort.id });
					handleClose();
				}, 2000);
			} else {
				error = result.message || 'Upload failed';
			}
		} catch (err) {
			console.error('Upload error:', err);
			error = 'Upload failed. Please try again.';
		} finally {
			isLoading = false;
		}
	}

	function handleClose() {
		mode = 'choice';
		participantData = { full_name: '', email: '', role: 'student', hub: '' };
		error = '';
		uploadResult = null;
		isLoading = false;
		onClose();
	}
</script>

{#if show}
	<div
		class="modal-overlay"
		onclick={handleClose}
		onkeydown={(event) => {
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				handleClose();
			}
		}}
		role="button"
		tabindex="0"
		aria-label="Close enrollment modal"
	>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="modal-header">
				<div>
					<h2>Add Participants</h2>
					{#if cohort}
						<p class="cohort-name">{cohort.name}</p>
					{/if}
				</div>
				<button type="button" onclick={handleClose} class="close-button">
					<X size={24} />
				</button>
			</div>

			<!-- Choice Mode -->
			{#if mode === 'choice'}
				<div class="modal-body">
					<p class="intro-text">Choose how you'd like to add participants to this cohort:</p>

					<div class="choice-grid">
						<button type="button" onclick={() => selectMode('single')} class="choice-card">
							<UserPlus size={48} color="var(--course-accent-darkest)" />
							<h3>Add Single Participant</h3>
							<p>Manually enter participant information</p>
						</button>

						<button type="button" onclick={() => selectMode('bulk')} class="choice-card">
							<Users size={48} color="var(--course-accent-darkest)" />
							<h3>Bulk Upload</h3>
							<p>Import multiple participants via CSV</p>
						</button>
					</div>
				</div>
			{/if}

			<!-- Single Participant Mode -->
			{#if mode === 'single'}
				<div class="modal-body">
					<button type="button" onclick={goBack} class="back-link">
						← Back to options
					</button>

					<form onsubmit={(e) => { e.preventDefault(); handleSingleParticipant(); }}>
						<div class="form-group">
							<label>Full Name*</label>
							<input
								type="text"
								bind:value={participantData.full_name}
								placeholder="John Smith"
								required
							/>
						</div>

						<div class="form-group">
							<label>Email*</label>
							<input
								type="email"
								bind:value={participantData.email}
								placeholder="john.smith@example.com"
								required
							/>
						</div>

						<div class="form-group">
							<label>Role</label>
							<select bind:value={participantData.role}>
								<option value="student">Participant</option>
								<option value="hub_coordinator">Hub Coordinator</option>
								<option value="admin">Admin</option>
							</select>
						</div>

						<div class="form-group">
							<label>Hub (Optional)</label>
							<input
								type="text"
								bind:value={participantData.hub}
								placeholder="St. Mary's Parish"
							/>
						</div>

						{#if error}
							<div class="error-message">{error}</div>
						{/if}

						<div class="modal-actions">
							<button type="button" onclick={handleClose} class="btn-secondary">
								Cancel
							</button>
							<button type="submit" class="btn-primary" disabled={isLoading}>
								{isLoading ? 'Adding...' : 'Add Participant'}
							</button>
						</div>
					</form>
				</div>
			{/if}

			<!-- Bulk Upload Mode -->
			{#if mode === 'bulk'}
				<div class="modal-body">
					<button type="button" onclick={goBack} class="back-link">
						← Back to options
					</button>

					<CsvUpload onUpload={handleCsvUpload} />

					{#if uploadResult}
						<div class="upload-result">
							<p class="success-text">
								<strong>{uploadResult.successful}</strong> participants added successfully
							</p>

							{#if uploadResult.errors > 0}
								<p class="error-text">
									<strong>{uploadResult.errors}</strong> {uploadResult.errors === 1 ? 'error' : 'errors'}
								</p>

								{#if uploadResult.errorDetails && uploadResult.errorDetails.length > 0}
									<div class="error-details">
										<ul>
											{#each uploadResult.errorDetails as errorDetail}
												<li>{errorDetail}</li>
											{/each}
										</ul>
									</div>
								{/if}
							{/if}

							<p class="closing-text">Closing automatically...</p>
						</div>
					{/if}

					{#if error}
						<div class="error-message">{error}</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 20px;
	}

	.modal-content {
		background: white;
		border-radius: 16px;
		max-width: 700px;
		width: 100%;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 32px 32px 24px 32px;
		border-bottom: 1px solid var(--course-surface);
	}

	.modal-header h2 {
		margin: 0 0 8px 0;
		font-weight: 700;
		font-size: 2rem;
		color: var(--course-accent-darkest);
	}

	.cohort-name {
		margin: 0;
		color: var(--course-accent-light);
		font-weight: 600;
	}

	.close-button {
		padding: 8px;
		border: none;
		background: transparent;
		color: var(--course-accent-dark);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.close-button:hover {
		background: var(--course-surface);
	}

	.modal-body {
		padding: 32px;
		overflow-y: auto;
		flex: 1;
	}

	.intro-text {
		margin: 0 0 24px 0;
		color: var(--course-accent-dark);
		text-align: center;
	}

	.choice-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.choice-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 32px 24px;
		border: 2px solid var(--course-surface);
		background: var(--course-surface-elevated, var(--course-surface));
		color: var(--course-accent-darkest);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: center;
	}

	.choice-card:focus {
		outline: 2px solid var(--course-accent-light);
		outline-offset: 2px;
	}

	.choice-card :global(svg) {
		color: var(--course-accent-dark);
	}

	.choice-card:hover {
		border-color: var(--course-accent-light);
		background: var(--course-surface-strong, var(--course-surface));
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.choice-card h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--course-accent-darkest);
	}

	.choice-card p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--course-accent-dark);
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-bottom: 24px;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: var(--course-accent-light);
		font-weight: 600;
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.back-link:hover {
		background: var(--course-surface);
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 600;
		color: var(--course-accent-darkest);
		font-size: 0.875rem;
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 12px;
		border: 1px solid var(--course-surface);
		border-radius: 8px;
		font-size: 1rem;
		transition: border-color 0.2s ease;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--course-accent-light);
	}

	.upload-result {
		margin-top: 24px;
		padding: 20px;
		background: var(--course-surface);
		border-radius: 8px;
	}

	.success-text {
		color: #28a745;
		margin-bottom: 12px;
	}

	.error-text {
		color: #dc3545;
		margin-bottom: 8px;
	}

	.error-details {
		margin-top: 12px;
		padding: 12px;
		background: #fff5f5;
		border-radius: 6px;
		border: 1px solid #fcc;
	}

	.error-details ul {
		margin: 0;
		padding-left: 20px;
		font-size: 0.875rem;
		color: #dc3545;
	}

	.error-details li {
		margin: 4px 0;
	}

	.closing-text {
		margin-top: 12px;
		font-size: 0.875rem;
		color: var(--course-accent-dark);
		font-style: italic;
		text-align: center;
	}

	.error-message {
		padding: 12px 16px;
		margin-bottom: 16px;
		background: #fee;
		color: #c00;
		border: 1px solid #fcc;
		border-radius: 8px;
		font-size: 0.875rem;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		padding-top: 24px;
		border-top: 1px solid var(--course-surface);
		margin-top: 24px;
	}

	.btn-primary,
	.btn-secondary {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 12px 24px;
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
	}

	.btn-primary {
		flex: 1;
		background: var(--course-accent-light);
		color: var(--course-accent-darkest);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--course-accent-dark);
		color: white;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: transparent;
		color: var(--course-accent-dark);
		border: 1px solid var(--course-surface);
	}

	.btn-secondary:hover {
		background: var(--course-surface);
	}
</style>
