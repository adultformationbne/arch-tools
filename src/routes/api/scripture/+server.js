import { json, error } from '@sveltejs/kit';
import { normalizeScriptureReference } from '$lib/utils/dgr-common.js';

/**
 * Pull the scripture out of an oremus page, or return null.
 *
 * Returning null matters more than the extraction does. Oremus answers an
 * unparseable reference with a normal 200 whose body is its own error page, so
 * "we got HTML back" is not evidence of scripture. This used to fall back to
 * returning the whole page with success: true, and the publisher wrote that
 * page — inline JavaScript and all — into the reflection for 4 August 2026.
 *
 * @param {string} html
 * @returns {string | null}
 */
function extractScripture(html) {
	if (html.includes('<blockquote>')) {
		const start = html.indexOf('<blockquote>');
		const end = html.indexOf('</blockquote>');
		if (start !== -1 && end > start) return html.substring(start, end + 13);
	}

	if (html.includes('class="bibletext"')) {
		const start = html.indexOf('<div class="bibletext"');
		const end = html.indexOf('</div>', start);
		if (start !== -1 && end > start) return html.substring(start, end + 6);
	}

	if (html.includes('<div class="passage">')) {
		const start = html.indexOf('<div class="passage">');
		const end = html.indexOf('</div>', start);
		if (start !== -1 && end > start) return html.substring(start, end + 6);
	}

	return null;
}

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

		// Lectionary references such as "Matthew 15:1-2.10-14" separate verse
		// groups with dots, which oremus rejects. Normalise before asking.
		const normalizedPassage = normalizeScriptureReference(passage);
		const encodedPassage = encodeURIComponent(normalizedPassage);
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

		const scriptureContent = extractScripture(html);

		// No container means oremus did not return a passage — most often because
		// it could not parse the reference, which it reports in a 200. Failing here
		// is the whole point: callers treat success as publishable scripture.
		if (!scriptureContent) {
			const reason = html.match(/invalid bible reference:\s*([^<]+)/i);
			console.error(
				`[scripture] no passage returned for "${normalizedPassage}"` +
					(reason ? ` — oremus: invalid bible reference: ${reason[1].trim()}` : '')
			);
			throw error(
				502,
				reason
					? `Bible reference not recognised: ${normalizedPassage}`
					: `No scripture text returned for: ${normalizedPassage}`
			);
		}

		const result = {
			passage,
			normalizedPassage,
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
