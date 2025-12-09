<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import DGRForm from '$lib/components/DGRForm.svelte';
	import PreviewPanel from '$lib/components/PreviewPanel.svelte';
	import { fetchGospelTextForDate, extractGospelReference } from '$lib/utils/scripture.js';
	import { generateDGRHTML, cleanGospelText, getInitialDGRFormData } from '$lib/utils/dgr-utils.js';
	import { formatDGRDate } from '$lib/utils/dgr-common.js';

	// Props
	let {
		formData = $bindable(getInitialDGRFormData()),
		showPreview = true,
		promoTiles = $bindable([]),
		useNewDesign = $bindable(true),
		publishing = $bindable(false),
		result = $bindable(null),
		fetchingGospel = $bindable(false),
		gospelFullText = $bindable(''),
		gospelReference = $bindable(''),
		previewHtml = $bindable(''),
		// Optional callbacks
		onFormChange = () => {},
		// For dev mode localStorage persistence
		enableLocalStorage = false
	} = $props();

	// Load promo tiles on mount
	$effect(() => {
		(async () => {
			try {
				const response = await fetch('/api/dgr-admin/promo-tiles');
				const data = await response.json();
				if (data.tiles) {
					promoTiles = data.tiles;
				}
			} catch (err) {
				console.error('Failed to load promo tiles:', err);
			}
		})();
	});

	// Fetch gospel text for the selected date
	async function fetchGospelForSelectedDate() {
		if (!formData.date) return;

		fetchingGospel = true;
		try {
			const result = await fetchGospelTextForDate(formData.date, 'NRSVAE', 'australia.brisbane');

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
		if (enableLocalStorage && import.meta.env.DEV && typeof window !== 'undefined') {
			const hasContent = formData.liturgicalDate || formData.readings ||
				formData.title || formData.gospelQuote ||
				formData.reflectionText || formData.authorName;

			if (hasContent) {
				localStorage.setItem('dgr-form-data-dev', JSON.stringify(formData));
			}
		}
	});

	// Generate preview HTML using centralized function - make it reactive
	$effect(async () => {
		if (showPreview && formData.title && formData.reflectionText) {
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

	// Notify parent of form changes
	$effect(() => {
		onFormChange(formData);
	});

	// Paste from Word parsing logic
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

			const text = await navigator.clipboard.readText();
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
		// Split into lines but don't trim yet to preserve structure
		const lines = text
			.split('\n')
			.filter((line) => line.length > 0);

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
						break;

					case 'Liturgical Date':
						if (line.includes(':\t') || line.match(/Liturgical Date:\s+\S/)) {
							const parts = lines[i].split(/Liturgical Date:\s*/);
							sections.liturgicalDate = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.liturgicalDate = nextLine;
						}
						break;

					case 'Readings':
						if (line.includes(':\t') || line.match(/Readings:\s+\S/)) {
							const parts = lines[i].split(/Readings:\s*/);
							sections.readings = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.readings = nextLine;
						}
						break;

					case 'Title':
						if (line.includes(':\t') || line.match(/Title:\s+\S/)) {
							const parts = lines[i].split(/Title:\s*/);
							sections.title = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.title = nextLine;
						}
						break;

					case 'Gospel quote':
					case 'Gospel Quote':
						if (line.includes(':\t') || line.match(/Gospel [Qq]uote:\s+\S/)) {
							const parts = lines[i].split(/Gospel [Qq]uote:\s*/);
							sections.gospelQuote = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.gospelQuote = nextLine;
						}
						break;

					case 'Reflection written by':
					case 'Written by':
						if (line.includes(':\t') || line.match(/(Reflection written by|Written by):\s+\S/)) {
							const parts = lines[i].split(/(Reflection written by|Written by):\s*/);
							sections.author = parts[2]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.author = nextLine;
						}
						// Reflection text starts after author line
						reflectionStartIndex = sections.author && nextLine === sections.author ? i + 2 : i + 1;
						break;
				}
			} else if (line.startsWith('By ') && i > lines.length - 5) {
				// Alternative author format at the end (usually in last few lines)
				sections.author = line.substring(3).trim();
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
		}

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

		// Find reflection text (everything after author line until "By" line)
		let authorIndex = lines.indexOf('Reflection written by:');
		if (authorIndex === -1) {
			authorIndex = lines.indexOf('Written by:');
		}
		const byLineIndex = lines.findIndex((line) => line.startsWith('By '));
		if (authorIndex !== -1 && byLineIndex !== -1) {
			const reflectionLines = lines.slice(authorIndex + 2, byLineIndex);
			sections.reflection = reflectionLines.join('\n\n');
		}

		// Update form data
		formData.liturgicalDate = sections.liturgicalDate || formData.liturgicalDate || '';
		formData.readings = sections.readings || formData.readings || '';
		formData.title = sections.title || '';
		formData.gospelQuote = sections.gospelQuote || '';
		formData.reflectionText = sections.reflection || '';
		formData.authorName = sections.author || '';

		// Extract gospel reference from readings
		if (formData.readings) {
			gospelReference = extractGospelReference(formData.readings);
		}
	}
</script>

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
