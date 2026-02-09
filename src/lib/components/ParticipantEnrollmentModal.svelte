<script>
	import { X, UserPlus, Upload, Users, AlertTriangle } from '$lib/icons';
	import CsvUpload from './CsvUpload.svelte';

	let { cohort = null, show = false, courseSlug, onClose = () => {}, onComplete = () => {} } = $props();

	let mode = $state('choice'); // 'choice', 'single', 'bulk', 'conflicts'
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

	// Conflict resolution state
	let conflicts = $state([]);
	let conflictResolutions = $state({});
	let pendingCsvData = $state(null);

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
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
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
				onComplete({ cohortId: cohort.id });
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

	async function handleCsvUpload(csvData, resolvedConflicts = null) {
		isLoading = true;
		error = '';

		try {
			const requestBody = {
				action: 'upload_csv',
				filename: csvData.filename,
				cohortId: cohort.id,
				data: csvData.data
			};

			if (resolvedConflicts) {
				requestBody.resolvedConflicts = resolvedConflicts;
			}

			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			const result = await response.json();

			if (result.success) {
				// Check if we need to resolve conflicts first
				if (result.requiresConflictResolution) {
					conflicts = result.conflicts;
					pendingCsvData = csvData;
					// Initialize resolutions with 'skip' as default
					conflictResolutions = {};
					for (const conflict of result.conflicts) {
						conflictResolutions[conflict.email] = { action: 'skip', newEmail: '' };
					}
					mode = 'conflicts';
					isLoading = false;
					return;
				}

				uploadResult = result.data;
				// Auto-close after 2 seconds on success
				setTimeout(() => {
					onComplete({ cohortId: cohort.id });
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

	async function handleConflictResolution() {
		// Build resolved conflicts array
		const resolved = Object.entries(conflictResolutions).map(([email, resolution]) => ({
			email,
			action: resolution.action,
			newEmail: resolution.action === 'use_new_email' ? resolution.newEmail : undefined
		}));

		// Validate that all use_new_email have a valid email
		for (const r of resolved) {
			if (r.action === 'use_new_email' && !r.newEmail) {
				error = 'Please enter a new email for all "Use different email" selections';
				return;
			}
		}

		// Re-submit with resolutions
		await handleCsvUpload(pendingCsvData, resolved);
	}

	function updateResolution(email, field, value) {
		conflictResolutions[email] = {
			...conflictResolutions[email],
			[field]: value
		};
	}

	function handleClose() {
		mode = 'choice';
		participantData = { full_name: '', email: '', role: 'student', hub: '' };
		error = '';
		uploadResult = null;
		isLoading = false;
		conflicts = [];
		conflictResolutions = {};
		pendingCsvData = null;
		onClose();
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="modal-overlay"
		onclick={handleClose}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				handleClose();
			}
		}}
	>
		<div class="modal-content" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && handleClose()} role="dialog" aria-modal="true" aria-labelledby="enrollment-title" tabindex="-1">
			<!-- Header -->
			<div class="modal-header">
				<div>
					<h2 id="enrollment-title">Add Participants</h2>
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
							<UserPlus size={48} color="#1f2937" />
							<h3>Add Single Participant</h3>
							<p>Manually enter participant information</p>
						</button>

						<button type="button" onclick={() => selectMode('bulk')} class="choice-card">
							<Users size={48} color="#1f2937" />
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
							<label for="participant-name">Full Name*</label>
							<input
								id="participant-name"
								type="text"
								bind:value={participantData.full_name}
								placeholder="John Smith"
								required
							/>
						</div>

						<div class="form-group">
							<label for="participant-email">Email*</label>
							<input
								id="participant-email"
								type="email"
								bind:value={participantData.email}
								placeholder="john.smith@example.com"
								required
							/>
						</div>

						<div class="form-group">
							<label for="participant-role">Role</label>
							<select id="participant-role" bind:value={participantData.role}>
								<option value="student">Participant</option>
								<option value="coordinator">Hub Coordinator</option>
							</select>
						</div>

						<div class="form-group">
							<label for="participant-hub">Hub (Optional)</label>
							<input
								id="participant-hub"
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

			<!-- Conflict Resolution Mode -->
			{#if mode === 'conflicts'}
				<div class="modal-body">
					<div class="conflict-header">
						<AlertTriangle size={24} color="#d97706" />
						<div>
							<h3>Name Mismatch Detected</h3>
							<p>The following emails already exist in this cohort with different names. Please choose how to handle each conflict:</p>
						</div>
					</div>

					<div class="conflicts-list">
						{#each conflicts as conflict}
							<div class="conflict-item">
								<div class="conflict-info">
									<div class="conflict-email">{conflict.email}</div>
									<div class="conflict-names">
										<span class="name-label">CSV:</span>
										<span class="name-value csv-name">{conflict.csvName}</span>
										<span class="name-label">Existing:</span>
										<span class="name-value existing-name">{conflict.existingName}</span>
									</div>
								</div>

								<div class="conflict-actions">
									<label class="resolution-option">
										<input
											type="radio"
											name="resolution-{conflict.email}"
											value="skip"
											checked={conflictResolutions[conflict.email]?.action === 'skip'}
											onchange={() => updateResolution(conflict.email, 'action', 'skip')}
										/>
										<span>Skip this row</span>
									</label>

									<label class="resolution-option">
										<input
											type="radio"
											name="resolution-{conflict.email}"
											value="update_name"
											checked={conflictResolutions[conflict.email]?.action === 'update_name'}
											onchange={() => updateResolution(conflict.email, 'action', 'update_name')}
										/>
										<span>Update existing to "{conflict.csvName}"</span>
									</label>

									<label class="resolution-option">
										<input
											type="radio"
											name="resolution-{conflict.email}"
											value="use_new_email"
											checked={conflictResolutions[conflict.email]?.action === 'use_new_email'}
											onchange={() => updateResolution(conflict.email, 'action', 'use_new_email')}
										/>
										<span>Use different email:</span>
									</label>

									{#if conflictResolutions[conflict.email]?.action === 'use_new_email'}
										<input
											type="email"
											class="new-email-input"
											placeholder="Enter new email address"
											value={conflictResolutions[conflict.email]?.newEmail || ''}
											oninput={(e) => updateResolution(conflict.email, 'newEmail', e.target.value)}
										/>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					{#if error}
						<div class="error-message">{error}</div>
					{/if}

					<div class="modal-actions">
						<button type="button" onclick={handleClose} class="btn-secondary">
							Cancel
						</button>
						<button type="button" onclick={handleConflictResolution} class="btn-primary" disabled={isLoading}>
							{isLoading ? 'Processing...' : 'Continue Import'}
						</button>
					</div>
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
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0 0 8px 0;
		font-weight: 700;
		font-size: 2rem;
		color: #1f2937;
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
		color: #1f2937;
		cursor: pointer;
		border-radius: 8px;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-button:hover {
		background: #e5e7eb;
		color: var(--course-accent-dark);
	}

	.close-button:active {
		transform: scale(0.95);
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
		border: 2px solid #E5E7EB;
		background: #F9FAFB;
		color: #1f2937;
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
		background: white;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.choice-card h3 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
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
		color: var(--course-accent-dark);
		font-weight: 600;
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.back-link:hover {
		background: #F3F4F6;
		color: #1f2937;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.form-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 600;
		color: #1f2937;
		font-size: 0.875rem;
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 12px;
		border: 2px solid #D1D5DB;
		border-radius: 8px;
		font-size: 1rem;
		background: white;
		color: #1f2937;
		transition: all 0.2s ease;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--course-accent-light);
		background: white;
		box-shadow: 0 0 0 3px rgba(197, 154, 107, 0.1);
	}

	.form-group input::placeholder {
		color: #9CA3AF;
	}

	.upload-result {
		margin-top: 24px;
		padding: 20px;
		background: #e5e7eb;
		border-radius: 8px;
	}

	.success-text {
		color: #1f2937;
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
		border-top: 1px solid #e5e7eb;
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
		color: white;
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
		background: #f3f4f6;
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.btn-secondary:hover {
		background: #e5e7eb;
	}

	/* Conflict Resolution Styles */
	.conflict-header {
		display: flex;
		gap: 16px;
		align-items: flex-start;
		padding: 16px;
		background: #fffbeb;
		border: 1px solid #fcd34d;
		border-radius: 8px;
		margin-bottom: 24px;
	}

	.conflict-header h3 {
		margin: 0 0 4px 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #92400e;
	}

	.conflict-header p {
		margin: 0;
		font-size: 0.875rem;
		color: #a16207;
	}

	.conflicts-list {
		display: flex;
		flex-direction: column;
		gap: 16px;
		max-height: 400px;
		overflow-y: auto;
	}

	.conflict-item {
		padding: 16px;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
	}

	.conflict-info {
		margin-bottom: 12px;
	}

	.conflict-email {
		font-weight: 600;
		color: #1f2937;
		margin-bottom: 8px;
	}

	.conflict-names {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		font-size: 0.875rem;
	}

	.name-label {
		color: #6b7280;
	}

	.name-value {
		padding: 2px 8px;
		border-radius: 4px;
		font-weight: 500;
	}

	.csv-name {
		background: #dbeafe;
		color: #1e40af;
	}

	.existing-name {
		background: #fef3c7;
		color: #92400e;
	}

	.conflict-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.resolution-option {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: #374151;
		cursor: pointer;
	}

	.resolution-option input[type="radio"] {
		width: 16px;
		height: 16px;
		cursor: pointer;
	}

	.new-email-input {
		margin-left: 24px;
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 0.875rem;
		width: calc(100% - 24px);
		max-width: 300px;
	}

	.new-email-input:focus {
		outline: none;
		border-color: var(--course-accent-light);
		box-shadow: 0 0 0 3px rgba(197, 154, 107, 0.1);
	}
</style>
