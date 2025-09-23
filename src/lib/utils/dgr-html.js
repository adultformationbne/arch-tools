// Centralized DGR HTML generation utility
// This ensures the preview and published content are identical

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

// Function to normalize gospel text HTML
export function normalizeGospelHTML(html) {
	if (!html) return '';

	// Log raw input
	console.log('=== NORMALIZE GOSPEL ===');
	console.log('RAW INPUT (FULL):', html);

	// Step 1: Remove all footnotes
	let normalized = html.replace(/<sup[^>]*class="footnote"[^>]*>.*?<\/sup>/g, '');
	
	// Step 2: Remove scripture headings/titles (h1, h2, h3, etc)
	normalized = normalized.replace(/<h[1-6][^>]*class="scripture-heading"[^>]*>.*?<\/h[1-6]>/g, '');
	
	// Step 3: Remove ALL verse numbers completely
	// Remove span verse numbers
	normalized = normalized.replace(/<span[^>]*class="[^"]*verse-[^"]*"[^>]*>\d+\s*<\/span>/g, '');
	// Remove sup verse numbers
	normalized = normalized.replace(/<sup[^>]*class="[^"]*(?:ii|vnumVis|verse-num|verse-sup)[^"]*"[^>]*>\d+<\/sup>/g, '');
	
	// Step 4: Simplify line breaks - just convert all special BR tags to regular BRs
	// Remove class attributes from BR tags
	normalized = normalized.replace(/<br\s+class="[^"]*">/g, '<br>');

	// Step 5: Clean up whitespace (but preserve line breaks)
	// Don't remove spaces after BR tags to preserve formatting
	// Only clean up excessive spaces (more than 2 in a row)
	normalized = normalized.replace(/\s{3,}/g, '  ');

	// Log output
	console.log('OUTPUT (FULL):', normalized);
	console.log('====================');

	return normalized;
}

// Function to escape HTML entities for RSS/XML compatibility
function escapeHtmlEntities(text) {
	if (!text) return '';
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, "'")  // Keep apostrophes as plain text, not HTML entities
		.replace(/'/g, "'")  // Convert left single quote to plain apostrophe
		.replace(/'/g, "'")  // Convert right single quote to plain apostrophe
		.replace(/"/g, '"')  // Convert left double quote to plain quote
		.replace(/"/g, '"'); // Convert right double quote to plain quote
}

// Function to clean HTML to prevent WordPress from adding unwanted <p> tags
function cleanHTMLForWordPress(html) {
	// Remove ALL HTML comments to prevent WordPress from wrapping them in <p> tags
	html = html.replace(/<!--[\s\S]*?-->/g, '');

	// Remove whitespace between block-level elements
	html = html.replace(/(<\/(div|article|section|header|footer|h[1-6]|blockquote|style)>)\s+(<(div|article|section|header|footer|h[1-6]|blockquote|style|p))/gi, '$1$3');

	// Remove empty lines and excessive whitespace
	html = html.replace(/\n\s*\n/g, '\n');

	// Trim whitespace at the beginning and end
	html = html.trim();

	return html;
}

// Main function to generate DGR HTML content
export async function generateDGRHTML(formData, options = {}) {
	const {
		useNewDesign = true,
		gospelFullText = '',
		gospelReference = '',
		includeWordPressCSS = false,
		promoTiles = null
	} = options;


	const dateObj = new Date(formData.date);
	const formattedDate = dateObj.toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	// Debug promo tiles
	console.log('=== DGR HTML Generation Debug ===');
	console.log('promoTiles:', promoTiles);
	console.log('promoTiles length:', promoTiles?.length);
	console.log('useNewDesign:', useNewDesign);
	console.log('================================');

	let finalHTML = '';
	
	if (useNewDesign) {
		finalHTML = `${includeWordPressCSS ? `
<style>
/* Hide the WordPress auto-generated h1.entry-title post title */
h1.entry-title {
  display: none !important;
}

/* Additional specific targeting for safety */
.single-post h1.entry-title,
.single h1.entry-title {
  display: none !important;
}

/* Sandboxed DGR styles - only apply to our content */
.dgr-content-wrapper {
  /* Isolate from Elementor styles */
  position: relative;
  z-index: 1;
}

/* Specific override for the icon divider to prevent Elementor flex conflicts */
.dgr-content-wrapper .dgr-icon-divider {
  display: flex !important;
  align-items: center !important;
  margin: 60px 0 !important;
  padding: 0 20px !important;
  flex-direction: row !important;
  justify-content: center !important;
  max-width: 100% !important;
  width: 100% !important;
}

.dgr-content-wrapper .dgr-divider-line {
  flex: 1 1 auto !important;
  height: 1px !important;
  min-height: 1px !important;
  max-height: 1px !important;
  background: #ddd !important;
  border: none !important;
  display: block !important;
}

.dgr-content-wrapper img.dgr-divider-icon {
  width: 24px !important;
  min-width: 24px !important;
  max-width: 24px !important;
  height: 24px !important;
  min-height: 24px !important;
  max-height: 24px !important;
  opacity: 0.4 !important;
  margin: 0 20px !important;
  flex: 0 0 24px !important;
  display: inline-block !important;
  object-fit: contain !important;
}
</style>
` : ''}
<div class="dgr-content-wrapper">
<article style="max-width:700px; margin:0 auto; font-family: Arial, Helvetica, sans-serif; line-height:1.6; color:#333;">

  <!-- Main Title -->
  <h1 style="font-family:'PT Serif', Georgia, serif; font-size:42px; font-weight:bold; color:#213d6b; text-align:center; margin:40px 0 40px 0;">
    Daily Gospel Reflections
  </h1>

  <!-- Header Image with rounded top corners only -->
  <div style="text-align:center; margin-bottom:0;">
    <img src="${[
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-6-1.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-7-1.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-8-1.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-15.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-14.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-13.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-12.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-11.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-10-1.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-9-1.png'
    ][Math.floor(Math.random() * 10)]}" 
         alt="Daily Gospel Reflections" 
         style="max-width:700px; width:100%; height:auto; display:block; border-radius:16px 16px 0 0;">
  </div>

  <!-- Header Section - Clean Modern Design (seamlessly connected to image) -->
  <div style="background:#fafafa; border:1px solid #e8e8e8; border-top:none; border-radius:0 0 16px 16px; padding:24px; margin-bottom:32px;">
    
    <!-- Centered Date with Liturgical Context -->
    <div style="text-align:center; margin-bottom:24px;">
      <div style="font-family:'PT Serif', Georgia, serif; font-size:24px; font-weight:700; color:#019da4; margin-bottom:6px;">${formattedDate}</div>
      <div style="font-size:14px; color:#666; font-style:italic;">${escapeHtmlEntities(formData.liturgicalDate)}</div>
    </div>
    
    <!-- Readings Section -->
    ${formData.readings ? `
      <div>
        <h3 style="font-size:14px; color:#666; margin:0 0 12px 0; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; text-align:center;">Today's Scripture Readings</h3>
        <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
          ${parseReadings(formData.readings).map((reading, index) => `<div style="background:#e6f7f7; border:1px solid #8dd3d3; color:#0d5f5f; padding:10px 16px; border-radius:24px; font-size:14px; font-weight:500; box-shadow:0 2px 4px rgba(1,157,164,0.1); transition:all 0.2s ease;"><span style="font-weight:600;">${reading.book}</span><span style="margin-left:6px; opacity:0.9;">${reading.verses}</span></div>`).join('')}
        </div>
      </div>
    ` : ''}
    
  </div>

  ${gospelFullText && gospelReference ? `
  <!-- Full Gospel Reading - Clean Card Style -->
  <div style="background: #f7f3ed; border: solid 1px #d1bd99; padding:35px; margin:30px 0; border-radius:20px; box-shadow:0 4px 12px rgba(0,0,0,0.08);">
    <!-- Gospel Reading label -->
    <div style="font-family: Arial, sans-serif; font-size: 12px; color: #7a6f5d; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">Gospel Reading</div>
    
    <!-- Scripture Reference in Orange -->
    <h2 style="font-family: 'PT Serif', Georgia, serif; font-size: 32px; color: #e28929; font-weight: 700; margin: 0 0 8px 0; line-height: 1.2;">${gospelReference}</h2>

    <!-- Bible Version -->
    <div style="font-family: Arial, sans-serif; font-size: 13px; color: #7a6f5d; margin-bottom: 20px;">NRSV</div>

    <!-- Scripture Content -->
    <div class="scripture-content" style="font-size:16px; color:#3a3a3a; line-height:1.75; font-family:Georgia, serif;">
      <style>
        /* Paragraphs - clean and simple */
        .scripture-content p {
          margin: 0 0 18px 0;
          line-height: 1.75;
        }
        
        /* Last paragraph no bottom margin */
        .scripture-content p:last-child {
          margin-bottom: 0;
        }
        
        /* Simple line breaks */
        .scripture-content br {
          display: block;
          content: "";
          margin: 10px 0;
        }
      </style>
      ${normalizeGospelHTML(gospelFullText)}
    </div>
  </div>

  <!-- NRSV Copyright Notice -->
  <div style="font-family: Arial, sans-serif; font-size: 11px; color: #8a8a8a; line-height: 1.5; margin: 15px 0 0 0; padding: 0 16px;">
    New Revised Standard Version Bible, copyright © 1989 National Council of the Churches of Christ in the United States of America. Used by permission. All rights reserved worldwide.
  </div>
  ` : ''}

  <!-- Icon Spacer with Lines -->
  <div class="dgr-icon-divider" style="display:flex !important; align-items:center !important; margin:60px 0 !important; padding:0 20px !important;">
    <div class="dgr-divider-line" style="flex:1 !important; height:1px !important; background:#ddd !important;"></div>
    <img src="${[
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-6.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-7.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-8.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-9.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-10.png'
    ][Math.floor(Math.random() * 5)]}"
         alt=""
         class="dgr-divider-icon"
         style="width:24px !important; height:24px !important; opacity:0.4 !important; margin:0 20px !important; max-width:24px !important; max-height:24px !important;">
    <div class="dgr-divider-line" style="flex:1 !important; height:1px !important; background:#ddd !important;"></div>
  </div>

  <!-- Reflection Label -->
  <h2 style="font-family:Arial, sans-serif; font-size:12px; font-weight:600; color:#1a5555; text-align:left; margin:0 0 20px 0; padding:0 16px; letter-spacing:1.5px; text-transform:uppercase;">Reflection</h2>

  <!-- Reflection Content Container -->
  <style>
    .reflection-content {
      padding:0 16px;
    }
    @media (max-width: 768px) {
      .reflection-content { padding:0 24px; }
    }
  </style>
  <div class="reflection-content">
    <!-- Title -->
    <h1 style="font-family:'PT Serif', Georgia, serif; font-size:28px; color:#2c7777; margin:0 0 20px;">${escapeHtmlEntities(formData.title)}</h1>

    <!-- Author's Gospel Quote/Highlight -->
    <blockquote style="margin:20px 0; padding-left:16px; border-left:3px solid #2c7777; font-style:italic; font-size:16px; color:#2c7777;">
      ${escapeHtmlEntities(formData.gospelQuote)}
    </blockquote>

    <!-- Reflection Text -->
    <div style="font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:1.7; color:#333; text-align:left; margin:30px 0;">
      ${formData.reflectionText
        .split('\n\n') // Split by double newlines for paragraphs
        .filter((p) => p.trim())
        .map((paragraph) => {
          const escapedParagraph = escapeHtmlEntities(paragraph.trim());
          const content = escapedParagraph.replace(/\n/g, '<br>');
          // Only create paragraph if it has actual content (not just <br> tags or whitespace)
          return content && content.replace(/<br>/g, '').trim() ?
            `<p style="margin:0 0 18px 0;">${content}</p>` : '';
        })
        .filter(p => p) // Remove empty strings
        .join('')}
    </div>
  </div>

  <!-- Author -->
  <div style="margin-top:30px; text-align:center;"><div style="display:inline-block; background:#e6f7f7; border:1px solid #8dd3d3; color:#0d5f5f; padding:8px 16px; border-radius:24px; font-size:14px; font-weight:500;"><span style="opacity:0.8; margin-right:6px;">Reflection by</span><strong>${escapeHtmlEntities(formData.authorName)}</strong></div></div>

</article>
<!-- Icon Spacer before Upcoming Events (no empty line) --><div style="max-width:700px; margin:0 auto;">
  <div class="dgr-icon-divider" style="display:flex !important; align-items:center !important; margin:60px 0 !important; padding:0 20px !important;">
    <div class="dgr-divider-line" style="flex:1 !important; height:1px !important; background:#ddd !important;"></div>
    <img src="${[
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-6.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-7.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-8.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-9.png',
      'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-10.png'
    ][Math.floor(Math.random() * 5)]}" 
         alt="" 
         class="dgr-divider-icon"
         style="width:24px !important; height:24px !important; opacity:0.4 !important; margin:0 20px !important; max-width:24px !important; max-height:24px !important;">
    <div class="dgr-divider-line" style="flex:1 !important; height:1px !important; background:#ddd !important;"></div>
  </div>
</div>

${promoTiles && promoTiles.length > 0 ? `
<!-- Upcoming Events Section -->
<style>
  .promo-container {
    max-width: 700px;
    margin: 60px auto 40px;
    padding: 30px;
    background: #f7f3ed;
    border-radius: 20px;
  }
  
  .promo-title {
    font-family: 'PT Serif', Georgia, serif;
    font-size: 26px;
    color: #213d6b;
    text-align: center;
    margin-bottom: 25px;
  }
  
  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .promo-container {
      margin: 40px auto 30px;
      padding: 20px;
    }
    
    .promo-title {
      font-size: 22px;
      margin-bottom: 20px;
    }
    
    /* Single tile on mobile - smaller */
    .single-tile {
      width: 80% !important;
      max-width: 280px !important;
    }
    
    /* Two tiles on mobile - stack vertically */
    .two-tiles {
      flex-direction: column !important;
      gap: 15px !important;
    }
    
    .two-tiles > div {
      width: 70% !important;
      max-width: 250px !important;
      margin: 0 auto;
    }
    
    /* Three tiles on mobile - stack vertically */
    .three-tiles {
      flex-direction: column !important;
      gap: 15px !important;
    }
    
    .three-tiles > div {
      width: 60% !important;
      max-width: 200px !important;
      margin: 0 auto;
    }
  }
</style>

<div class="promo-container">
  <h2 class="promo-title" style="font-family:'PT Serif', Georgia, serif !important; font-size:26px !important; color:#213d6b !important; text-align:center !important; margin:0 0 25px 0 !important; font-weight:700 !important; line-height:1.2 !important;">Upcoming Events</h2>
  
  ${promoTiles.length === 1 ? `
    <!-- Single tile - 90% of container width -->
    <div style="display:flex; justify-content:center;">
      ${promoTiles.map(tile => {
        if (tile.image_url) {
          const content = tile.link_url 
            ? `<a href="${tile.link_url}" target="_blank" style="display:block;"><img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:100%; object-fit:cover;"></a>`
            : `<img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:100%; object-fit:cover;">`;
          
          return `<div class="single-tile" style="width:100%; max-width:400px; aspect-ratio:1;">
            <div style="background:white; border-radius:8px; overflow:hidden; width:100%; height:100%;">
              ${content}
            </div>
          </div>`;
        }
        return '';
      }).join('')}
    </div>
  ` : promoTiles.length === 2 ? `
    <!-- Two tiles - ~40% each with gap -->
    <div class="two-tiles" style="display:flex; gap:20px; justify-content:center; flex-wrap:wrap;">
      ${promoTiles.map(tile => {
        if (tile.image_url) {
          const content = tile.link_url 
            ? `<a href="${tile.link_url}" target="_blank" style="display:block;"><img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:100%; object-fit:cover;"></a>`
            : `<img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:100%; object-fit:cover;">`;
          
          return `<div style="width:calc(45% - 10px); max-width:280px; aspect-ratio:1;">
            <div style="background:white; border-radius:8px; overflow:hidden; width:100%; height:100%;">
              ${content}
            </div>
          </div>`;
        }
        return '';
      }).join('')}
    </div>
  ` : `
    <!-- Three tiles - ~28% each with gaps -->
    <div class="three-tiles" style="display:flex; flex-wrap:wrap; gap:15px; justify-content:center;">
      ${promoTiles.map(tile => {
        if (tile.image_url) {
          const content = tile.link_url 
            ? `<a href="${tile.link_url}" target="_blank" style="display:block;"><img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:100%; object-fit:cover;"></a>`
            : `<img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:100%; object-fit:cover;">`;
          
          return `<div style="width:calc(32% - 10px); max-width:220px; min-width:180px; aspect-ratio:1;">
            <div style="background:white; border-radius:8px; overflow:hidden; width:100%; height:100%;">
              ${content}
            </div>
          </div>`;
        }
        return '';
      }).join('')}
    </div>
  `}
</div>
` : ''}

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
</div>
</div><!-- End dgr-content-wrapper -->

<!-- DGR HTML Version: 1.5.3 -->`;

	} else {
		// Original hero design - keeping existing logic
		const heroImageUrl = 'https://archdiocesanministries.org.au/wp-content/uploads/2024/10/image-20240803-012152-4ace2c2e-Large-Medium.jpeg';
		
		finalHTML = `${includeWordPressCSS ? `
<style>
/* Hide the WordPress auto-generated h1.entry-title post title */
h1.entry-title {
  display: none !important;
}

/* Additional specific targeting for safety */
.single-post h1.entry-title,
.single h1.entry-title {
  display: none !important;
}
</style>
` : ''}
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
    ${escapeHtmlEntities(formData.title)}
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
        <div style="margin-bottom: 0.3rem;">${escapeHtmlEntities(formData.liturgicalDate)}</div>
        <div style="font-style: italic; font-size: 0.9rem; font-family: 'PT Serif', Georgia, serif;">${escapeHtmlEntities(formData.readings)}</div>
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
      '${escapeHtmlEntities(formData.gospelQuote)}'
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
		.map((paragraph) => {
			const content = escapeHtmlEntities(paragraph.trim());
			// Only create paragraph if it has actual content
			return content ? `<p style="margin: 0 0 1.5rem 0; text-indent: 0;">${content}</p>` : '';
		})
		.filter(p => p) // Remove empty strings
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
    By ${escapeHtmlEntities(formData.authorName)}
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
</div>

<!-- DGR HTML Version: 1.5.3 -->`;
	}
	
	// Apply WordPress-specific cleaning to prevent wpautop from adding empty <p> tags
	return cleanHTMLForWordPress(finalHTML);
}

// Export version for tracking
export const DGR_HTML_VERSION = '1.5.3';