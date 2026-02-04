<script lang="ts">
	import { Check } from '$lib/icons';

	/**
	 * Flow types determine the steps shown:
	 * - free_auto: Register → Set Password (2 steps)
	 * - free_approval: Register → Awaiting Approval → Set Password (3 steps)
	 * - paid: Register → Payment → Set Password (3 steps)
	 */
	type FlowType = 'free_auto' | 'free_approval' | 'paid';

	let {
		flow = 'free_auto' as FlowType,
		currentStep = 1,
		compact = false
	} = $props();

	// Define steps based on flow type
	let steps = $derived(() => {
		switch (flow) {
			case 'free_auto':
				return [
					{ label: 'Register', shortLabel: 'Register' },
					{ label: 'Set Password', shortLabel: 'Password' }
				];
			case 'free_approval':
				return [
					{ label: 'Register', shortLabel: 'Register' },
					{ label: 'Awaiting Approval', shortLabel: 'Approval' },
					{ label: 'Set Password', shortLabel: 'Password' }
				];
			case 'paid':
				return [
					{ label: 'Register', shortLabel: 'Register' },
					{ label: 'Payment', shortLabel: 'Payment' },
					{ label: 'Set Password', shortLabel: 'Password' }
				];
			default:
				return [
					{ label: 'Register', shortLabel: 'Register' },
					{ label: 'Set Password', shortLabel: 'Password' }
				];
		}
	});

	function getStepStatus(index: number): 'completed' | 'active' | 'pending' {
		const stepNumber = index + 1;
		if (stepNumber < currentStep) return 'completed';
		if (stepNumber === currentStep) return 'active';
		return 'pending';
	}
</script>

<nav aria-label="Enrollment progress" class="enrollment-stepper" class:compact>
	<ol class="stepper-list">
		{#each steps() as step, index}
			{@const status = getStepStatus(index)}
			<li class="step-item" class:completed={status === 'completed'} class:active={status === 'active'}>
				<!-- Connector line (not on first step) -->
				{#if index > 0}
					<div class="connector" class:completed={status === 'completed' || status === 'active'}></div>
				{/if}

				<!-- Step circle -->
				<div class="step-circle" class:completed={status === 'completed'} class:active={status === 'active'}>
					{#if status === 'completed'}
						<Check class="check-icon" />
					{:else}
						<span class="step-number">{index + 1}</span>
					{/if}
				</div>

				<!-- Step label -->
				<span class="step-label">
					<span class="label-full">{step.label}</span>
					<span class="label-short">{step.shortLabel}</span>
				</span>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.enrollment-stepper {
		width: 100%;
		padding: 0.75rem 0;
	}

	.stepper-list {
		display: flex;
		align-items: center;
		justify-content: center;
		list-style: none;
		margin: 0;
		padding: 0;
		gap: 0;
	}

	.step-item {
		display: flex;
		align-items: center;
		position: relative;
	}

	/* Connector line */
	.connector {
		width: 2rem;
		height: 2px;
		background-color: #e5e7eb;
		margin: 0 0.25rem;
		transition: background-color 0.3s ease;
	}

	.connector.completed {
		background-color: #22c55e;
	}

	/* Step circle */
	.step-circle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 600;
		transition: all 0.3s ease;
		flex-shrink: 0;
		background-color: #e5e7eb;
		color: #6b7280;
	}

	.step-circle.active {
		background-color: #2563eb;
		color: white;
		box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.2);
	}

	.step-circle.completed {
		background-color: #22c55e;
		color: white;
	}

	.step-number {
		font-size: 0.75rem;
	}

	.step-circle :global(.check-icon) {
		width: 1rem;
		height: 1rem;
	}

	/* Step label */
	.step-label {
		margin-left: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: #6b7280;
		white-space: nowrap;
		transition: color 0.3s ease;
	}

	.step-item.active .step-label {
		color: #1f2937;
		font-weight: 600;
	}

	.step-item.completed .step-label {
		color: #6b7280;
	}

	/* Show/hide labels based on screen size */
	.label-short {
		display: none;
	}

	/* Compact mode */
	.compact .connector {
		width: 1.5rem;
	}

	.compact .step-circle {
		width: 1.5rem;
		height: 1.5rem;
	}

	.compact .step-number {
		font-size: 0.625rem;
	}

	.compact .step-circle :global(.check-icon) {
		width: 0.75rem;
		height: 0.75rem;
	}

	.compact .step-label {
		font-size: 0.75rem;
	}

	/* Responsive: hide labels and show short version on mobile */
	@media (max-width: 640px) {
		.connector {
			width: 1.5rem;
		}

		.step-circle {
			width: 1.75rem;
			height: 1.75rem;
		}

		.label-full {
			display: none;
		}

		.label-short {
			display: inline;
		}

		.step-label {
			font-size: 0.75rem;
		}
	}

	/* Extra small screens: hide labels completely */
	@media (max-width: 400px) {
		.step-label {
			display: none;
		}

		.connector {
			width: 2rem;
		}
	}
</style>
