import { json, error } from '@sveltejs/kit';

export async function GET({ url }) {

	try {
		const passage = url.searchParams.get('passage');
		const version = url.searchParams.get('version') || 'NRSVAE';
		const vnum = url.searchParams.get('vnum') || 'yes';
		const fnote = url.searchParams.get('fnote') || 'no';
		const show_ref = url.searchParams.get('show_ref') || 'yes';
		const headings = url.searchParams.get('headings') || 'yes';


		if (!passage) {
			throw error(400, 'Passage parameter is required');
		}

		const encodedPassage = encodeURIComponent(passage);
		const bibleUrl = `https://bible.oremus.org/?version=${version}&passage=${encodedPassage}&vnum=${vnum}&fnote=${fnote}&show_ref=${show_ref}&headings=${headings}`;


		const response = await fetch(bibleUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-AU,en;q=0.9',
				'Accept-Encoding': 'gzip, deflate, br',
				'Connection': 'keep-alive',
				'Upgrade-Insecure-Requests': '1'
			}
		});

		if (!response.ok) {
			throw error(response.status, `Bible API error: ${response.statusText}`);
		}

		const html = await response.text();

		// Extract the main content from the HTML
		// The oremus API returns full HTML pages, we need to extract just the scripture content
		let scriptureContent = html;

		// Try different methods to extract scripture content

		// Method 1: Look for blockquote
		if (html.includes('<blockquote>')) {
			const blockquoteStart = html.indexOf('<blockquote>');
			const blockquoteEnd = html.indexOf('</blockquote>') + 13;
			if (blockquoteStart !== -1 && blockquoteEnd !== -1) {
				scriptureContent = html.substring(blockquoteStart, blockquoteEnd);
			}
		}
		// Method 2: Look for div with class="bibletext" or similar
		else if (html.includes('class="bibletext"')) {
			const start = html.indexOf('<div class="bibletext"');
			const end = html.indexOf('</div>', start) + 6;
			if (start !== -1 && end !== -1) {
				scriptureContent = html.substring(start, end);
			}
		}
		// Method 3: Look for content between specific markers
		else if (html.includes('<div class="passage">')) {
			const start = html.indexOf('<div class="passage">');
			const end = html.indexOf('</div>', start) + 6;
			if (start !== -1 && end !== -1) {
				scriptureContent = html.substring(start, end);
			}
		}
		// Method 4: Try to find content after a common pattern
		else {

			// Look for verse numbers which indicate scripture content
			const versePattern = /<sup class="verse">/i;
			if (versePattern.test(html)) {
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
				}
			} else {
				// As fallback, try to remove obvious page elements
				let cleaned = html;
				// Remove head section
				cleaned = cleaned.replace(/<head>[\s\S]*?<\/head>/i, '');
				// Remove navigation
				cleaned = cleaned.replace(/<div[^>]*nav[^>]*>[\s\S]*?<\/div>/gi, '');
				// Remove footer
				cleaned = cleaned.replace(/<div[^>]*footer[^>]*>[\s\S]*?<\/div>/gi, '');

				scriptureContent = cleaned;
			}
		}

		const result = {
			passage,
			version,
			content: scriptureContent,
			success: true
		};

		return json(result);
	} catch (err) {
		console.error('❌ Scripture API error:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, `Failed to fetch scripture: ${err.message}`);
	}
}
