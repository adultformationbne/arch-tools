<script>
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { toast as toastStore } from '$lib/stores/toast.svelte.js';

	let { toast } = $props();

	let progressWidth = $state(0);
	let progressInterval;

	onMount(() => {
		if (toast.duration > 0) {
			const startTime = Date.now();
			progressInterval = setInterval(() => {
				const elapsed = Date.now() - startTime;
				progressWidth = Math.min((elapsed / toast.duration) * 100, 100);
				if (progressWidth >= 100) {
					clearInterval(progressInterval);
				}
			}, 10);
		}

		return () => {
			if (progressInterval) clearInterval(progressInterval);
		};
	});

	function handleClose() {
		toastStore.dismiss(toast.id);
	}

	function handleNextStep() {
		toastStore.nextStep(toast.id);
	}

	// Get toast styling based on type
	const typeStyles = {
		success: 'bg-green-50 border-green-200 text-green-800',
		error: 'bg-red-50 border-red-200 text-red-800',
		warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
		info: 'bg-blue-50 border-blue-200 text-blue-800',
		loading: 'bg-gray-50 border-gray-200 text-gray-800'
	};

	const iconPaths = {
		success:
			'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
		error:
			'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
		warning:
			'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z',
		info: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z',
		loading: 'M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z'
	};

	const style = $derived(typeStyles[toast.type] || typeStyles.info);
	const iconPath = $derived(iconPaths[toast.type] || iconPaths.info);
</script>

<div
	class="relative overflow-hidden rounded-lg border p-4 shadow-lg {style}"
	in:fly={{ y: 50, duration: 300 }}
	out:fade={{ duration: 200 }}
>
	<div class="flex items-start gap-3">
		<!-- Icon -->
		<div class="flex-shrink-0">
			{#if toast.type === 'loading'}
				<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			{:else}
				<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d={iconPath} clip-rule="evenodd"></path>
				</svg>
			{/if}
		</div>

		<!-- Content -->
		<div class="min-w-0 flex-1">
			{#if toast.title}
				<p class="text-sm font-medium">{toast.title}</p>
			{/if}
			{#if toast.message}
				<p class="mt-1 text-sm opacity-90">{toast.message}</p>
			{/if}

			<!-- Multi-step progress -->
			{#if toast.steps && toast.totalSteps > 1}
				<div class="mt-3">
					<div class="mb-1 flex items-center justify-between text-xs">
						<span>Step {toast.currentStep + 1} of {toast.totalSteps}</span>
						{#if toast.currentStep < toast.totalSteps - 1 && toast.type !== 'error'}
							<button onclick={handleNextStep} class="text-xs font-medium hover:underline">
								Next →
							</button>
						{/if}
					</div>
					<div class="h-1.5 w-full rounded-full bg-black/10">
						<div
							class="h-1.5 rounded-full bg-current transition-all duration-300"
							style="width: {((toast.currentStep + 1) / toast.totalSteps) * 100}%"
						></div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Close button -->
		{#if toast.closeable}
			<button
				onclick={handleClose}
				class="ml-2 inline-flex flex-shrink-0 text-current hover:opacity-70 focus:outline-none"
				aria-label="Close notification"
			>
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
						clip-rule="evenodd"
					></path>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Progress bar for auto-dismiss -->
	{#if toast.duration > 0}
		<div
			class="absolute bottom-0 left-0 h-1 bg-current opacity-20 transition-all duration-100"
			style="width: {progressWidth}%"
		></div>
	{/if}
</div>
