<script lang="ts">
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	interface ScriptureReaderProps {
		initialPassage?: string;
		showGospelPicker?: boolean;
		showPopularPassages?: boolean;
		region?: string;
	}

	let {
		initialPassage = 'John 3:16',
		showGospelPicker = true,
		showPopularPassages = true,
		region = 'australia.brisbane'
	}: ScriptureReaderProps = $props();

	let passage = $state(initialPassage);
	let version = $state('NRSVAE');
	let scriptureContent = $state('');
	let loading = $state(false);
	let error = $state('');
	let activeFootnote = $state<{ text: string; x: number; y: number } | null>(null);
	let universalisData = $state<any>(null);
	let selectedDate = $state(new Date().toISOString().split('T')[0]);

	const versions = [
		{ value: 'NRSVAE', label: 'New Revised Standard Version Anglican Edition' },
		{ value: 'NRSV', label: 'New Revised Standard Version' },
		{ value: 'AV', label: 'Authorized Version (King James)' }
	];

	const popularPassages = [
		'John 3:16',
		'Matthew 5:3-12',
		'Psalm 23',
		'1 Corinthians 13',
		'Romans 8:28',
		'Philippians 4:13',
		'Isaiah 40:31',
		'Jeremiah 29:11'
	];

	// Parse and clean scripture HTML
	function parseScripture(html: string): string {
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

	async function fetchScripture() {
		if (!passage.trim()) return;

		loading = true;
		error = '';
		scriptureContent = '';

		try {
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

			if (data.success && data.content) {
				scriptureContent = parseScripture(data.content);
			} else {
				throw new Error('Invalid response from scripture API');
			}
		} catch (err) {
			error = `Error fetching scripture: ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			loading = false;
		}
	}

	async function fetchGospelForDate(dateInput?: string) {
		try {
			loading = true;
			error = '';

			const targetDate = dateInput ? new Date(dateInput) : new Date(selectedDate);
			const year = targetDate.getFullYear();
			const month = String(targetDate.getMonth() + 1).padStart(2, '0');
			const day = String(targetDate.getDate()).padStart(2, '0');
			const dateStr = `${year}${month}${day}`;

			const callbackName = 'universalisCallback' + Date.now();

			window[callbackName] = function (data: any) {
				universalisData = data;
				loading = false;

				if (data && data.Mass_G && data.Mass_G.source) {
					const gospelSource = data.Mass_G.source;
					let cleanGospel = decodeHtmlEntities(gospelSource);

					passage = cleanGospel;
					fetchScripture();
				} else {
					error = 'No Gospel reading found in Universalis data';
				}

				document.head.removeChild(script);
				delete window[callbackName];
			};

			const script = document.createElement('script');
			script.src = `https://universalis.com/${region}/${dateStr}/jsonpmass.js?callback=${callbackName}`;
			script.onerror = () => {
				error = 'Failed to load liturgical data from Universalis';
				document.head.removeChild(script);
				delete window[callbackName];
				loading = false;
			};

			document.head.appendChild(script);
		} catch (err) {
			error = `Error loading Gospel: ${err instanceof Error ? err.message : String(err)}`;
			loading = false;
		}
	}

	async function fetchTodaysGospel() {
		const today = new Date().toISOString().split('T')[0];
		selectedDate = today;
		await fetchGospelForDate(today);
	}

	function selectPassage(selectedPassage: string) {
		passage = selectedPassage;
		fetchScripture();
	}

	function handleFootnoteClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('footnote')) {
			event.preventDefault();
			const footnoteText = target.getAttribute('data-footnote') || '';
			const rect = target.getBoundingClientRect();
			activeFootnote = {
				text: footnoteText,
				x: rect.left + rect.width / 2,
				y: rect.top
			};
		}
	}

	function closeFootnote() {
		activeFootnote = null;
	}

	$effect(() => {
		if (passage) {
			fetchScripture();
		}
	});
</script>

<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
	<!-- Search Form -->
	<div class="mb-6 rounded-lg border bg-white p-6 shadow-sm">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				fetchScripture();
			}}
			class="space-y-4"
		>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="passage" class="mb-1 block text-sm font-medium text-gray-700">
						Bible Passage
					</label>
					<input
						id="passage"
						type="text"
						bind:value={passage}
						placeholder="e.g. John 3:16, Matthew 5:1-12, Psalm 23"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
						required
					/>
				</div>

				<div>
					<label for="version" class="mb-1 block text-sm font-medium text-gray-700">
						Bible Version
					</label>
					<select
						id="version"
						bind:value={version}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					>
						{#each versions as ver}
							<option value={ver.value}>{ver.label}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="flex gap-2">
				<button
					type="submit"
					disabled={loading}
					class="rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading ? 'Loading...' : 'Look Up Passage'}
				</button>

				{#if showGospelPicker}
					<button
						type="button"
						onclick={fetchTodaysGospel}
						disabled={loading}
						class="rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						📖 Today's Gospel
					</button>
				{/if}
			</div>
		</form>
	</div>

	<!-- Date Picker for Gospel Readings -->
	{#if showGospelPicker}
		<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-6 shadow-sm">
			<h3 class="mb-4 text-lg font-medium text-green-800">📅 Gospel for Any Date</h3>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					fetchGospelForDate();
				}}
				class="space-y-4"
			>
				<div class="grid grid-cols-1 items-end gap-4 md:grid-cols-2">
					<div>
						<label for="selectedDate" class="mb-1 block text-sm font-medium text-green-700">
							Select Date
						</label>
						<input
							id="selectedDate"
							type="date"
							bind:value={selectedDate}
							class="w-full rounded-md border border-green-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-green-500 focus:outline-none"
							required
						/>
					</div>

					<div>
						<button
							type="submit"
							disabled={loading}
							class="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
						>
							{loading ? 'Loading...' : '🔍 Get Gospel for Date'}
						</button>
					</div>
				</div>

				<p class="text-sm text-green-600">
					Get the Gospel reading from the {region === 'australia.brisbane'
						? 'Brisbane Catholic'
						: 'liturgical'} calendar for any date.
				</p>
			</form>
		</div>
	{/if}

	<!-- Popular Passages -->
	{#if showPopularPassages}
		<div class="mb-6 rounded-lg bg-gray-50 p-4">
			<h3 class="mb-3 text-sm font-medium text-gray-700">Popular Passages:</h3>
			<div class="flex flex-wrap gap-2">
				{#each popularPassages as popular}
					<button
						onclick={() => selectPassage(popular)}
						class="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
					>
						{popular}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Results -->
	{#if loading}
		<div class="rounded-lg border bg-white p-8 text-center shadow-sm">
			<div class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
			<p class="text-gray-600">Loading scripture...</p>
		</div>
	{:else if error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-4">
			<div class="flex items-center">
				<svg class="mr-2 h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					/>
				</svg>
				<p class="text-red-800">{error}</p>
			</div>
		</div>
	{:else if scriptureContent}
		<div class="rounded-lg border bg-white shadow-sm">
			<div class="p-6">
				<h2 class="mb-4 text-xl font-semibold text-gray-900">{passage} ({version})</h2>
				<div class="scripture-content" onclick={handleFootnoteClick}>
					{@html scriptureContent}
				</div>
			</div>
		</div>
	{:else}
		<div class="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
			<p class="text-gray-600">No scripture content to display. Try looking up a passage.</p>
		</div>
	{/if}

	<!-- Universalis data debug - show if data exists -->
	{#if universalisData}
		<div class="mt-6">
			<details class="rounded-lg border border-blue-200 bg-blue-50 p-4">
				<summary class="cursor-pointer text-sm font-medium text-blue-700 hover:text-blue-900">
					📊 Liturgical Calendar Data
				</summary>
				<div class="mt-4">
					<h4 class="mb-2 font-semibold text-blue-800">Available Data:</h4>
					<ul class="mb-4 space-y-1 text-xs text-blue-700">
						<li><strong>Date:</strong> {universalisData.date || 'N/A'}</li>
						<li><strong>Gospel Source:</strong> {universalisData.Mass_G?.source || 'N/A'}</li>
						<li><strong>Gospel Heading:</strong> {universalisData.Mass_G?.heading || 'N/A'}</li>
						<li><strong>First Reading:</strong> {universalisData.Mass_R1?.source || 'N/A'}</li>
						<li><strong>Psalm:</strong> {universalisData.Mass_Ps?.source || 'N/A'}</li>
					</ul>
				</div>
			</details>
		</div>
	{/if}
</div>

<!-- Footnote popup -->
{#if activeFootnote}
	<div
		class="footnote-popup"
		style="left: {activeFootnote.x}px; top: {activeFootnote.y - 10}px;"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="footnote-arrow"></div>
		<div class="footnote-content">
			{activeFootnote.text}
		</div>
		<button class="footnote-close" onclick={closeFootnote} aria-label="Close footnote"> × </button>
	</div>
{/if}

{#if activeFootnote}
	<div class="footnote-backdrop" onmousedown={closeFootnote} aria-label="Close footnote"></div>
{/if}

<style>
	/* Beautiful scripture typography */
	:global(.scripture-content) {
		font-family: 'Georgia', 'Times New Roman', serif;
		line-height: 1.8;
		color: #1a202c !important;
	}

	:global(.scripture-content *) {
		color: inherit;
	}

	:global(.scripture-content .passage-ref) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827 !important;
		margin-top: 0;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	:global(.scripture-content .scripture-heading) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		font-size: 1.125rem;
		font-weight: 600;
		color: #374151 !important;
		margin-top: 2rem;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	:global(.scripture-content .scripture-heading:first-child) {
		margin-top: 0;
	}

	:global(.scripture-content p) {
		margin-bottom: 1rem;
		text-align: justify;
		hyphens: auto;
		color: #1a202c !important;
	}

	/* Verse numbers - superscript style (within text) */
	:global(.scripture-content .verse-num.verse-sup) {
		font-size: 0.7rem;
		font-weight: 600;
		color: #9ca3af !important;
		vertical-align: super;
		margin-left: 0.125rem;
		margin-right: 0.25rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	/* Verse numbers - span style (start of verse) */
	:global(.scripture-content .verse-num.verse-span) {
		display: inline-block;
		min-width: 1.75rem;
		margin-right: 0.5rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: #6b7280 !important;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
		vertical-align: baseline;
	}

	:global(.scripture-content .footnote) {
		color: #2563eb !important;
		font-size: 0.75rem;
		cursor: help;
		vertical-align: super;
		font-weight: bold;
		padding: 0 0.125rem;
	}

	:global(.scripture-content .footnote:hover) {
		color: #1d4ed8 !important;
		text-decoration: underline;
	}

	/* Poetry and quotation formatting */
	:global(.scripture-content .poetry-line) {
		display: block;
		margin-left: 2rem;
		margin-bottom: 0.25rem;
	}

	:global(.scripture-content .indented-quote) {
		display: block;
		margin-left: 3rem;
		margin-bottom: 0.5rem;
		font-style: italic;
	}

	:global(.scripture-content .paragraph-break) {
		display: block;
		margin-bottom: 1rem;
	}

	:global(.scripture-content .section-break) {
		display: block;
		margin-bottom: 2rem;
	}

	:global(.scripture-content NN) {
		font-style: italic;
		color: #6b7280 !important;
		font-size: 0.95em;
	}

	/* Responsive font sizing */
	@media (min-width: 768px) {
		:global(.scripture-content) {
			font-size: 1.125rem;
		}

		:global(.scripture-content .scripture-heading) {
			font-size: 1.5rem;
		}
	}

	/* Footnote popup styles */
	.footnote-popup {
		position: fixed;
		z-index: 1000;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow:
			0 10px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
		padding: 1rem 2rem 1rem 1rem;
		max-width: 300px;
		transform: translateX(-50%) translateY(-100%);
		animation: footnote-appear 0.2s ease-out;
	}

	.footnote-arrow {
		position: absolute;
		bottom: -6px;
		left: 50%;
		transform: translateX(-50%);
		width: 12px;
		height: 12px;
		background: white;
		border-right: 1px solid #e5e7eb;
		border-bottom: 1px solid #e5e7eb;
		transform: translateX(-50%) rotate(45deg);
	}

	.footnote-content {
		font-size: 0.875rem;
		line-height: 1.5;
		color: #374151;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.footnote-close {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: none;
		border: none;
		font-size: 1.5rem;
		line-height: 1;
		color: #9ca3af;
		cursor: pointer;
		padding: 0.25rem;
		transition: color 0.2s;
	}

	.footnote-close:hover {
		color: #4b5563;
	}

	.footnote-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 999;
	}

	@keyframes footnote-appear {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(-90%);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(-100%);
		}
	}
</style>
