import { decodeHtmlEntities } from './html.js';

/**
 * Shared scripture and gospel utilities
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

// Fetch gospel reading for a specific date using Universalis
export async function fetchGospelForDate(dateInput, region = 'australia.brisbane') {
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
					if (data && data.Mass_G && data.Mass_G.source) {
						const gospelSource = data.Mass_G.source;
						const cleanGospel = decodeHtmlEntities(gospelSource);
						
						resolve({
							success: true,
							passage: cleanGospel,
							reference: cleanGospel,
							universalisData: data
						});
					} else {
						resolve({
							success: false,
							error: 'No Gospel reading found in Universalis data',
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
			reject(new Error(`Error loading Gospel: ${err.message}`));
		}
	});
}

// Fetch gospel reading for date and then get the full text
export async function fetchGospelTextForDate(dateInput, version = 'NRSVAE', region = 'australia.brisbane') {
	try {
		console.log('Fetching gospel for date:', dateInput);
		
		// First, get the gospel reference from Universalis
		const gospelData = await fetchGospelForDate(dateInput, region);
		
		if (!gospelData.success) {
			throw new Error(gospelData.error || 'Failed to fetch gospel from Universalis');
		}

		console.log('Gospel reference from Universalis:', gospelData.passage);

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
	if (!readings) return '';
	
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