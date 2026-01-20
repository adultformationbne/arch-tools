import { decodeHtmlEntities } from './html.js';

/**
 * Shared scripture and gospel utilities
 *
 * IMPORTANT DISTINCTION:
 * - For READING REFERENCES (citations like "Matthew 5:1-10"): Use DATABASE LECTIONARY
 *   - DGR schedule generation uses: /api/dgr/readings -> get_readings_for_date() RPC
 *   - Fast, local, no external API calls
 *
 * - For GOSPEL TEXT (actual scripture content): Use UNIVERSALIS + OREMUS
 *   - ScriptureReader component uses: fetchGospelTextForDate() -> Universalis -> Oremus
 *   - Universalis gives reference, Oremus gives full formatted text
 *   - This is for displaying actual Bible text to users
 */

// Parse and clean scripture HTML from oremus.org
export function parseScripture(html) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const container = doc.querySelector('.bibletext');

	if (!container) return html;

	// Process section headings
	container.querySelectorAll('h2').forEach((h2) => {
		if (h2.innerHTML.includes('&nbsp;')) {
			h2.className = 'passage-ref';
		} else {
			h2.className = 'scripture-heading';
		}
	});

	// Process verse numbers - different types
	container.querySelectorAll('sup.ww.vnumVis').forEach((verse) => {
		verse.className = 'verse-num verse-sup';
	});

	container.querySelectorAll('span.cc.vnumVis, span.vv.vnumVis').forEach((verse) => {
		verse.className = 'verse-num verse-span';
	});

	// Remove empty paragraphs and clean up
	container.querySelectorAll('p').forEach((p) => {
		if (!p.textContent?.trim() || p.innerHTML.trim() === '<br>') {
			p.remove();
		}
	});

	// Process footnotes
	container.querySelectorAll('a[onmouseover]').forEach((link) => {
		const footnoteText =
			link.getAttribute('onmouseover')?.match(/return overlib\('(.+?)'\)/)?.[1] || '';

		const footnote = link.querySelector('sup.fnote');
		if (footnote) {
			footnote.setAttribute('data-footnote', footnoteText.replace(/<[^>]*>/g, ''));
			footnote.className = 'footnote';
			footnote.setAttribute('title', footnoteText.replace(/<[^>]*>/g, ''));
		}

		link.replaceWith(footnote || '');
	});

	// Clean up special characters and process breaks
	let cleanedHTML = container.innerHTML
		.replace(/&#145;/g, '\u2018')
		.replace(/&#146;/g, '\u2019')
		.replace(/&#147;/g, '\u201C')
		.replace(/&#148;/g, '\u201D')
		.replace(/&#151;/g, '\u2014')
		.replace(/&nbsp;/g, ' ')
		.replace(/<br class="kk">/g, '<br class="poetry-line">')
		.replace(/<br class="ii">/g, '<br class="indented-quote">')
		.replace(/<br class="uu">/g, '<br class="paragraph-break">')
		.replace(/<br class="plus-b">/g, '<br class="section-break">')
		.replace(/<!--.*?-->/g, '');

	return cleanedHTML;
}

// Fetch scripture passage from our API
export async function fetchScripturePassage(passage, version = 'NRSVAE') {
	if (!passage?.trim()) {
		throw new Error('Passage is required');
	}

	const params = new URLSearchParams({
		passage,
		version,
		vnum: 'yes',
		fnote: 'no',
		show_ref: 'yes',
		headings: 'yes'
	});

	const response = await fetch(`/api/scripture?${params}`);

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
	}

	const data = await response.json();

	if (!data.success || !data.content) {
		throw new Error('Invalid response from scripture API');
	}

	return {
		...data,
		content: parseScripture(data.content)
	};
}

// ========================================================================
// UNIVERSALIS API FUNCTIONS - FOR GOSPEL TEXT ONLY (WITH OREMUS)
// ========================================================================
// These functions fetch from Universalis API to get gospel references,
// which are then used with Oremus API to get the full gospel TEXT.
// DO NOT use these for getting reading REFERENCES - use database instead!
// ========================================================================

// Fetch all readings for a specific date using Universalis API
// NOTE: This is ONLY used for getting gospel text in ScriptureReader component
// For DGR reading references, use database lectionary instead
export async function fetchAllReadingsForDate(dateInput, region = 'australia.brisbane') {
	return new Promise((resolve, reject) => {
		try {
			const targetDate = dateInput ? new Date(dateInput) : new Date();
			const year = targetDate.getFullYear();
			const month = String(targetDate.getMonth() + 1).padStart(2, '0');
			const day = String(targetDate.getDate()).padStart(2, '0');
			const dateStr = `${year}${month}${day}`;

			const callbackName = 'universalisCallback' + Date.now();

			// Set up callback function
			window[callbackName] = function (data) {
				try {
					if (data) {
						const readings = normalizeUniversalisReadings(data);

						resolve({
							success: true,
							readings: readings,
							liturgicalDate: data.date || '',
							universalisData: data
						});
					} else {
						resolve({
							success: false,
							error: 'No readings data found in Universalis response',
							universalisData: data
						});
					}
				} catch (err) {
					reject(new Error(`Error processing Universalis data: ${err.message}`));
				} finally {
					// Cleanup
					document.head.removeChild(script);
					delete window[callbackName];
				}
			};

			// Create and load script
			const script = document.createElement('script');
			script.src = `https://universalis.com/${region}/${dateStr}/jsonpmass.js?callback=${callbackName}`;
			script.onerror = () => {
				document.head.removeChild(script);
				delete window[callbackName];
				reject(new Error('Failed to load liturgical data from Universalis'));
			};

			document.head.appendChild(script);
		} catch (err) {
			reject(new Error(`Error loading readings: ${err.message}`));
		}
	});
}

// Fetch gospel reference for a specific date using Universalis
// NOTE: This is for getting the gospel REFERENCE to then fetch TEXT from Oremus
// For DGR reading references, use database lectionary instead
export async function fetchGospelForDate(dateInput, region = 'australia.brisbane') {
	try {
		const result = await fetchAllReadingsForDate(dateInput, region);
		if (result.success && result.readings?.gospel) {
			return {
				success: true,
				passage: result.readings.gospel.source,
				reference: result.readings.gospel.source,
				universalisData: result.universalisData
			};
		} else {
			return {
				success: false,
				error: 'No Gospel reading found in Universalis data',
				universalisData: result.universalisData
			};
		}
	} catch (err) {
		throw err;
	}
}

// Fetch gospel reading for date and then get the full TEXT from Oremus
// This is the CORRECT function for getting gospel text to display
// Flow: Universalis (get reference) -> Oremus (get full text)
export async function fetchGospelTextForDate(dateInput, version = 'NRSVAE', region = 'australia.brisbane') {
	try {
		
		// First, get the gospel reference from Universalis
		const gospelData = await fetchGospelForDate(dateInput, region);
		
		if (!gospelData.success) {
			throw new Error(gospelData.error || 'Failed to fetch gospel from Universalis');
		}


		// Then fetch the full text from our scripture API
		const scriptureData = await fetchScripturePassage(gospelData.passage, version);

		return {
			success: true,
			reference: gospelData.passage,
			content: scriptureData.content,
			universalisData: gospelData.universalisData
		};
	} catch (err) {
		console.error('Error fetching gospel text for date:', err);
		return {
			success: false,
			error: err.message
		};
	}
}

// Extract gospel reference from readings list (e.g., "Mt 1:1-16, 18-23" from full readings)
export function extractGospelReference(readings) {
	if (!readings || typeof readings !== 'string') return '';

	// Look for gospel references (Mt, Mk, Lk, Jn)
	const gospelMatch = readings.match(/(Mt|Mk|Lk|Jn)\s+[\d:,-\s]+/);
	if (gospelMatch) {
		let ref = gospelMatch[0].trim();
		// Convert abbreviations to full names
		ref = ref.replace(/^Mt\s+/, 'Matthew ');
		ref = ref.replace(/^Mk\s+/, 'Mark ');
		ref = ref.replace(/^Lk\s+/, 'Luke ');
		ref = ref.replace(/^Jn\s+/, 'John ');
		return ref;
	}
	return '';
}

// Normalize Universalis API readings data into structured format
// NOTE: This is ONLY used by Universalis-based gospel text functions above
// DGR schedule generation now uses database lectionary instead
export function normalizeUniversalisReadings(universalisData) {
	const readings = {};

	// First Reading
	if (universalisData.Mass_R1?.source) {
		readings.first_reading = {
			source: decodeHtmlEntities(universalisData.Mass_R1.source),
			text: universalisData.Mass_R1.text ? decodeHtmlEntities(universalisData.Mass_R1.text) : '',
			heading: universalisData.Mass_R1.heading ? decodeHtmlEntities(universalisData.Mass_R1.heading) : ''
		};
	}

	// Responsorial Psalm
	if (universalisData.Mass_Ps?.source) {
		readings.psalm = {
			source: decodeHtmlEntities(universalisData.Mass_Ps.source),
			text: universalisData.Mass_Ps.text ? decodeHtmlEntities(universalisData.Mass_Ps.text) : ''
		};
	}

	// Second Reading (optional - not present on all days)
	if (universalisData.Mass_R2?.source) {
		readings.second_reading = {
			source: decodeHtmlEntities(universalisData.Mass_R2.source),
			text: universalisData.Mass_R2.text ? decodeHtmlEntities(universalisData.Mass_R2.text) : '',
			heading: universalisData.Mass_R2.heading ? decodeHtmlEntities(universalisData.Mass_R2.heading) : ''
		};
	}

	// Gospel Acclamation
	if (universalisData.Mass_GA?.source) {
		readings.gospel_acclamation = {
			source: decodeHtmlEntities(universalisData.Mass_GA.source),
			text: universalisData.Mass_GA.text ? decodeHtmlEntities(universalisData.Mass_GA.text) : ''
		};
	}

	// Gospel
	if (universalisData.Mass_G?.source) {
		readings.gospel = {
			source: decodeHtmlEntities(universalisData.Mass_G.source),
			text: universalisData.Mass_G.text ? decodeHtmlEntities(universalisData.Mass_G.text) : '',
			heading: universalisData.Mass_G.heading ? decodeHtmlEntities(universalisData.Mass_G.heading) : ''
		};
	}

	// Generate combined readings string in the format used by DGR forms
	// Format: "First Reading; Psalm; Second Reading; Gospel" (skipping optional second reading if not present)
	const readingsSources = [];
	if (readings.first_reading?.source) readingsSources.push(readings.first_reading.source);
	if (readings.psalm?.source) readingsSources.push(readings.psalm.source);
	if (readings.second_reading?.source) readingsSources.push(readings.second_reading.source);
	if (readings.gospel?.source) readingsSources.push(readings.gospel.source);

	readings.combined_sources = readingsSources.join('; ');

	return readings;
}

// Format readings data for display in DGR forms and templates
export function formatReadingsForDisplay(readingsData) {
	if (!readingsData) return '';

	// Return the combined sources format that matches your Word document style
	return readingsData.combined_sources || '';
}