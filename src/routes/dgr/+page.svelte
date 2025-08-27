<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let formData = $state({
		date: new Date().toISOString().split('T')[0],
		liturgicalDate: '',
		readings: '',
		title: '',
		gospelQuote: '',
		gospelReference: '',
		reflectionText: '',
		authorName: ''
	});

	let publishing = $state(false);
	let result = $state(null);

	async function handleSubmit(e) {
		e.preventDefault();
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
				body: JSON.stringify(formData)
			});

			result = await response.json();

			if (result.success) {
				// Step 4: Success
				toast.nextStep(toastId);
				setTimeout(() => toast.dismiss(toastId), 3000);
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

	function formatDateDisplay(dateString) {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	async function pasteFromWord() {
		const loadingId = toast.loading({
			title: 'Reading clipboard...',
			message: 'Getting text from clipboard'
		});

		try {
			console.log('Reading from clipboard...');
			const text = await navigator.clipboard.readText();
			console.log('Clipboard text:', text);

			toast.dismiss(loadingId);

			if (!text || text.trim().length === 0) {
				toast.warning({
					title: 'Clipboard is empty',
					message: 'Please copy the text from Word first',
					duration: 4000
				});
				return;
			}

			parseWordDocument(text);

			toast.success({
				title: 'Content pasted!',
				message: 'Form fields have been populated',
				duration: 3000
			});
		} catch (err) {
			console.error('Clipboard error:', err);
			toast.dismiss(loadingId);
			toast.error({
				title: 'Clipboard access denied',
				message: 'Please allow clipboard access or paste manually',
				duration: 5000
			});
		}
	}

	function parseWordDocument(text) {
		console.log('Parsing document...');
		// Split into lines and clean up
		const lines = text
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line);
		console.log('Lines found:', lines.length, lines);

		// Find each section by its label
		let currentSection = '';
		const sections = {};

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			if (line === 'Date:') {
				currentSection = 'date';
				console.log('Found Date section');
				continue;
			} else if (line === 'Liturgical Date:') {
				currentSection = 'liturgicalDate';
				console.log('Found Liturgical Date section');
				continue;
			} else if (line === 'Readings:') {
				currentSection = 'readings';
				console.log('Found Readings section');
				continue;
			} else if (line === 'Title:') {
				currentSection = 'title';
				console.log('Found Title section');
				continue;
			} else if (line === 'Gospel quote:' || line === 'Gospel Quote:') {
				currentSection = 'gospelQuote';
				console.log('Found Gospel quote section');
				continue;
			} else if (line === 'Reflection written by:') {
				currentSection = 'author';
				console.log('Found Author section');
				continue;
			} else if (line.startsWith('By ') && i === lines.length - 1) {
				// Last line author format
				sections.author = line.substring(3);
				console.log('Found By line author:', sections.author);
				continue;
			}

			// Add content to current section
			if (currentSection) {
				if (!sections[currentSection]) {
					sections[currentSection] = '';
				}
				sections[currentSection] += (sections[currentSection] ? ' ' : '') + line;
			}
		}

		console.log('Parsed sections:', sections);

		// Parse the date to get YYYY-MM-DD format
		if (sections.date) {
			// Extract date from format like "Friday 29h August" or "Friday 29th August"
			const dateMatch = sections.date.match(/\w+\s+(\d+)\w*\s+(\w+)/);
			if (dateMatch) {
				const day = dateMatch[1];
				const month = dateMatch[2];
				const year = new Date().getFullYear(); // Use current year
				const dateStr = `${month} ${day}, ${year}`;
				const dateObj = new Date(dateStr);
				if (!isNaN(dateObj)) {
					formData.date = dateObj.toISOString().split('T')[0];
				}
			}
		}

		// Extract gospel reference from quote if present
		let gospelRef = '';
		if (sections.gospelQuote) {
			const refMatch = sections.gospelQuote.match(/\(([^)]+)\)\s*$/);
			if (refMatch) {
				gospelRef = refMatch[1];
				sections.gospelQuote = sections.gospelQuote
					.replace(/\s*\([^)]+\)\s*$/, '')
					.replace(/['']/g, "'")
					.replace(/[""]/g, '"');
			}
		}

		// Find reflection text (everything after author line until "By" line)
		const authorIndex = lines.indexOf('Reflection written by:');
		const byLineIndex = lines.findIndex((line) => line.startsWith('By '));
		if (authorIndex !== -1 && byLineIndex !== -1) {
			const reflectionLines = lines.slice(authorIndex + 2, byLineIndex);
			sections.reflection = reflectionLines.join('\n\n');
		}

		// Update form data
		formData.liturgicalDate = sections.liturgicalDate || '';
		formData.readings = sections.readings || '';
		formData.title = sections.title || '';
		formData.gospelQuote = sections.gospelQuote || '';
		formData.gospelReference = gospelRef;
		formData.reflectionText = sections.reflection || '';
		formData.authorName = sections.author || '';

		console.log('Form data updated:', formData);
	}

	// Demo toast functions
	function showSuccessToast() {
		toast.success({
			title: 'Success!',
			message: 'This is a success toast notification',
			duration: 3000
		});
	}

	function showErrorToast() {
		toast.error({
			title: 'Error occurred',
			message: 'Something went wrong. Please try again.',
			duration: 5000
		});
	}

	function showWarningToast() {
		toast.warning({
			title: 'Warning',
			message: 'Please review your input carefully',
			duration: 4000
		});
	}

	function showInfoToast() {
		toast.info({
			title: 'Information',
			message: 'This is an informational message',
			duration: 3000
		});
	}

	function showLoadingToast() {
		const id = toast.loading({
			title: 'Processing...',
			message: 'This will take a few seconds'
		});

		// Simulate completion after 3 seconds
		setTimeout(() => {
			toast.updateToast(id, {
				title: 'Complete!',
				message: 'Process finished successfully',
				type: 'success',
				duration: 3000
			});
		}, 3000);
	}

	function showMultiStepToast() {
		const id = toast.multiStep({
			steps: [
				{ title: 'Step 1', message: 'Initializing process...', type: 'info' },
				{ title: 'Step 2', message: 'Loading data...', type: 'loading' },
				{ title: 'Step 3', message: 'Processing information...', type: 'info' },
				{ title: 'Complete!', message: 'All steps finished', type: 'success' }
			]
		});

		// Auto-advance through steps
		let step = 0;
		const interval = setInterval(() => {
			step++;
			if (step < 4) {
				toast.nextStep(id);
			} else {
				clearInterval(interval);
				setTimeout(() => toast.dismiss(id), 2000);
			}
		}, 1500);
	}
</script>

<div class="mx-auto max-w-3xl p-6">
	<!-- Toast Demo Section -->
	<div class="mb-8 rounded-lg bg-gray-50 p-4">
		<h2 class="mb-3 text-lg font-semibold">Toast Notification Examples</h2>
		<div class="flex flex-wrap gap-2">
			<button
				onclick={showSuccessToast}
				class="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
			>
				Success Toast
			</button>
			<button
				onclick={showErrorToast}
				class="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
			>
				Error Toast
			</button>
			<button
				onclick={showWarningToast}
				class="rounded bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-700"
			>
				Warning Toast
			</button>
			<button
				onclick={showInfoToast}
				class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
			>
				Info Toast
			</button>
			<button
				onclick={showLoadingToast}
				class="rounded bg-gray-600 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
			>
				Loading Toast
			</button>
			<button
				onclick={showMultiStepToast}
				class="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700"
			>
				Multi-Step Toast
			</button>
		</div>
	</div>

	<div class="mb-8 flex items-center justify-between">
		<h1 class="text-3xl font-bold text-gray-900">Daily Gospel Reflection Publisher</h1>
		<button
			type="button"
			onclick={pasteFromWord}
			class="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
		>
			📋 Paste from Word
		</button>
	</div>

	<form onsubmit={handleSubmit} class="space-y-6">
		<div class="space-y-4 rounded-lg bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold text-gray-800">Reflection Details</h2>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Date </label>
				<input
					type="date"
					bind:value={formData.date}
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
				<p class="mt-1 text-sm text-gray-500">
					Will display as: {formatDateDisplay(formData.date)}
				</p>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Liturgical Date </label>
				<input
					type="text"
					bind:value={formData.liturgicalDate}
					placeholder="e.g., Memorial St Augustine, bishop, doctor"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Readings </label>
				<input
					type="text"
					bind:value={formData.readings}
					placeholder="e.g., 1 Thess 3:7-13; Ps 89:3-4, 12-14, 17; Mt 24:42–51"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Title for the Day </label>
				<input
					type="text"
					bind:value={formData.title}
					placeholder="e.g., Faithful and Wise Servant"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>
		</div>

		<div class="space-y-4 rounded-lg bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold text-gray-800">Gospel Content</h2>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Gospel Quote </label>
				<textarea
					bind:value={formData.gospelQuote}
					placeholder="Enter the gospel quote..."
					rows="3"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Gospel Reference </label>
				<input
					type="text"
					bind:value={formData.gospelReference}
					placeholder="e.g., Matthew 24:45"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>
		</div>

		<div class="space-y-4 rounded-lg bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-xl font-semibold text-gray-800">Reflection</h2>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Reflection Text </label>
				<textarea
					bind:value={formData.reflectionText}
					placeholder="Enter the reflection text (separate paragraphs with blank lines)..."
					rows="10"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium text-gray-700"> Author </label>
				<input
					type="text"
					bind:value={formData.authorName}
					placeholder="e.g., Sr. Theresa Maria Dao, SPC"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				/>
			</div>
		</div>

		<div class="flex justify-end">
			<button
				type="submit"
				disabled={publishing}
				class="rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{publishing ? 'Saving...' : 'Save as Draft on WordPress'}
			</button>
		</div>
	</form>

	{#if result}
		<div
			class="mt-6 rounded-lg p-4 {result.success
				? 'border border-green-200 bg-green-50'
				: 'border border-red-200 bg-red-50'}"
		>
			{#if result.success}
				<div class="flex items-center text-green-800">
					<svg class="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						></path>
					</svg>
					<span class="font-medium">Successfully published!</span>
					<a href={result.link} target="_blank" class="ml-2 underline hover:no-underline">
						View Post →
					</a>
				</div>
			{:else}
				<div class="flex items-center text-red-800">
					<svg class="mr-2 h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						></path>
					</svg>
					<span class="font-medium">Error:</span>
					<span class="ml-1">{result.error}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<ToastContainer />
