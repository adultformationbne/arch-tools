<script>
	import { X, ChevronRight, ChevronLeft, Check } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';

	let {
		modules = [],
		show = false,
		courseSlug,
		courseFeatures = {},
		onClose = () => {},
		onComplete = () => {}
	} = $props();

	let currentStep = $state(1);
	let isLoading = $state(false);
	let createdCohortId = $state(null);

	// Step 1: Basics
	let basics = $state({
		name: '',
		moduleId: '',
		startDate: ''
	});

	// Step 2: Enrollment
	let enrollment = $state({
		enrollmentType: null, // null = auto_approve (default open), 'approval_required', or keep null for admin-managed
		isAdminOnly: true,
		isFree: true,
		priceCents: null,
		currency: 'AUD',
		maxEnrollments: null,
		enrollmentOpensAt: '',
		enrollmentClosesAt: ''
	});

	function calculateEndDate(startDate) {
		const start = new Date(startDate);
		const end = new Date(start.getTime() + 8 * 7 * 24 * 60 * 60 * 1000);
		return end.toISOString().split('T')[0];
	}

	async function createCohort() {
		isLoading = true;
		try {
			const endDate = calculateEndDate(basics.startDate);

			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create_cohort',
					name: basics.name,
					moduleId: basics.moduleId,
					startDate: basics.startDate,
					endDate
				})
			});

			if (!response.ok) throw new Error('Failed to create cohort');

			const result = await response.json();
			createdCohortId = result.data.id;
			currentStep = 2;
		} catch (err) {
			toastError('Failed to create cohort. Please try again.', 'Creation Failed');
		} finally {
			isLoading = false;
		}
	}

	async function saveEnrollmentAndFinish() {
		isLoading = true;
		try {
			// Determine enrollment_type: null means not open (admin-managed), otherwise set explicitly
			const enrollmentType = enrollment.isAdminOnly
				? null
				: (enrollment.enrollmentType ?? 'auto_approve');

			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_cohort_enrollment',
					cohortId: createdCohortId,
					enrollmentType,
					isFree: enrollment.isFree,
					priceCents: enrollment.isFree ? null : enrollment.priceCents,
					currency: enrollment.currency,
					maxEnrollments: enrollment.maxEnrollments || null,
					enrollmentOpensAt: enrollment.enrollmentOpensAt || null,
					enrollmentClosesAt: enrollment.enrollmentClosesAt || null
				})
			});

			if (!response.ok) throw new Error('Failed to save enrollment settings');

			toastSuccess('Cohort created');
			onComplete({ cohortId: createdCohortId });
			handleClose();
		} catch (err) {
			toastError('Failed to save enrollment settings. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	function handleClose() {
		currentStep = 1;
		createdCohortId = null;
		basics = { name: '', moduleId: '', startDate: '' };
		enrollment = {
			enrollmentType: null,
			isAdminOnly: true,
			isFree: true,
			priceCents: null,
			currency: 'AUD',
			maxEnrollments: null,
			enrollmentOpensAt: '',
			enrollmentClosesAt: ''
		};
		onClose();
	}
</script>

{#if show}
	<div
		class="modal-overlay"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="presentation"
	>
		<div
			class="modal-content"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby="wizard-title"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="modal-header">
				<div>
					<h2 id="wizard-title">New Cohort</h2>
					<div class="step-indicator">
						<span class:active={currentStep === 1} class:completed={currentStep > 1}>1. Basics</span>
						<ChevronRight size={14} />
						<span class:active={currentStep === 2}>2. Enrollment</span>
					</div>
				</div>
				<button type="button" onclick={handleClose} class="close-button">
					<X size={20} />
				</button>
			</div>

			<!-- Step 1: Basics -->
			{#if currentStep === 1}
				<div class="modal-body">
					<form onsubmit={(e) => { e.preventDefault(); createCohort(); }}>
						<div class="form-group">
							<label for="cohort-name">Cohort Name <span class="required">*</span></label>
							<input
								id="cohort-name"
								type="text"
								bind:value={basics.name}
								placeholder="e.g., Module 3 – Rockhampton Feb 2026"
								required
							/>
						</div>

						<div class="form-group">
							<label for="cohort-module">Module <span class="required">*</span></label>
							<select id="cohort-module" bind:value={basics.moduleId} required>
								<option value="">Select a module</option>
								{#each modules as module}
									<option value={module.id}>{module.name}</option>
								{/each}
							</select>
						</div>

						<div class="form-group">
							<label for="cohort-start-date">Start Date <span class="required">*</span></label>
							<input id="cohort-start-date" type="date" bind:value={basics.startDate} required />
							{#if basics.startDate}
								<p class="help-text">
									Ends {new Date(calculateEndDate(basics.startDate)).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} (8 weeks)
								</p>
							{/if}
						</div>

						<div class="modal-actions">
							<button type="button" onclick={handleClose} class="btn-secondary">Cancel</button>
							<button type="submit" class="btn-primary" disabled={isLoading}>
								{isLoading ? 'Creating...' : 'Continue'}
								<ChevronRight size={18} />
							</button>
						</div>
					</form>
				</div>
			{/if}

			<!-- Step 2: Enrollment -->
			{#if currentStep === 2}
				<div class="modal-body">
					<!-- How people get in -->
					<div class="form-group">
						<label class="label-text">How do participants join?</label>
						<div class="option-cards">
							<label class="option-card" class:selected={enrollment.isAdminOnly}>
								<input
									type="radio"
									name="enrollment-mode"
									checked={enrollment.isAdminOnly}
									onchange={() => enrollment.isAdminOnly = true}
								/>
								<div class="option-card-body">
									<span class="option-title">Admin only</span>
									<span class="option-desc">You add participants manually — no public enrollment link</span>
								</div>
							</label>
							<label class="option-card" class:selected={!enrollment.isAdminOnly && enrollment.enrollmentType !== 'approval_required'}>
								<input
									type="radio"
									name="enrollment-mode"
									checked={!enrollment.isAdminOnly && enrollment.enrollmentType !== 'approval_required'}
									onchange={() => { enrollment.isAdminOnly = false; enrollment.enrollmentType = 'auto_approve'; }}
								/>
								<div class="option-card-body">
									<span class="option-title">Open enrollment</span>
									<span class="option-desc">Anyone with an enrollment link can register and is added immediately</span>
								</div>
							</label>
							<label class="option-card" class:selected={!enrollment.isAdminOnly && enrollment.enrollmentType === 'approval_required'}>
								<input
									type="radio"
									name="enrollment-mode"
									checked={!enrollment.isAdminOnly && enrollment.enrollmentType === 'approval_required'}
									onchange={() => { enrollment.isAdminOnly = false; enrollment.enrollmentType = 'approval_required'; }}
								/>
								<div class="option-card-body">
									<span class="option-title">Requires approval</span>
									<span class="option-desc">Participants request to join — an admin must approve each one</span>
								</div>
							</label>
						</div>
					</div>

					{#if !enrollment.isAdminOnly}
						<!-- Enrollment window -->
						<div class="form-row">
							<div class="form-group flex-1">
								<label for="opens-at">Enrollment Opens</label>
								<input id="opens-at" type="date" bind:value={enrollment.enrollmentOpensAt} />
								<p class="help-text">Leave empty to open immediately</p>
							</div>
							<div class="form-group flex-1">
								<label for="closes-at">Enrollment Closes</label>
								<input id="closes-at" type="date" bind:value={enrollment.enrollmentClosesAt} />
								<p class="help-text">Leave empty for no closing date</p>
							</div>
						</div>

						<div class="form-group">
							<label for="max-enrollments">Max Participants</label>
							<input
								id="max-enrollments"
								type="number"
								min="1"
								placeholder="Unlimited"
								bind:value={enrollment.maxEnrollments}
							/>
						</div>
					{/if}

					{#if courseFeatures.acceptPayments}
						<!-- Pricing -->
						<div class="pricing-section">
							<label class="label-text">Pricing</label>
							<div class="toggle-options">
								<button
									type="button"
									class="toggle-btn"
									class:active={enrollment.isFree}
									onclick={() => { enrollment.isFree = true; enrollment.priceCents = null; }}
								>Free</button>
								<button
									type="button"
									class="toggle-btn"
									class:active={!enrollment.isFree}
									onclick={() => enrollment.isFree = false}
								>Paid</button>
							</div>

							{#if !enrollment.isFree}
								<div class="form-row mt-4">
									<div class="form-group flex-1">
										<label for="cohort-price">Price <span class="required">*</span></label>
										<div class="price-input">
											<span class="currency-symbol">$</span>
											<input
												id="cohort-price"
												type="number"
												min="0"
												step="0.01"
												placeholder="0.00"
												value={enrollment.priceCents ? enrollment.priceCents / 100 : ''}
												oninput={(e) => enrollment.priceCents = Math.round(parseFloat(e.target.value || '0') * 100)}
											/>
										</div>
									</div>
									<div class="form-group">
										<label for="cohort-currency">Currency</label>
										<select id="cohort-currency" bind:value={enrollment.currency}>
											<option value="AUD">AUD</option>
											<option value="USD">USD</option>
										</select>
									</div>
								</div>
							{/if}
						</div>
					{/if}

					<div class="modal-actions">
						<button type="button" onclick={() => currentStep = 1} class="btn-secondary" disabled={isLoading}>
							<ChevronLeft size={18} />
							Back
						</button>
						<button type="button" onclick={saveEnrollmentAndFinish} class="btn-primary" disabled={isLoading}>
							{isLoading ? 'Saving...' : 'Create Cohort'}
							<Check size={18} />
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
		max-width: 560px;
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
		padding: 28px 28px 20px 28px;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-header h2 {
		margin: 0 0 8px 0;
		font-weight: 700;
		font-size: 1.5rem;
		color: #1f2937;
	}

	.step-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8125rem;
		color: #9ca3af;
	}

	.step-indicator span.active {
		color: #1f2937;
		font-weight: 600;
	}

	.step-indicator span.completed {
		color: #6b7280;
	}

	.close-button {
		padding: 6px;
		border: none;
		background: transparent;
		color: #6b7280;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.close-button:hover {
		background: #e5e7eb;
		color: #1f2937;
	}

	.modal-body {
		padding: 28px;
		overflow-y: auto;
		flex: 1;
	}

	.form-group {
		margin-bottom: 20px;
	}

	.label-text,
	.form-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 600;
		color: #1f2937;
		font-size: 0.875rem;
	}

	.required {
		color: #dc2626;
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 10px 12px;
		border: 1.5px solid #d1d5db;
		border-radius: 8px;
		font-size: 0.9375rem;
		background: white;
		color: #1f2937;
		transition: border-color 0.15s ease;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--course-accent-dark, #334642);
	}

	.help-text {
		margin: 6px 0 0 0;
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.form-row {
		display: flex;
		gap: 16px;
		align-items: flex-start;
	}

	.flex-1 {
		flex: 1;
	}

	/* Option cards */
	.option-cards {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.option-card {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 14px;
		border: 1.5px solid #e5e7eb;
		border-radius: 10px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.option-card input[type="radio"] {
		width: auto;
		margin-top: 2px;
		flex-shrink: 0;
		accent-color: var(--course-accent-dark, #334642);
	}

	.option-card.selected {
		border-color: var(--course-accent-dark, #334642);
		background: color-mix(in srgb, var(--course-accent-dark, #334642) 5%, white);
	}

	.option-card-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.option-title {
		font-weight: 600;
		font-size: 0.875rem;
		color: #1f2937;
	}

	.option-desc {
		font-size: 0.8125rem;
		color: #6b7280;
	}

	/* Pricing */
	.pricing-section {
		margin-top: 8px;
		padding-top: 20px;
		border-top: 1px solid #e5e7eb;
	}

	.toggle-options {
		display: flex;
		border: 1.5px solid #d1d5db;
		border-radius: 8px;
		overflow: hidden;
		width: fit-content;
		margin-top: 8px;
	}

	.toggle-btn {
		padding: 8px 20px;
		border: none;
		background: white;
		color: #6b7280;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.15s ease;
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

	.mt-4 { margin-top: 16px; }

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
		pointer-events: none;
	}

	.price-input input {
		padding-left: 28px;
	}

	/* Actions */
	.modal-actions {
		display: flex;
		gap: 10px;
		padding-top: 20px;
		border-top: 1px solid #e5e7eb;
		margin-top: 24px;
	}

	.btn-primary,
	.btn-secondary {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 20px;
		font-size: 0.9375rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s ease;
		border: none;
	}

	.btn-primary {
		flex: 1;
		background: var(--course-accent-dark, #334642);
		color: white;
		justify-content: center;
	}

	.btn-primary:hover:not(:disabled) {
		opacity: 0.9;
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
</style>
