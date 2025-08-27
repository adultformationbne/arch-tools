<script>
	import { onMount } from 'svelte';
	import { X } from 'lucide-svelte';

	let { steps = [], autoStart = true, onComplete = () => {} } = $props();

	let currentStep = $state(0);
	let isActive = $state(false);
	let guideBox = $state(null);

	const showStep = (stepIndex) => {
		if (stepIndex >= steps.length) {
			isActive = false;
			onComplete();
			return;
		}

		const step = steps[stepIndex];
		const targetElement = document.querySelector(step.target);

		if (!targetElement || !guideBox) return;

		// Position the guide box next to the target element
		const rect = targetElement.getBoundingClientRect();
		const scrollTop = window.scrollY;
		const scrollLeft = window.scrollX;

		// Default positioning to the right of the element
		let top = rect.top + scrollTop;
		let left = rect.right + scrollLeft + 20;

		// Adjust if it would go off screen
		if (left + 300 > window.innerWidth) {
			left = rect.left + scrollLeft - 320; // Move to left side
		}

		guideBox.style.position = 'absolute';
		guideBox.style.top = `${top}px`;
		guideBox.style.left = `${left}px`;
		guideBox.style.zIndex = '10000';

		// Highlight the target element
		targetElement.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.3)';
		targetElement.style.borderRadius = '8px';
		targetElement.style.transition = 'all 0.3s ease';

		currentStep = stepIndex;
		isActive = true;
	};

	const nextStep = () => {
		// Remove highlight from current element
		if (steps[currentStep]) {
			const currentElement = document.querySelector(steps[currentStep].target);
			if (currentElement) {
				currentElement.style.boxShadow = '';
			}
		}

		showStep(currentStep + 1);
	};

	const skipGuide = () => {
		// Remove any highlights
		steps.forEach((step) => {
			const element = document.querySelector(step.target);
			if (element) {
				element.style.boxShadow = '';
			}
		});

		isActive = false;
		onComplete();
	};

	onMount(() => {
		if (autoStart && steps.length > 0) {
			setTimeout(() => showStep(0), 1000);
		}
	});
</script>

{#if isActive && steps[currentStep]}
	<div
		bind:this={guideBox}
		class="animate-in slide-in-from-left-2 max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl duration-300"
	>
		<div class="mb-4 flex items-start justify-between">
			<div class="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
				Step {currentStep + 1} of {steps.length}
			</div>
			<button onclick={skipGuide} class="text-gray-400 transition-colors hover:text-gray-600">
				<X class="h-4 w-4" />
			</button>
		</div>

		<h3 class="mb-2 text-lg font-semibold text-gray-900">
			{steps[currentStep].title}
		</h3>

		<p class="mb-4 text-gray-600">
			{steps[currentStep].description}
		</p>

		<div class="flex items-center justify-between">
			<button
				onclick={skipGuide}
				class="text-sm text-gray-500 transition-colors hover:text-gray-700"
			>
				Skip guide
			</button>

			<button
				onclick={nextStep}
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
			>
				{currentStep === steps.length - 1 ? 'Finish' : 'Next'}
			</button>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-in-from-left {
		from {
			opacity: 0;
			transform: translateX(-20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.animate-in {
		animation-fill-mode: both;
	}

	.slide-in-from-left-2 {
		animation: slide-in-from-left 0.3s ease;
	}
</style>
