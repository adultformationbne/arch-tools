<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRForm from '$lib/components/DGRForm.svelte';
	import SplitViewLayout from '$lib/components/SplitViewLayout.svelte';
	import PreviewPanel from '$lib/components/PreviewPanel.svelte';
	import { fetchGospelTextForDate, extractGospelReference } from '$lib/utils/scripture.js';
	import { generateDGRHTML, parseReadings, cleanGospelText, getInitialDGRFormData } from '$lib/utils/dgr-utils.js';
	import { formatDGRDate } from '$lib/utils/dgr-common.js';
	import { onMount } from 'svelte';

	// Initialize form with defaults (with localStorage support in dev)
	const initializeFormData = () => {
		// Only use localStorage in development
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			const saved = localStorage.getItem('dgr-form-data-dev');
			if (saved) {
				try {
					console.log('Restoring form data from localStorage (dev mode)');
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
	let useNewDesign = $state(true); // Toggle for design format
	let fetchingGospel = $state(false);
	let gospelFullText = $state(''); // Full gospel text for the day
	let gospelReference = $state(''); // Extracted gospel reference (e.g., "Matthew 1:1-16, 18-23")
	let promoTiles = $state([]); // Promo tiles for preview

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

	// Load promo tiles on mount
	onMount(async () => {
		try {
			const response = await fetch('/api/dgr-admin/promo-tiles');
			const data = await response.json();
			console.log('Loaded promo tiles:', data);
			if (data.tiles) {
				promoTiles = data.tiles;
				console.log('Set promoTiles to:', promoTiles);
			}
		} catch (err) {
			console.error('Failed to load promo tiles:', err);
		}
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
						console.log('Cleared saved form data (dev mode)');
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

	// Using the common date formatter from dgr-common.js
	const formatDateDisplay = formatDGRDate;

	// Gospel reference extraction is now handled by shared utility

	// Fetch gospel text for the selected date
	async function fetchGospelForSelectedDate() {
		if (!formData.date) return;

		fetchingGospel = true;
		try {
			const result = await fetchGospelTextForDate(formData.date, 'NRSVAE', 'australia.brisbane');
			
			// Simple Gospel Debug Log
			if (result.success && result.content) {
				console.log('=== GOSPEL FETCH ===');
				console.log('RAW INPUT (FULL):', result.content);
			}
			
			if (result.success) {
				gospelFullText = cleanGospelText(result.content);
				gospelReference = result.reference;
			} else {
				console.warn('Failed to fetch gospel:', result.error);
				gospelFullText = '';
				gospelReference = '';
				
				// Try fallback with extracted reference from readings
				if (formData.readings) {
					const extractedRef = extractGospelReference(formData.readings);
					if (extractedRef) {
						gospelReference = extractedRef;
						await fetchGospelByReference();
					}
				}
			}
		} catch (err) {
			console.error('Error fetching gospel for date:', err);
			gospelFullText = '';
			gospelReference = '';
		} finally {
			fetchingGospel = false;
		}
	}

	// Fetch gospel by reference (fallback)
	async function fetchGospelByReference() {
		if (!gospelReference) return;

		fetchingGospel = true;
		try {
			const response = await fetch(`/api/scripture?passage=${encodeURIComponent(gospelReference)}&version=NRSVAE`);
			if (response.ok) {
				const data = await response.json();
				
				if (data.success && data.content) {
					gospelFullText = cleanGospelText(data.content);
				}
			}
		} catch (err) {
			console.error('Error fetching gospel by reference:', err);
		} finally {
			fetchingGospel = false;
		}
	}

	// Watch for date and readings changes to auto-fetch gospel
	$effect(() => {
		// Extract gospel reference from readings if available
		if (formData.readings) {
			gospelReference = extractGospelReference(formData.readings);
		}
		
		// Always try to fetch gospel for the date first (this gets the liturgical gospel)
		if (formData.date) {
			fetchGospelForSelectedDate();
		}
	});

	// Save form data to localStorage in dev mode only
	$effect(() => {
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			// Skip saving if form is empty (just initialized)
			const hasContent = formData.liturgicalDate || formData.readings || 
				formData.title || formData.gospelQuote || 
				formData.reflectionText || formData.authorName;
			
			if (hasContent) {
				localStorage.setItem('dgr-form-data-dev', JSON.stringify(formData));
				console.log('Saved form data to localStorage (dev mode)');
			}
		}
	});


	// Generate preview HTML using centralized function - make it reactive
	let previewHtml = $state('');
	
	// Regenerate preview when form data, gospel content, or promo tiles change
	$effect(async () => {
		if (formData.title && formData.reflectionText) {
			console.log('Regenerating preview with promoTiles:', promoTiles);
			previewHtml = await generateDGRHTML(formData, {
				useNewDesign,
				gospelFullText,
				gospelReference,
				includeWordPressCSS: false,
				promoTiles
			});
		} else {
			previewHtml = '';
		}
	});

	async function pasteFromWord() {
		const loadingId = toast.loading({
			title: 'Reading clipboard...',
			message: 'Getting text from clipboard'
		});

		try {
			// Check for clipboard permission first
			if (navigator.permissions) {
				const permission = await navigator.permissions.query({ name: 'clipboard-read' });
				if (permission.state === 'denied') {
					toast.dismiss(loadingId);
					toast.error({
						title: 'Clipboard access denied',
						message: 'Please enable clipboard permissions in your browser settings',
						duration: 5000
					});
					return;
				}
			}

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
		// Split into lines but don't trim yet to preserve structure
		const lines = text
			.split('\n')
			.filter((line) => line.length > 0);
		console.log('Lines found:', lines.length, lines);

		// Parse sections from the structured format
		const sections = {};
		let reflectionStartIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			// Check if this is a label line (ending with colon)
			if (line.endsWith(':')) {
				const label = line.slice(0, -1).trim(); // Remove the colon
				const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
				
				switch (label) {
					case 'Date':
						// Check if content is on same line after colon (desktop Word)
						if (line.includes(':\t') || line.match(/Date:\s+\S/)) {
							const parts = lines[i].split(/Date:\s*/);
							sections.date = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							// Content is on next line (web Word)
							sections.date = nextLine;
						}
						console.log('Found Date:', sections.date);
						break;
						
					case 'Liturgical Date':
						if (line.includes(':\t') || line.match(/Liturgical Date:\s+\S/)) {
							const parts = lines[i].split(/Liturgical Date:\s*/);
							sections.liturgicalDate = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.liturgicalDate = nextLine;
						}
						console.log('Found Liturgical Date:', sections.liturgicalDate);
						break;
						
					case 'Readings':
						if (line.includes(':\t') || line.match(/Readings:\s+\S/)) {
							const parts = lines[i].split(/Readings:\s*/);
							sections.readings = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.readings = nextLine;
						}
						console.log('Found Readings:', sections.readings);
						break;
						
					case 'Title':
						if (line.includes(':\t') || line.match(/Title:\s+\S/)) {
							const parts = lines[i].split(/Title:\s*/);
							sections.title = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.title = nextLine;
						}
						console.log('Found Title:', sections.title);
						break;
						
					case 'Gospel quote':
					case 'Gospel Quote':
						if (line.includes(':\t') || line.match(/Gospel [Qq]uote:\s+\S/)) {
							const parts = lines[i].split(/Gospel [Qq]uote:\s*/);
							sections.gospelQuote = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.gospelQuote = nextLine;
						}
						console.log('Found Gospel quote:', sections.gospelQuote);
						break;
						
					case 'Reflection written by':
						if (line.includes(':\t') || line.match(/Reflection written by:\s+\S/)) {
							const parts = lines[i].split(/Reflection written by:\s*/);
							sections.author = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.author = nextLine;
						}
						console.log('Found Author:', sections.author);
						// Reflection text starts after author line
						reflectionStartIndex = sections.author && nextLine === sections.author ? i + 2 : i + 1;
						break;
				}
			} else if (line.startsWith('By ') && i > lines.length - 5) {
				// Alternative author format at the end (usually in last few lines)
				sections.author = line.substring(3).trim();
				console.log('Found By line author:', sections.author);
			}
		}

		// Find reflection text (everything after "Reflection written by:" until "By" line or end)
		if (reflectionStartIndex > 0 && reflectionStartIndex < lines.length) {
			const reflectionLines = [];
			let inReflection = true;
			
			for (let i = reflectionStartIndex; i < lines.length && inReflection; i++) {
				const line = lines[i].trim();
				
				// Stop if we hit the "By" author line (but not if it's too early)
				if (line.startsWith('By ') && i > reflectionStartIndex + 3) {
					inReflection = false;
					continue;
				}
				
				// Skip empty lines but keep track for paragraph breaks
				if (line === '') {
					if (reflectionLines.length > 0 && reflectionLines[reflectionLines.length - 1] !== '') {
						reflectionLines.push(''); // Keep one empty line for paragraph break
					}
					continue;
				}
				
				reflectionLines.push(line);
			}
			
			// Clean up the reflection text - join with proper paragraph breaks
			sections.reflection = reflectionLines
				.join('\n')
				.split(/\n\n+/) // Split by multiple newlines
				.filter(para => para.trim()) // Remove empty paragraphs
				.join('\n\n'); // Join back with double newlines
				
			console.log('Found reflection with', reflectionLines.filter(l => l).length, 'lines');
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
				// Parse in UTC to avoid timezone issues
				const dateObj = new Date(dateStr + ' UTC');
				if (!isNaN(dateObj)) {
					// Format as YYYY-MM-DD using UTC values
					const utcYear = dateObj.getUTCFullYear();
					const utcMonth = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
					const utcDay = String(dateObj.getUTCDate()).padStart(2, '0');
					formData.date = `${utcYear}-${utcMonth}-${utcDay}`;
				}
			}
		}

		// No need to extract reference here since parseGospelContent will handle it

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
		formData.reflectionText = sections.reflection || '';
		formData.authorName = sections.author || '';

		// Extract gospel reference from readings
		if (formData.readings) {
			gospelReference = extractGospelReference(formData.readings);
		}

		console.log('Form data updated:', formData);
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
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{publishing ? 'Publishing...' : 'Publish'}
				</button>
			</div>
		</div>

		<!-- Form Container (scrollable) -->
		<div class="flex-1 overflow-y-auto p-4">
			<DGRForm
				bind:formData
				bind:publishing
				bind:result
				bind:useNewDesign
				bind:fetchingGospel
				bind:gospelFullText
				bind:gospelReference
				onPasteFromWord={pasteFromWord}
			/>

			<!-- Publish Time Display (at bottom of form) -->
			{#if publishTimes}
				<div class="mt-4 p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
					<span class="font-medium text-gray-700">
						{publishTimes.isScheduled ? 'Will publish:' : 'Publishing:'}
					</span>
					{publishTimes.brisbane} • {publishTimes.utc}
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
