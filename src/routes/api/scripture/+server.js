import { json, error } from '@sveltejs/kit';

export async function GET({ url }) {
	console.log('🔍 Scripture API called with URL:', url.href);

	try {
		const passage = url.searchParams.get('passage');
		const version = url.searchParams.get('version') || 'NRSVAE';
		const vnum = url.searchParams.get('vnum') || 'yes';
		const fnote = url.searchParams.get('fnote') || 'no';
		const show_ref = url.searchParams.get('show_ref') || 'yes';
		const headings = url.searchParams.get('headings') || 'yes';

		console.log('📖 Parameters:', { passage, version, vnum, fnote, show_ref, headings });

		if (!passage) {
			console.log('❌ No passage provided');
			throw error(400, 'Passage parameter is required');
		}

		const encodedPassage = encodeURIComponent(passage);
		const bibleUrl = `https://bible.oremus.org/?version=${version}&passage=${encodedPassage}&vnum=${vnum}&fnote=${fnote}&show_ref=${show_ref}&headings=${headings}`;

		console.log('🌐 Fetching from Bible API:', bibleUrl);

		const response = await fetch(bibleUrl);
		console.log('📡 Bible API response status:', response.status, response.statusText);

		if (!response.ok) {
			console.log('❌ Bible API error:', response.status, response.statusText);
			throw error(response.status, `Bible API error: ${response.statusText}`);
		}

		const html = await response.text();
		console.log('📄 HTML response length:', html.length);
		console.log('📄 HTML preview (first 500 chars):', html.substring(0, 500));

		// Extract the main content from the HTML
		// The oremus API returns full HTML pages, we need to extract just the scripture content
		let scriptureContent = html;

		// Try different methods to extract scripture content
		console.log('📝 Looking for content patterns...');

		// Method 1: Look for blockquote
		if (html.includes('<blockquote>')) {
			console.log('📝 Found blockquote, extracting content');
			const blockquoteStart = html.indexOf('<blockquote>');
			const blockquoteEnd = html.indexOf('</blockquote>') + 13;
			if (blockquoteStart !== -1 && blockquoteEnd !== -1) {
				scriptureContent = html.substring(blockquoteStart, blockquoteEnd);
				console.log('📝 Extracted blockquote content length:', scriptureContent.length);
			}
		}
		// Method 2: Look for div with class="bibletext" or similar
		else if (html.includes('class="bibletext"')) {
			console.log('📝 Found bibletext class');
			const start = html.indexOf('<div class="bibletext"');
			const end = html.indexOf('</div>', start) + 6;
			if (start !== -1 && end !== -1) {
				scriptureContent = html.substring(start, end);
				console.log('📝 Extracted bibletext content length:', scriptureContent.length);
			}
		}
		// Method 3: Look for content between specific markers
		else if (html.includes('<div class="passage">')) {
			console.log('📝 Found passage div');
			const start = html.indexOf('<div class="passage">');
			const end = html.indexOf('</div>', start) + 6;
			if (start !== -1 && end !== -1) {
				scriptureContent = html.substring(start, end);
				console.log('📝 Extracted passage content length:', scriptureContent.length);
			}
		}
		// Method 4: Try to find content after a common pattern
		else {
			console.log('📝 Trying to find content by patterns...');

			// Look for verse numbers which indicate scripture content
			const versePattern = /<sup class="verse">/i;
			if (versePattern.test(html)) {
				console.log('📝 Found verse numbers, extracting surrounding content');
				// Find a section that contains verse numbers
				const lines = html.split('\n');
				let contentLines = [];
				let foundVerseContent = false;

				for (let line of lines) {
					if (versePattern.test(line) || foundVerseContent) {
						contentLines.push(line);
						foundVerseContent = true;
					}
					// Stop if we hit footer or navigation
					if (line.includes('</body>') || line.includes('<div class="nav">')) {
						break;
					}
				}

				if (contentLines.length > 0) {
					scriptureContent = contentLines.join('\n');
					console.log('📝 Extracted verse-based content length:', scriptureContent.length);
				}
			} else {
				console.log('📝 No clear content patterns found, returning trimmed HTML');
				// As fallback, try to remove obvious page elements
				let cleaned = html;
				// Remove head section
				cleaned = cleaned.replace(/<head>[\s\S]*?<\/head>/i, '');
				// Remove navigation
				cleaned = cleaned.replace(/<div[^>]*nav[^>]*>[\s\S]*?<\/div>/gi, '');
				// Remove footer
				cleaned = cleaned.replace(/<div[^>]*footer[^>]*>[\s\S]*?<\/div>/gi, '');

				scriptureContent = cleaned;
				console.log('📝 Cleaned HTML content length:', scriptureContent.length);
			}
		}

		const result = {
			passage,
			version,
			content: scriptureContent,
			success: true
		};

		console.log('✅ Returning successful response');
		return json(result);
	} catch (err) {
		console.error('❌ Scripture API error:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, `Failed to fetch scripture: ${err.message}`);
	}
}
