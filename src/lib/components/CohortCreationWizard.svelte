<script>
	import { X, ChevronRight, ChevronLeft, Check } from '$lib/icons';
	import CsvUpload from './CsvUpload.svelte';
	import { toastError } from '$lib/utils/toast-helpers.js';

	let {
		modules = [],
		show = false,
		courseSlug,
		onClose = () => {},
		onComplete = () => {}
	} = $props();

	let currentStep = $state(1);
	let isLoading = $state(false);
	let createdCohortId = $state(null);

	// Step 1: Cohort Details
	let cohortData = $state({
		name: '',
		moduleId: '',
		startDate: '',
		// Pricing fields
		isFree: true,
		priceCents: null,
		currency: 'AUD',
		enrollmentType: 'admin_only'
	});

	// Step 2: Participants
	let uploadedUsers = $state([]);
	let uploadResult = $state(null);
	let error = $state('');

	function calculateEndDate(startDate) {
		const start = new Date(startDate);
		const end = new Date(start.getTime() + 8 * 7 * 24 * 60 * 60 * 1000); // 8 weeks
		return end.toISOString().split('T')[0];
	}

	async function createDraftCohort() {
		isLoading = true;
		try {
			const endDate = calculateEndDate(cohortData.startDate);

			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create_cohort',
					name: cohortData.name,
					moduleId: cohortData.moduleId,
					startDate: cohortData.startDate,
					endDate: endDate,
					// Pricing fields
					isFree: cohortData.isFree,
					priceCents: cohortData.isFree ? null : cohortData.priceCents,
					currency: cohortData.currency,
					enrollmentType: cohortData.enrollmentType
				})
			});

			if (!response.ok) {
				throw new Error('Failed to create cohort');
			}

			const result = await response.json();
			createdCohortId = result.data.id;

			// Move to step 2
			currentStep = 2;
		} catch (error) {
			console.error('Error creating cohort:', error);
			toastError('Failed to create cohort. Please try again.', 'Creation Failed');
		} finally {
			isLoading = false;
		}
	}

	async function handleCsvUpload(csvData) {
		isLoading = true;
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'upload_csv',
					filename: csvData.filename,
					cohortId: createdCohortId,
					data: csvData.data
				})
			});

			const result = await response.json();

			if (result.success) {
				uploadResult = result.data;
				uploadedUsers = csvData.data;
				currentStep = 3;
			} else {
				error = 'Upload failed: ' + result.message;
			}
		} catch (error) {
			console.error('Upload error:', error);
			error = 'Upload failed: ' + error.message;
		} finally {
			isLoading = false;
		}
	}

	async function finishSetup() {
		// New cohorts start at session 0, which automatically means status = 'scheduled'
		// Status is computed from session progress, not stored
		onComplete({ cohortId: createdCohortId });
		handleClose();
	}

	function handleClose() {
		currentStep = 1;
		cohortData = {
			name: '',
			moduleId: '',
			startDate: '',
			isFree: true,
			priceCents: null,
			currency: 'AUD',
			enrollmentType: 'admin_only'
		};
		uploadedUsers = [];
		uploadResult = null;
		createdCohortId = null;
		error = '';
		onClose();
	}

	function formatPrice(cents, currency) {
		const amount = cents / 100;
		return new Intl.NumberFormat('en-AU', { style: 'currency', currency }).format(amount);
	}

	function getEnrollmentTypeLabel(type) {
		const labels = {
			admin_only: 'Admin Only',
			open: 'Open Enrollment',
			approval_required: 'Approval Required'
		};
		return labels[type] || type;
	}

	function skipParticipants() {
		// Skip to step 3 with empty participants
		uploadedUsers = [];
		currentStep = 3;
	}

	function goBack() {
		if (currentStep > 1) {
			currentStep--;
		}
	}
</script>

{#if show}
	<div class="modal-overlay" onclick={handleClose} onkeydown={(e) => e.key === 'Enter' && handleClose()} role="presentation">
		<div class="modal-content" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && handleClose()} role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabindex="-1">
			<!-- Header -->
			<div class="modal-header">
				<div>
					<h2 id="wizard-title">Create New Cohort</h2>
					<div class="step-indicator">
						<span class:active={currentStep === 1} class:completed={currentStep > 1}>1. Details</span>
						<ChevronRight size={16} />
						<span class:active={currentStep === 2} class:completed={currentStep > 2}
							>2. Participants</span
						>
						<ChevronRight size={16} />
						<span class:active={currentStep === 3}>3. Review</span>
					</div>
				</div>
				<button type="button" onclick={handleClose} class="close-button">
					<X size={24} />
				</button>
			</div>

			<!-- Step 1: Cohort Details -->
			{#if currentStep === 1}
				<div class="modal-body">
					<form onsubmit={(e) => { e.preventDefault(); createDraftCohort(); }}>
						<div class="form-group">
							<label for="cohort-name">Cohort Name*</label>
							<input
								id="cohort-name"
								type="text"
								bind:value={cohortData.name}
								placeholder="e.g., February 2025 - Foundations of Faith"
								required
							/>
						</div>

						<div class="form-group">
							<label for="cohort-module">Module*</label>
							<select id="cohort-module" bind:value={cohortData.moduleId} required>
								<option value="">Select a module</option>
								{#each modules as module}
									<option value={module.id}>{module.name}</option>
								{/each}
							</select>
						</div>

						<div class="form-group">
							<label for="cohort-start-date">Start Date*</label>
							<input id="cohort-start-date" type="date" bind:value={cohortData.startDate} required />
							<p class="help-text">End date will be automatically calculated (8 weeks from start)</p>
						</div>

						<!-- Pricing Section -->
						<div class="pricing-section">
							<h4>Pricing & Enrollment</h4>

							<div class="form-group">
								<label class="toggle-label">
									<span>Course Type</span>
									<div class="toggle-options">
										<button
											type="button"
											class="toggle-btn"
											class:active={cohortData.isFree}
											onclick={() => { cohortData.isFree = true; cohortData.priceCents = null; }}
										>
											Free
										</button>
										<button
											type="button"
											class="toggle-btn"
											class:active={!cohortData.isFree}
											onclick={() => cohortData.isFree = false}
										>
											Paid
										</button>
									</div>
								</label>
							</div>

							{#if !cohortData.isFree}
								<div class="form-row">
									<div class="form-group flex-1">
										<label for="cohort-price">Price*</label>
										<div class="price-input">
											<span class="currency-symbol">$</span>
											<input
												id="cohort-price"
												type="number"
												min="0"
												step="0.01"
												placeholder="0.00"
												value={cohortData.priceCents ? cohortData.priceCents / 100 : ''}
												oninput={(e) => cohortData.priceCents = Math.round(parseFloat(e.target.value || '0') * 100)}
												required={!cohortData.isFree}
											/>
										</div>
									</div>
									<div class="form-group">
										<label for="cohort-currency">Currency</label>
										<select id="cohort-currency" bind:value={cohortData.currency}>
											<option value="AUD">AUD</option>
											<option value="USD">USD</option>
										</select>
									</div>
								</div>
							{/if}

							<div class="form-group">
								<label for="cohort-enrollment-type">Enrollment Type</label>
								<select id="cohort-enrollment-type" bind:value={cohortData.enrollmentType}>
									<option value="admin_only">Admin Only - Participants added manually</option>
									<option value="open">Open - Anyone can enroll via link</option>
									<option value="approval_required">Approval Required - Requests need admin approval</option>
								</select>
								<p class="help-text">
									{#if cohortData.enrollmentType === 'admin_only'}
										Only admins can add participants (current default behavior)
									{:else if cohortData.enrollmentType === 'open'}
										Participants can self-enroll via enrollment links
									{:else}
										Participants can request enrollment, admin must approve
									{/if}
								</p>
							</div>
						</div>

						<div class="modal-actions">
							<button type="button" onclick={handleClose} class="btn-secondary">Cancel</button>
							<button type="submit" class="btn-primary" disabled={isLoading}>
								{isLoading ? 'Creating...' : 'Continue'}
								<ChevronRight size={20} />
							</button>
						</div>
					</form>
				</div>
			{/if}

			<!-- Step 2: Add Participants -->
			{#if currentStep === 2}
				<div class="modal-body">
					<div class="step-intro">
						<h3>Add Participants</h3>
						<p>
							Upload or paste your participant list. You can also skip this step and add participants
							later.
						</p>
					</div>

					<CsvUpload onUpload={handleCsvUpload} />

					<div class="modal-actions">
						<button type="button" onclick={goBack} class="btn-secondary" disabled={isLoading}>
							<ChevronLeft size={20} />
							Back
						</button>
						<button type="button" onclick={skipParticipants} class="btn-secondary">
							Skip for Now
						</button>
					</div>
				</div>
			{/if}

			<!-- Step 3: Review & Complete -->
			{#if currentStep === 3}
				<div class="modal-body">
					<div class="step-intro">
						<h3>Review & Complete</h3>
					</div>

					<div class="review-section">
						<h4>Cohort Details</h4>
						<dl>
							<dt>Name:</dt>
							<dd>{cohortData.name}</dd>
							<dt>Module:</dt>
							<dd>{modules.find((m) => m.id === cohortData.moduleId)?.name}</dd>
							<dt>Start Date:</dt>
							<dd>{new Date(cohortData.startDate).toLocaleDateString()}</dd>
							<dt>End Date:</dt>
							<dd>{new Date(calculateEndDate(cohortData.startDate)).toLocaleDateString()}</dd>
						</dl>
					</div>

					<div class="review-section">
						<h4>Pricing & Enrollment</h4>
						<dl>
							<dt>Price:</dt>
							<dd>
								{#if cohortData.isFree}
									<span class="badge badge-green">Free</span>
								{:else}
									{formatPrice(cohortData.priceCents, cohortData.currency)}
								{/if}
							</dd>
							<dt>Enrollment:</dt>
							<dd>{getEnrollmentTypeLabel(cohortData.enrollmentType)}</dd>
						</dl>
					</div>

					<div class="review-section">
						<h4>Participants</h4>
						{#if uploadedUsers.length > 0}
							<div class="participants-summary">
								<p class="success-text">
									<strong>{uploadResult?.successful || 0}</strong> participants added successfully
								</p>

								{#if uploadResult?.errors > 0}
									<p class="error-text">
										<strong>{uploadResult.errors}</strong> {uploadResult.errors === 1 ? 'error' : 'errors'}
									</p>

									{#if uploadResult?.errorDetails && uploadResult.errorDetails.length > 0}
										<div class="error-details">
											<ul>
												{#each uploadResult.errorDetails as errorDetail}
													<li>{errorDetail}</li>
												{/each}
											</ul>
										</div>
									{/if}
								{/if}
							</div>
						{:else}
							<p class="empty-state">No participants added yet. You can add them later.</p>
						{/if}
					</div>

					<div class="modal-actions">
						<button type="button" onclick={goBack} class="btn-secondary" disabled={isLoading}>
							<ChevronLeft size={20} />
							Back
						</button>
						<button type="button" onclick={finishSetup} class="btn-primary" disabled={isLoading}>
							{isLoading ? 'Finishing...' : 'Complete Setup'}
							<Check size={20} />
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
		max-width: 800px;
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
		margin: 0 0 12px 0;
		font-weight: 700;
		font-size: 2rem;
		color: #1f2937;
	}

	.step-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.875rem;
		color: #9ca3af;
	}

	.step-indicator span {
		transition: all 0.2s ease;
	}

	.step-indicator span.active {
		color: #1f2937;
		font-weight: 600;
	}

	.step-indicator span.completed {
		color: #6b7280;
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
		background: #e5e7eb;
	}

	.modal-body {
		padding: 32px;
		overflow-y: auto;
		flex: 1;
	}

	.step-intro {
		margin-bottom: 32px;
	}

	.step-intro h3 {
		margin: 0 0 8px 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1f2937;
	}

	.step-intro p {
		margin: 0;
		color: var(--course-accent-dark);
	}

	.form-group {
		margin-bottom: 24px;
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
		box-shadow: 0 0 0 3px rgba(197, 154, 107, 0.1);
	}

	.help-text {
		margin: 8px 0 0 0;
		font-size: 0.8125rem;
		color: var(--course-accent-dark);
	}

	.review-section {
		background: #e5e7eb;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 24px;
	}

	.review-section h4 {
		margin: 0 0 16px 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.review-section dl {
		display: grid;
		grid-template-columns: 120px 1fr;
		gap: 12px 16px;
		margin: 0;
	}

	.review-section dt {
		font-weight: 600;
		color: var(--course-accent-dark);
	}

	.review-section dd {
		margin: 0;
		color: #1f2937;
	}

	.participants-summary {
		margin-bottom: 16px;
	}

	.participants-summary p {
		margin: 8px 0;
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

	.empty-state {
		color: var(--course-accent-dark);
		font-style: italic;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		padding-top: 24px;
		border-top: 1px solid #e5e7eb;
		margin-top: 32px;
	}

	.btn-primary,
	.btn-secondary {
		display: flex;
		align-items: center;
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
		justify-content: center;
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

	.btn-secondary:hover:not(:disabled) {
		background: #e5e7eb;
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Pricing Section Styles */
	.pricing-section {
		margin-top: 32px;
		padding-top: 24px;
		border-top: 1px solid #e5e7eb;
	}

	.pricing-section h4 {
		margin: 0 0 20px 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.toggle-label {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.toggle-label span {
		font-weight: 600;
		color: #1f2937;
		font-size: 0.875rem;
	}

	.toggle-options {
		display: flex;
		gap: 0;
		border: 2px solid #d1d5db;
		border-radius: 8px;
		overflow: hidden;
		width: fit-content;
	}

	.toggle-btn {
		padding: 10px 24px;
		border: none;
		background: white;
		color: #6b7280;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.toggle-btn:first-child {
		border-right: 1px solid #d1d5db;
	}

	.toggle-btn.active {
		background: var(--course-accent-dark, #334642);
		color: white;
	}

	.toggle-btn:hover:not(.active) {
		background: #f3f4f6;
	}

	.form-row {
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}

	.flex-1 {
		flex: 1;
	}

	.price-input {
		position: relative;
		display: flex;
		align-items: center;
	}

	.currency-symbol {
		position: absolute;
		left: 12px;
		color: #6b7280;
		font-weight: 500;
	}

	.price-input input {
		padding-left: 28px;
	}

	.badge {
		display: inline-flex;
		padding: 4px 12px;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.badge-green {
		background: #dcfce7;
		color: #166534;
	}
</style>