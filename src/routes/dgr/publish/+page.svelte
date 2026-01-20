<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGREditor from '$lib/components/DGREditor.svelte';
	import SplitViewLayout from '$lib/components/SplitViewLayout.svelte';
	import PreviewPanel from '$lib/components/PreviewPanel.svelte';
	import { getInitialDGRFormData } from '$lib/utils/dgr-utils.js';

	// Initialize form with defaults (with localStorage support in dev)
	const initializeFormData = () => {
		// Only use localStorage in development
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const saved = localStorage.getItem('dgr-form-data-dev');
			if (saved) {
				try {
					return JSON.parse(saved);
				} catch (e) {
					console.error('Failed to parse saved form data:', e);
				}
			}
		}

		// Use the common default values
		return getInitialDGRFormData();
	};

	let formData = $state(initializeFormData());
	let publishing = $state(false);
	let result = $state(null);
	let useNewDesign = $state(true);
	let fetchingGospel = $state(false);
	let gospelFullText = $state('');
	let gospelReference = $state('');
	let promoTiles = $state([]);
	let previewHtml = $state('');

	// Calculate publish times (1am Brisbane = UTC+10)
	let publishTimes = $derived.by(() => {
		if (!formData.date) return null;

		// Create date at 1am Brisbane time
		const brisbaneTime = new Date(formData.date + 'T01:00:00+10:00');
		const utcTime = brisbaneTime.toISOString();

		return {
			brisbane: brisbaneTime.toLocaleString('en-AU', {
				timeZone: 'Australia/Brisbane',
				dateStyle: 'full',
				timeStyle: 'short'
			}),
			utc: new Date(utcTime).toLocaleString('en-GB', {
				timeZone: 'UTC',
				dateStyle: 'full',
				timeStyle: 'short',
				hour12: false
			}) + ' UTC',
			isScheduled: brisbaneTime > new Date()
		};
	});

	async function handleSubmit(e) {
		if (e && e.preventDefault) e.preventDefault();

		// Form validation
		if (!formData.date || !formData.liturgicalDate || !formData.readings ||
			!formData.title || !formData.gospelQuote || !formData.reflectionText ||
			!formData.authorName) {
			toast.error({
				title: 'Form incomplete',
				message: 'Please fill in all required fields',
				duration: 4000
			});
			return;
		}

		publishing = true;
		result = null;

		// Create a multi-step toast for the publishing process
		const toastId = toast.multiStep({
			steps: [
				{ title: 'Validating form...', message: 'Checking all fields are complete', type: 'info' },
				{
					title: 'Connecting to WordPress...',
					message: 'Establishing secure connection',
					type: 'info'
				},
				{ title: 'Publishing content...', message: 'Uploading your reflection', type: 'loading' },
				{ title: 'Success!', message: 'Reflection published successfully', type: 'success' }
			],
			closeable: false
		});

		try {
			// Step 1: Validation
			await new Promise((resolve) => setTimeout(resolve, 500));
			toast.nextStep(toastId);

			// Step 2: Connection
			await new Promise((resolve) => setTimeout(resolve, 500));
			toast.nextStep(toastId);

			// Step 3: Publishing
			const response = await fetch('/api/dgr/publish', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					useNewDesign, // Pass the design format preference
					gospelFullText, // Pass the fetched gospel text
					gospelReference // Pass the extracted gospel reference
				})
			});

			result = await response.json();

			if (result.success) {
				// Step 4: Success
				toast.nextStep(toastId);
				setTimeout(() => {
					toast.dismiss(toastId);
					// Clear localStorage in dev mode since we're resetting
					if (import.meta.env.DEV && typeof window !== 'undefined') {
						localStorage.removeItem('dgr-form-data-dev');
					}
					// Reset form to prevent double submission
					formData = getInitialDGRFormData();
					gospelFullText = '';
					gospelReference = '';
					// Clear the result message after a delay
					setTimeout(() => {
						result = null;
					}, 5000);
				}, 2000);
			} else {
				toast.updateToast(toastId, {
					title: 'Publishing failed',
					message: result.error || 'An error occurred',
					type: 'error',
					closeable: true,
					duration: 5000
				});
			}
		} catch (error) {
			toast.dismiss(toastId);
			toast.error({
				title: 'Connection Error',
				message: error.message,
				duration: 5000
			});
			result = { success: false, error: error.message };
		} finally {
			publishing = false;
		}
	}
</script>

<SplitViewLayout
	leftWidth="lg:w-96"
	showRight={formData.title && formData.reflectionText}
>
	{#snippet leftPanel()}
		<!-- Header -->
		<div class="p-4 border-b border-gray-200 bg-white">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-lg font-bold text-gray-900">DGR Publisher</h1>
					<p class="text-xs text-gray-600">Daily Gospel Reflection</p>
				</div>
				<button
					onclick={handleSubmit}
					disabled={publishing}
					class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{publishing ? 'Publishing...' : 'Publish'}
				</button>
			</div>
		</div>

		<!-- Form Container (scrollable) -->
		<div class="flex-1 overflow-y-auto p-4">
			<DGREditor
				bind:formData
				bind:publishing
				bind:result
				bind:useNewDesign
				bind:fetchingGospel
				bind:gospelFullText
				bind:gospelReference
				bind:promoTiles
				bind:previewHtml
				showPreview={true}
				enableLocalStorage={true}
			/>

			<!-- Publish Time Display (at bottom of form) -->
			{#if publishTimes}
				<div class="mt-4 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
					<span class="font-medium text-gray-700">
						{publishTimes.isScheduled ? 'Will publish:' : 'Publishing:'}
					</span>
					{publishTimes.brisbane} (Brisbane) • {publishTimes.utc}
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet rightPanel()}
		<PreviewPanel
			previewHtml={previewHtml || (formData.title && formData.reflectionText ? '<div class="flex items-center justify-center h-full"><div class="text-gray-500">Generating preview...</div></div>' : '')}
			isReady={formData.title && formData.reflectionText}
		/>
	{/snippet}
</SplitViewLayout>

<ToastContainer />
