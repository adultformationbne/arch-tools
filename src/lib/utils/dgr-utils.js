// DGR Utility functions

// Bible book abbreviations mapping
const bibleBooks = {
	// Old Testament
	'gen': 'Genesis', 'ge': 'Genesis', 'gn': 'Genesis',
	'ex': 'Exodus', 'exod': 'Exodus', 'exo': 'Exodus',
	'lev': 'Leviticus', 'le': 'Leviticus', 'lv': 'Leviticus',
	'num': 'Numbers', 'nu': 'Numbers', 'nm': 'Numbers', 'nb': 'Numbers',
	'deut': 'Deuteronomy', 'de': 'Deuteronomy', 'dt': 'Deuteronomy',
	'josh': 'Joshua', 'jos': 'Joshua', 'jsh': 'Joshua',
	'judg': 'Judges', 'jdg': 'Judges', 'jg': 'Judges', 'jdgs': 'Judges',
	'ruth': 'Ruth', 'rth': 'Ruth', 'ru': 'Ruth',
	'1sam': '1 Samuel', '1sm': '1 Samuel', '1sa': '1 Samuel', '1s': '1 Samuel',
	'2sam': '2 Samuel', '2sm': '2 Samuel', '2sa': '2 Samuel', '2s': '2 Samuel',
	'1kings': '1 Kings', '1kgs': '1 Kings', '1ki': '1 Kings', '1k': '1 Kings',
	'2kings': '2 Kings', '2kgs': '2 Kings', '2ki': '2 Kings', '2k': '2 Kings',
	'1chron': '1 Chronicles', '1chr': '1 Chronicles', '1ch': '1 Chronicles',
	'2chron': '2 Chronicles', '2chr': '2 Chronicles', '2ch': '2 Chronicles',
	'ezra': 'Ezra', 'ezr': 'Ezra', 'ez': 'Ezra',
	'neh': 'Nehemiah', 'ne': 'Nehemiah',
	'est': 'Esther', 'esth': 'Esther', 'es': 'Esther',
	'job': 'Job', 'jb': 'Job',
	'ps': 'Psalms', 'psalm': 'Psalms', 'pslm': 'Psalms', 'psa': 'Psalms', 'psm': 'Psalms', 'pss': 'Psalms',
	'prov': 'Proverbs', 'pro': 'Proverbs', 'prv': 'Proverbs', 'pr': 'Proverbs',
	'eccles': 'Ecclesiastes', 'eccle': 'Ecclesiastes', 'ecc': 'Ecclesiastes', 'ec': 'Ecclesiastes', 'qoh': 'Ecclesiastes',
	'song': 'Song of Solomon', 'sos': 'Song of Solomon', 'so': 'Song of Solomon', 'cant': 'Song of Solomon',
	'isa': 'Isaiah', 'is': 'Isaiah',
	'jer': 'Jeremiah', 'je': 'Jeremiah', 'jr': 'Jeremiah',
	'lam': 'Lamentations', 'la': 'Lamentations',
	'ezek': 'Ezekiel', 'eze': 'Ezekiel', 'ezk': 'Ezekiel',
	'dan': 'Daniel', 'da': 'Daniel', 'dn': 'Daniel',
	'hos': 'Hosea', 'ho': 'Hosea',
	'joel': 'Joel', 'jl': 'Joel',
	'amos': 'Amos', 'am': 'Amos',
	'obad': 'Obadiah', 'ob': 'Obadiah', 'obadiah': 'Obadiah',
	'jonah': 'Jonah', 'jnh': 'Jonah', 'jon': 'Jonah',
	'mic': 'Micah', 'mc': 'Micah', 'micah': 'Micah',
	'nah': 'Nahum', 'na': 'Nahum', 'nahum': 'Nahum',
	'hab': 'Habakkuk', 'hb': 'Habakkuk', 'habakkuk': 'Habakkuk',
	'zeph': 'Zephaniah', 'zep': 'Zephaniah', 'zp': 'Zephaniah', 'zephaniah': 'Zephaniah',
	'hag': 'Haggai', 'hg': 'Haggai', 'haggai': 'Haggai',
	'zech': 'Zechariah', 'zec': 'Zechariah', 'zc': 'Zechariah', 'zechariah': 'Zechariah',
	'mal': 'Malachi', 'ml': 'Malachi', 'malachi': 'Malachi',
	// New Testament
	'matt': 'Matthew', 'mt': 'Matthew',
	'mark': 'Mark', 'mrk': 'Mark', 'mar': 'Mark', 'mk': 'Mark', 'mr': 'Mark',
	'luke': 'Luke', 'luk': 'Luke', 'lk': 'Luke',
	'john': 'John', 'joh': 'John', 'jhn': 'John', 'jn': 'John',
	'acts': 'Acts', 'act': 'Acts', 'ac': 'Acts',
	'rom': 'Romans', 'ro': 'Romans', 'rm': 'Romans',
	'1cor': '1 Corinthians', '1co': '1 Corinthians',
	'2cor': '2 Corinthians', '2co': '2 Corinthians',
	'gal': 'Galatians', 'ga': 'Galatians',
	'eph': 'Ephesians', 'ephes': 'Ephesians',
	'phil': 'Philippians', 'php': 'Philippians', 'pp': 'Philippians',
	'col': 'Colossians', 'co': 'Colossians',
	'1thess': '1 Thessalonians', '1thes': '1 Thessalonians', '1th': '1 Thessalonians',
	'2thess': '2 Thessalonians', '2thes': '2 Thessalonians', '2th': '2 Thessalonians',
	'1tim': '1 Timothy', '1ti': '1 Timothy',
	'2tim': '2 Timothy', '2ti': '2 Timothy',
	'titus': 'Titus', 'tit': 'Titus', 'ti': 'Titus',
	'philem': 'Philemon', 'phm': 'Philemon', 'pm': 'Philemon',
	'heb': 'Hebrews',
	'james': 'James', 'jas': 'James', 'jm': 'James',
	'1pet': '1 Peter', '1pe': '1 Peter', '1pt': '1 Peter', '1p': '1 Peter',
	'2pet': '2 Peter', '2pe': '2 Peter', '2pt': '2 Peter', '2p': '2 Peter',
	'1john': '1 John', '1jhn': '1 John', '1jn': '1 John', '1j': '1 John',
	'2john': '2 John', '2jhn': '2 John', '2jn': '2 John', '2j': '2 John',
	'3john': '3 John', '3jhn': '3 John', '3jn': '3 John', '3j': '3 John',
	'jude': 'Jude', 'jud': 'Jude', 'jd': 'Jude',
	'rev': 'Revelation', 're': 'Revelation',
	// Apocrypha
	'tob': 'Tobit', 'tb': 'Tobit',
	'jth': 'Judith', 'jdth': 'Judith', 'jdt': 'Judith',
	'wis': 'Wisdom', 'ws': 'Wisdom',
	'sir': 'Sirach', 'ecclus': 'Ecclesiasticus',
	'bar': 'Baruch',
	'1macc': '1 Maccabees', '1mac': '1 Maccabees', '1ma': '1 Maccabees', '1m': '1 Maccabees',
	'2macc': '2 Maccabees', '2mac': '2 Maccabees', '2ma': '2 Maccabees', '2m': '2 Maccabees'
};

// Function to parse and expand Bible references
export function parseReadings(readingsStr) {
	if (!readingsStr) return [];

	// Split by semicolon to get individual readings
	const readings = readingsStr.split(';').map(r => r.trim());

	return readings.map(reading => {
		// Extract book abbreviation and verses
		const match = reading.match(/^((?:\d\s*)?[A-Za-z]+)\s*([\d:,\-–—\s]+)$/);
		if (!match) return { original: reading, book: reading, verses: '' };

		let [, bookAbbr, verses] = match;

		// Clean up book abbreviation (remove periods, spaces between numbers and letters)
		bookAbbr = bookAbbr.replace(/\./g, '').replace(/\s+/g, '').toLowerCase();

		// Look up full book name
		const fullName = bibleBooks[bookAbbr] || bookAbbr;

		return {
			original: reading,
			book: fullName,
			verses: verses.trim()
		};
	});
}

// New template-based DGR HTML generator
export async function generateDGRHTML(formData, options = {}) {
	const { templateKey = 'default', gospelFullText = '', gospelReference = '' } = options;

	// Format the date nicely
	const dateObj = new Date(formData.date);
	const formattedDate = dateObj.toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	// Prepare template data
	const templateData = {
		title: formData.title,
		date: formData.date,
		formattedDate: formattedDate,
		liturgicalDate: formData.liturgicalDate,
		readings: formData.readings,
		gospelQuote: formData.gospelQuote,
		reflectionText: formatReflectionText(formData.reflectionText),
		authorName: formData.authorName,
		gospelFullText: gospelFullText,
		gospelReference: gospelReference
	};

	// Call our template API
	const response = await fetch('/api/dgr-templates', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ templateKey, data: templateData })
	});

	if (!response.ok) {
		throw new Error('Failed to render template');
	}

	const result = await response.json();
	return result.html;
}

// Format reflection text into paragraphs
function formatReflectionText(text) {
	if (!text) return '';

	return text
		.split('\n\n')
		.filter(p => p.trim())
		.map(paragraph => {
			const content = paragraph.trim().replace(/\n/g, '<br>');
			return content ? `<p style="margin:0 0 18px 0;">${content}</p>` : '';
		})
		.filter(p => p)
		.join('');
}