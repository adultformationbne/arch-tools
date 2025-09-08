<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { fetchGospelTextForDate, extractGospelReference } from '$lib/utils/scripture.js';

	let formData = $state({
		date: new Date().toISOString().split('T')[0],
		liturgicalDate: '',
		readings: '', // All readings (1st, 2nd, psalm, gospel)
		title: '',
		gospelQuote: '', // Author's selected quote/highlight
		reflectionText: '',
		authorName: ''
	});

	let publishing = $state(false);
	let result = $state(null);
	let useNewDesign = $state(true); // Toggle for design format
	let fetchingGospel = $state(false);
	let gospelFullText = $state(''); // Full gospel text for the day
	let gospelReference = $state(''); // Extracted gospel reference (e.g., "Matthew 1:1-16, 18-23")

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
				body: JSON.stringify({
					...formData,
					useNewDesign // Pass the design format preference
				})
			});

			result = await response.json();

			if (result.success) {
				// Step 4: Success
				toast.nextStep(toastId);
				setTimeout(() => {
					toast.dismiss(toastId);
					// Reset form to prevent double submission
					formData = {
						date: new Date().toISOString().split('T')[0],
						liturgicalDate: '',
						readings: '',
						title: '',
						gospelQuote: '',
						reflectionText: '',
						authorName: ''
					};
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

	function formatDateDisplay(dateString) {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	// Gospel reference extraction is now handled by shared utility

	// Fetch gospel text for the selected date
	async function fetchGospelForSelectedDate() {
		if (!formData.date) return;

		fetchingGospel = true;
		try {
			console.log('Fetching gospel for date:', formData.date);
			const result = await fetchGospelTextForDate(formData.date, 'NRSVAE', 'australia.brisbane');
			
			if (result.success) {
				gospelFullText = result.content;
				gospelReference = result.reference;
				console.log('Successfully fetched gospel:', result.reference);
			} else {
				console.warn('Failed to fetch gospel:', result.error);
				gospelFullText = '';
				gospelReference = '';
				
				// Try fallback with extracted reference from readings
				if (formData.readings) {
					const extractedRef = extractGospelReference(formData.readings);
					if (extractedRef) {
						console.log('Trying fallback with extracted reference:', extractedRef);
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
			console.log('Fetching gospel by reference:', gospelReference);
			const response = await fetch(`/api/scripture?passage=${encodeURIComponent(gospelReference)}&version=NRSVAE`);
			if (response.ok) {
				const data = await response.json();
				if (data.success && data.content) {
					gospelFullText = data.content;
					console.log('Successfully fetched gospel by reference');
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

	// Generate preview HTML
	function generatePreviewHTML() {
		const dateObj = new Date(formData.date);
		const formattedDate = dateObj.toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		if (useNewDesign) {
			return `<!-- New Clean Design -->
<!-- Header Image -->
<div style="text-align:center; margin-bottom:40px;">
  <img src="https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Header-1024x683.png" 
       alt="Daily Gospel Reflections" 
       style="max-width:500px; width:100%; height:auto; display:inline-block;">
</div>

<article style="max-width:700px; margin:0 auto; font-family: Arial, Helvetica, sans-serif; line-height:1.6; color:#333;">

  <!-- Meta Row -->
  <div style="display:flex; justify-content:space-between; font-size:14px; color:#555; border-bottom:1px solid #ddd; padding-bottom:6px; margin-bottom:18px;">
    <span>${formattedDate}</span>
    <span>${formData.liturgicalDate}</span>
  </div>

  <!-- Title -->
  <h1 style="font-family:'PT Serif', Georgia, serif; font-size:28px; color:#2c7777; margin:0 0 12px;">${formData.title}</h1>

  <!-- Readings -->
  <p style="font-size:14px; color:#666; margin:0 0 20px;">
    Readings: ${formData.readings}
  </p>

  <!-- Author's Gospel Quote/Highlight -->
  <blockquote style="margin:20px 0; padding-left:16px; border-left:3px solid #2c7777; font-style:italic; font-size:16px; color:#2c7777;">
    ${formData.gospelQuote}
  </blockquote>

  ${gospelFullText && gospelReference ? `
  <!-- Full Gospel Reading for the Day -->
  <div style="background:#f8fffe; padding:25px; margin:30px 0; border-radius:10px; border:1px solid #0fa3a3; box-shadow:0 2px 8px rgba(15,163,163,0.1);">
    <h3 style="font-family:'PT Serif', Georgia, serif; font-size:20px; color:#0fa3a3; margin:0 0 15px; font-weight:600;">Gospel Reading: ${gospelReference}</h3>
    <div style="font-size:16px; color:#333; line-height:1.8; font-family:'PT Serif', Georgia, serif;">
      ${gospelFullText}
    </div>
  </div>
  ` : ''}

  <!-- Body -->
  <div style="font-size:16px; color:#333;">
    ${formData.reflectionText
			.split('\n')
			.filter((p) => p.trim())
			.map((paragraph) => `<p>${paragraph.trim()}</p>`)
			.join('\n')}
  </div>

  <!-- Author -->
  <p style="margin-top:30px; font-size:14px; color:#555; border-top:1px solid #eee; padding-top:10px;">
    <strong>Reflection written by:</strong> ${formData.authorName}
  </p>

</article>

[elementor-template id="10072"]

<!-- Custom Subscribe Section -->
<div style="background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%); padding:50px 20px; margin-top:50px; text-align:center; width:100vw; margin-left:calc(-50vw + 50%);">
  <div style="max-width:600px; margin:0 auto;">
    <h3 style="font-family:'PT Serif', Georgia, serif; font-size:28px; font-weight:700; color:white; margin:0 0 15px;">
      Subscribe to Daily Gospel Reflections
    </h3>
    <p style="font-size:16px; color:white; margin:0 0 30px; opacity:0.95;">
      Sent directly to your email inbox, every morning.
    </p>
    <a href="https://share-ap1.hsforms.com/1tifbJAvIRhmZf5yuh3qEsQ7av94g" target="_blank" style="display:inline-block; background:white; color:#2c7777; padding:14px 35px; text-decoration:none; font-size:16px; font-weight:600; border-radius:5px; transition:all 0.3s; line-height:1; vertical-align:middle; box-shadow: 0 2px 10px rgba(0,0,0,0.2);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.2)'">Subscribe</a>
  </div>
</div>`;
		} else {
			const heroImageUrl = 'https://archdiocesanministries.org.au/wp-content/uploads/2024/10/image-20240803-012152-4ace2c2e-Large-Medium.jpeg';
			
			return `<!-- Original Hero Design -->
<div class="dgr-hero" style="
  background-image: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${heroImageUrl}');
  background-size: cover;
  background-position: center;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin: 0 0 0 0;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
">
  <h1 style="font-family: 'PT Serif', Georgia, serif; font-size: 3rem; font-weight: bold; margin: 0; text-align: center; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
    Daily Reflections
  </h1>
</div>

<!-- Header Image -->
<div style="text-align:center; margin:40px auto;">
  <img src="https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Header-1024x683.png" 
       alt="Daily Gospel Reflections" 
       style="max-width:300px; width:100%; height:auto; display:inline-block;">
</div>

<div class="dgr-content" style="max-width: 1200px; margin: 0 auto; padding: 3rem 2rem;">
  
  <!-- Title Section -->
  <h2 style="
    font-family: 'PT Serif', Georgia, serif; 
    font-size: 2.2rem; 
    font-weight: bold;
    color: #2c2c2c; 
    margin: 0 0 2rem 0;
    line-height: 1.2;
  ">
    ${formData.title}
  </h2>
  
  <!-- Date and Scripture Info -->
  <div style="display: flex; justify-content: space-between; margin-bottom: 2.5rem; gap: 0rem;">
    
    <!-- Left Column: Date -->
    <div style="flex: 1; text-align: left;">
      <div style="
        font-family: 'PT Serif', Georgia, serif;
        font-size: 1.1rem; 
        font-weight: bold;
        color: #2c2c2c;
        margin-bottom: 0.5rem;
      ">
        ${formattedDate}
      </div>
    </div>
    
    <!-- Right Column: Liturgical Info -->
    <div style="flex: 1; text-align: right;">
      <div style="
        font-family: 'Open Sans', Arial, sans-serif;
        font-size: 1rem; 
        color: #666;
        line-height: 1.4;
      ">
        <div style="margin-bottom: 0.3rem;">${formData.liturgicalDate}</div>
        <div style="font-style: italic; font-size: 0.9rem; font-family: 'PT Serif', Georgia, serif;">${formData.readings}</div>
      </div>
    </div>
  </div>
  
  <!-- Gospel Quote -->
  <div style="
    background: none;
    border: none;
    padding: 0;
    margin: 2.5rem 0;
    text-align: left;
  ">
    <p style="
      font-family: 'PT Serif', Georgia, serif;
      font-size: 1.1rem;
      font-style: italic;
      color: #444;
      margin: 0 0 0.5rem 0;
      line-height: 1.6;
    ">
      '${formData.gospelQuote}' <span style="font-weight: normal; color: #666;">(${formData.gospelReference})</span>
    </p>
  </div>
  
  <!-- Reflection Text -->
  <div style="
    font-family: 'Open Sans', Arial, sans-serif;
    font-size: 1.1rem;
    line-height: 1.5; 
    color: #333; 
    text-align: left;
    margin: 2rem 0;
  ">
    ${formData.reflectionText
			.split('\n')
			.filter((p) => p.trim())
			.map(
				(paragraph) => `<p style="margin: 0 0 1.5rem 0; text-indent: 0;">${paragraph.trim()}</p>`
			)
			.join('')}
  </div>
  
  <!-- Author -->
  <div style="
    font-family: 'Open Sans', Arial, sans-serif;
    font-size: 1rem;
    color: #666; 
    text-align: left;
    margin-top: 2rem;
  ">
    By ${formData.authorName}
  </div>
  
</div>

[elementor-template id="10072"]

<!-- Custom Subscribe Section -->
<div style="background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%); padding:50px 20px; margin-top:50px; text-align:center; width:100vw; margin-left:calc(-50vw + 50%);">
  <div style="max-width:600px; margin:0 auto;">
    <h3 style="font-family:'PT Serif', Georgia, serif; font-size:28px; font-weight:700; color:white; margin:0 0 15px;">
      Subscribe to Daily Gospel Reflections
    </h3>
    <p style="font-size:16px; color:white; margin:0 0 30px; opacity:0.95;">
      Sent directly to your email inbox, every morning.
    </p>
    <a href="https://share-ap1.hsforms.com/1tifbJAvIRhmZf5yuh3qEsQ7av94g" target="_blank" style="display:inline-block; background:white; color:#2c7777; padding:14px 35px; text-decoration:none; font-size:16px; font-weight:600; border-radius:5px; transition:all 0.3s; line-height:1; vertical-align:middle; box-shadow: 0 2px 10px rgba(0,0,0,0.2);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0,0,0,0.2)'">Subscribe</a>
  </div>
</div>`;
		}
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

<div class="mx-auto max-w-3xl p-6">

	<div class="mb-8">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-3xl font-bold text-gray-900">Daily Gospel Reflection Publisher</h1>
			<button
				type="button"
				onclick={pasteFromWord}
				class="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
			>
				📋 Paste from Word
			</button>
		</div>
		
		<!-- Design Format Toggle -->
		<div class="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
			<label class="flex items-center cursor-pointer">
				<input 
					type="checkbox" 
					bind:checked={useNewDesign}
					class="mr-2 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
				/>
				<span class="text-sm font-medium text-gray-700">
					Use new clean design format
				</span>
			</label>
			<span class="text-xs text-gray-500">
				{useNewDesign ? '(Clean article style with gospel text)' : '(Original hero image style)'}
			</span>
		</div>
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

			{#if gospelReference}
				<div class="rounded-lg bg-green-50 p-4 border border-green-200 mb-4">
					<div class="flex items-center justify-between mb-2">
						<h4 class="text-sm font-semibold text-green-900">Gospel for {formatDateDisplay(formData.date)}</h4>
						<span class="text-xs text-green-600">
							{fetchingGospel ? 'Loading...' : 'Auto-loaded'}
						</span>
					</div>
					<p class="text-sm text-green-800 font-medium mb-3">
						{gospelReference}
					</p>
					{#if gospelFullText}
						<div class="bg-white p-3 rounded border border-green-100 max-h-48 overflow-y-auto">
							<div class="text-sm text-gray-700">
								{@html gospelFullText}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<div>
				<label for="gospelQuote" class="mb-1 block text-sm font-medium text-gray-700"> 
					Gospel Quote/Highlight (Author's Selection)
				</label>
				<textarea
					id="gospelQuote"
					bind:value={formData.gospelQuote}
					placeholder="Enter the specific gospel quote/highlight chosen by the author, e.g.: 'Look, the virgin shall conceive and bear a son, and they shall name him Emmanuel.' (Matthew 1:23)"
					rows="3"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				></textarea>
				<p class="mt-1 text-xs text-gray-500">
					This is the specific quote the author selected for their reflection
				</p>
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
				{publishing ? 'Scheduling...' : 'Schedule on WordPress'}
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

<!-- HTML Preview Section -->
{#if formData.title && formData.reflectionText}
<div class="mt-12 border-t pt-8">
	<h2 class="text-2xl font-bold mb-4">HTML Preview</h2>
	<div class="bg-white border rounded-lg overflow-auto shadow-sm" style="max-height: 600px;">
		{@html generatePreviewHTML()}
	</div>
</div>
{/if}

<ToastContainer />
