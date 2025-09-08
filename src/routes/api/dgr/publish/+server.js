import { WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD } from '$env/static/private';
import { readFileSync } from 'fs';
import { join } from 'path';
import { decodeHtmlEntities } from '$lib/utils/html.js';

// Clean and format scripture HTML content
function cleanScriptureHTML(html) {
	// Remove verse numbers and formatting
	let cleaned = html
		.replace(/<sup[^>]*>.*?<\/sup>/g, '') // Remove superscript verse numbers
		.replace(/<span class="[^"]*vnumVis[^"]*"[^>]*>.*?<\/span>/g, '') // Remove verse numbers
		.replace(/<a[^>]*>.*?<\/a>/g, '') // Remove links
		.replace(/<h[1-6][^>]*>.*?<\/h[1-6]>/g, '') // Remove headings
		.replace(/\s+/g, ' ') // Normalize whitespace
		.trim();
	
	return cleaned;
}

// Function to fetch scripture content from the API
async function fetchScriptureContent(passage, version = 'NRSVAE') {
	try {
		console.log('Fetching scripture for passage:', passage);
		const encodedPassage = encodeURIComponent(passage);
		const url = `https://bible.oremus.org/?version=${version}&passage=${encodedPassage}&vnum=yes&fnote=no&show_ref=yes&headings=yes`;
		console.log('Scripture URL:', url);
		
		const response = await fetch(url);
		
		if (!response.ok) {
			console.error('Scripture fetch failed:', response.status, response.statusText);
			throw new Error(`Failed to fetch scripture: ${response.status}`);
		}

		const html = await response.text();
		console.log('Scripture HTML length:', html.length);
		
		// Extract scripture content - look for blockquote which contains the main text
		let scriptureContent = '';
		
		if (html.includes('<blockquote>')) {
			const blockquoteStart = html.indexOf('<blockquote>');
			const blockquoteEnd = html.indexOf('</blockquote>');
			console.log('Found blockquote at positions:', blockquoteStart, blockquoteEnd);
			
			if (blockquoteStart !== -1 && blockquoteEnd !== -1) {
				scriptureContent = html.substring(blockquoteStart + 12, blockquoteEnd);
				console.log('Raw scripture content length:', scriptureContent.length);
				
				// Clean up the HTML more thoroughly
				scriptureContent = scriptureContent
					.replace(/<sup[^>]*>.*?<\/sup>/gi, '') // Remove all superscript (verse numbers)
					.replace(/<span[^>]*class="[^"]*vnumVis[^"]*"[^>]*>.*?<\/span>/gi, '') // Remove verse number spans
					.replace(/<a[^>]*>.*?<\/a>/gi, '') // Remove links
					.replace(/\[\d+\]/g, '') // Remove bracketed numbers like [1]
					.replace(/<br\s*\/?>/gi, '</p><p>') // Convert breaks to paragraphs
					.replace(/<\/p>\s*<p>/g, '</p><p>') // Normalize paragraph spacing
					.replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
					.replace(/\s+/g, ' ') // Normalize whitespace
					.trim();
				
				// Ensure proper paragraph wrapping
				if (scriptureContent && !scriptureContent.startsWith('<p>')) {
					scriptureContent = '<p>' + scriptureContent + '</p>';
				}
				
				// Clean up any remaining formatting issues
				scriptureContent = scriptureContent
					.replace(/<p>\s*/g, '<p>') // Remove space after opening p tag
					.replace(/\s*<\/p>/g, '</p>'); // Remove space before closing p tag
				
				console.log('Cleaned scripture content length:', scriptureContent.length);
			}
		} else {
			console.log('No blockquote found in scripture HTML');
		}
		
		return scriptureContent;
	} catch (err) {
		console.error('Error fetching scripture:', err);
		return ''; // Return empty string on error
	}
}

// Function to get a specific image from WordPress Media Library
async function getMediaImage(searchTerm = 'daily-reflections-hero', mediaId = null) {
	try {
		let url;

		if (mediaId) {
			// Get specific image by ID
			url = `${WORDPRESS_URL}/wp-json/wp/v2/media/${mediaId}`;
		} else {
			// Search by filename
			url = `${WORDPRESS_URL}/wp-json/wp/v2/media?search=${searchTerm}`;
		}

		const response = await fetch(url, {
			headers: {
				Authorization:
					'Basic ' +
					Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
			}
		});

		if (response.ok) {
			const media = await response.json();

			if (mediaId) {
				return media.source_url; // Direct media object
			} else if (media.length > 0) {
				return media[0].source_url; // First search result
			}
		}
	} catch (error) {
		console.warn('Could not fetch media:', error);
	}

	// Fallback: try to use the same image from your current template
	return 'https://archdiocesanministries.org.au/wp-content/uploads/2024/01/daily-reflections-bg.jpg';
}

export async function POST({ request }) {
	try {
		const data = await request.json();
		const useNewDesign = data.useNewDesign !== false; // Default to true if not specified

		// Format the date nicely
		const dateObj = new Date(data.date);
		const formattedDate = dateObj.toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		// Generate the excerpt for email (first ~50 words + ellipsis)
		// Normalize text: remove extra whitespace, line breaks, and multiple spaces
		const normalizedText = data.reflectionText
			.replace(/\s+/g, ' ') // Replace all whitespace (including line breaks) with single space
			.trim(); // Remove leading/trailing space

		// Truncate to ~50 words
		const words = normalizedText.split(' ').filter((word) => word.length > 0);
		const truncatedText = words.length > 50 ? words.slice(0, 50).join(' ') + '...' : normalizedText;

		const excerpt = `${data.title} – ${data.liturgicalDate}<br><br><br>
<I>${data.gospelQuote}</I><br><br>
${truncatedText}`;

		// Generate content based on design preference
		let content;
		
		if (useNewDesign) {
			// Fetch gospel text for the date
			let gospelFullText = '';
			let gospelReference = '';
			
			try {
				// Try to fetch gospel for the specific date first
				console.log('Fetching gospel for date:', data.date);
				
				// For now, extract gospel reference from readings if available
				if (data.readings) {
					const gospelMatch = data.readings.match(/(Mt|Mk|Lk|Jn)\s+[\d:,-\s]+/);
					if (gospelMatch) {
						gospelReference = gospelMatch[0].trim()
							.replace(/^Mt\s+/, 'Matthew ')
							.replace(/^Mk\s+/, 'Mark ')
							.replace(/^Lk\s+/, 'Luke ')
							.replace(/^Jn\s+/, 'John ');
						
						console.log('Extracted gospel reference:', gospelReference);
						gospelFullText = await fetchScriptureContent(gospelReference);
						console.log('Fetched gospel text:', gospelFullText ? gospelFullText.substring(0, 200) + '...' : 'empty');
					}
				}
			} catch (err) {
				console.warn('Could not fetch gospel text:', err);
			}

			// New clean design language
			content = `
<style>
/* Hide the default WordPress post title */
.entry-title, 
.post-title, 
h1.entry-title, 
h1.post-title,
.single-post .entry-header .entry-title,
.page-title,
.entry-header h1,
.page-header,
div.page-header {
  display: none !important;
}

/* Hide any auto-generated titles in common themes */
.elementor-heading-title,
.wp-block-post-title,
.has-post-title {
  display: none !important;
}
</style>

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
    <span>${data.liturgicalDate}</span>
  </div>

  <!-- Title -->
  <h1 style="font-family:'PT Serif', Georgia, serif; font-size:28px; color:#2c7777; margin:0 0 12px;">${data.title}</h1>

  <!-- Readings -->
  <p style="font-size:14px; color:#666; margin:0 0 20px;">
    Readings: ${data.readings}
  </p>

  <!-- Author's Gospel Quote/Highlight -->
  <blockquote style="margin:20px 0; padding-left:16px; border-left:3px solid #2c7777; font-style:italic; font-size:16px; color:#2c7777;">
    ${data.gospelQuote}
  </blockquote>

  <!-- Full Gospel Reading for the Day -->
  ${gospelFullText && gospelReference ? `
  <div style="background:#f8fffe; padding:25px; margin:30px 0; border-radius:10px; border:1px solid #0fa3a3; box-shadow:0 2px 8px rgba(15,163,163,0.1);">
    <h3 style="font-family:'PT Serif', Georgia, serif; font-size:20px; color:#0fa3a3; margin:0 0 15px; font-weight:600;">Gospel Reading: ${gospelReference}</h3>
    <div style="font-size:16px; color:#333; line-height:1.8; font-family:'PT Serif', Georgia, serif;">
      ${gospelFullText}
    </div>
  </div>
  ` : ''}

  <!-- Body -->
  <div style="font-size:16px; color:#333;">
    ${data.reflectionText
			.split('\n')
			.filter((p) => p.trim())
			.map((paragraph) => `<p>${paragraph.trim()}</p>`)
			.join('\n')}
  </div>

  <!-- Author -->
  <p style="margin-top:30px; font-size:14px; color:#555; border-top:1px solid #eee; padding-top:10px;">
    <strong>Reflection written by:</strong> ${data.authorName}
  </p>

</article>

<!-- Footer sections outside of article container for full width -->
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
			// Use the original hero image design
			const heroImageUrl = 'https://archdiocesanministries.org.au/wp-content/uploads/2024/10/image-20240803-012152-4ace2c2e-Large-Medium.jpeg';
			
			content = `
<style>
/* Hide the default WordPress post title */
.entry-title, 
.post-title, 
h1.entry-title, 
h1.post-title,
.single-post .entry-header .entry-title,
.page-title,
.entry-header h1,
.page-header,
div.page-header {
  display: none !important;
}

/* Hide any auto-generated titles in common themes */
.elementor-heading-title,
.wp-block-post-title,
.has-post-title {
  display: none !important;
}
</style>

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
       style="max-width:500px; width:100%; height:auto; display:inline-block;">
</div>

<div class="dgr-content" style="max-width: 1200px; margin: 0 auto; padding: 3rem 2rem;">
  
  <!-- Title Section - Bold, PT Serif -->
  <h2 style="
    font-family: 'PT Serif', Georgia, serif; 
    font-size: 2.2rem; 
    font-weight: bold;
    color: #2c2c2c; 
    margin: 0 0 2rem 0;
    line-height: 1.2;
  ">
    ${data.title}
  </h2>
  
  <!-- Date and Scripture Info - Two Column Layout -->
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
        <div style="margin-bottom: 0.3rem;">${data.liturgicalDate}</div>
        <div style="font-style: italic; font-size: 0.9rem; font-family: 'PT Serif', Georgia, serif;">${data.readings}</div>
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
      ${data.gospelQuote}
    </p>
  </div>
  
  <!-- Reflection Text - Left Aligned -->
  <div style="
    font-family: 'Open Sans', Arial, sans-serif;
    font-size: 1.1rem;
    line-height: 1.5; 
    color: #333; 
    text-align: left;
    margin: 2rem 0;
  ">
    ${data.reflectionText
			.split('\n')
			.filter((p) => p.trim())
			.map(
				(paragraph) => `<p style="margin: 0 0 1.5rem 0; text-indent: 0;">${paragraph.trim()}</p>`
			)
			.join('')}
  </div>
  
  <!-- Author - Left Aligned -->
  <div style="
    font-family: 'Open Sans', Arial, sans-serif;
    font-size: 1rem;
    color: #666; 
    text-align: left;
    margin-top: 2rem;
  ">
    By ${data.authorName}
  </div>
  
</div>

<!-- Elementor templates outside container for full width -->
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

		// Get random featured image from featured-images.txt
		let featuredImageId;
		try {
			// Read the featured images file
			const featuredImagesPath = join(process.cwd(), 'featured-images.txt');
			const featuredImagesContent = readFileSync(featuredImagesPath, 'utf8');
			const imageUrls = featuredImagesContent
				.split('\n')
				.filter(line => line.trim())
				.map(line => line.trim());
			
			if (imageUrls.length > 0) {
				// Select a random image URL
				const randomUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)];
				console.log('Selected random featured image:', randomUrl);
				
				// Extract filename from URL for searching
				const filename = randomUrl.split('/').pop();
				
				// Search for this image in WordPress media library
				const mediaResponse = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/media?search=${encodeURIComponent(filename)}`, {
					headers: {
						Authorization:
							'Basic ' +
							Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
					}
				});

				if (mediaResponse.ok) {
					const mediaItems = await mediaResponse.json();
					if (mediaItems.length > 0) {
						featuredImageId = mediaItems[0].id;
						console.log('Found featured image ID:', featuredImageId);
					} else {
						console.warn('Image not found in WordPress media library:', filename);
					}
				}
			}
		} catch (error) {
			console.warn('Could not set featured image:', error);
		}

		// Get or create the category
		const CATEGORY_NAME = 'Daily Reflections';
		let categoryId;
		try {
			// First, try to find existing category
			const categoryResponse = await fetch(
				`${WORDPRESS_URL}/wp-json/wp/v2/categories?search=${CATEGORY_NAME}`,
				{
					headers: {
						Authorization:
							'Basic ' +
							Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
					}
				}
			);

			if (categoryResponse.ok) {
				const categories = await categoryResponse.json();
				if (categories.length > 0) {
					categoryId = categories[0].id;
				} else {
					// Create the category if it doesn't exist
					const createCategoryResponse = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/categories`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization:
								'Basic ' +
								Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
						},
						body: JSON.stringify({
							name: CATEGORY_NAME,
							description: 'Daily reflections on the Catholic Gospel readings'
						})
					});

					if (createCategoryResponse.ok) {
						const newCategory = await createCategoryResponse.json();
						categoryId = newCategory.id;
					}
				}
			}
		} catch (error) {
			console.warn('Could not set category:', error);
		}

		// Set the publish date at 1:00 AM local time (Brisbane/Australia)
		// WordPress expects the date in the site's timezone
		const publishDate = new Date(data.date + 'T01:00:00');
		const now = new Date();
		const isScheduled = publishDate > now;

		// Note: WordPress logic:
		// - draft = manual review needed, no auto-publish
		// - future = auto-publishes at specified date/time
		// - publish = published immediately

		// Create the WordPress post
		const wpResponse = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/posts`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization:
					'Basic ' +
					Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
			},
			body: JSON.stringify({
				title: formattedDate,
				content: content,
				excerpt: excerpt,
				status: isScheduled ? 'future' : 'publish', // Schedule if future date, publish if today/past
				date: publishDate.toISOString(), // Set the publish date
				categories: categoryId ? [categoryId] : [], // Add to category
				featured_media: featuredImageId || null, // Set featured image if found

				// Store data as custom fields for potential future use
				meta: {
					dgr_title: data.title,
					dgr_liturgical_date: data.liturgicalDate,
					dgr_readings: data.readings,
					dgr_gospel_quote: data.gospelQuote,
					dgr_reflection: data.reflectionText,
					dgr_author: data.authorName,
					dgr_formatted_date: formattedDate
				}
			})
		});

		if (!wpResponse.ok) {
			const errorText = await wpResponse.text();
			let errorMessage;

			try {
				const errorData = JSON.parse(errorText);
				errorMessage = errorData.message || errorText;
			} catch {
				errorMessage = errorText;
			}

			throw new Error(`WordPress API error (${wpResponse.status}): ${errorMessage}`);
		}

		const post = await wpResponse.json();

		return new Response(
			JSON.stringify({
				success: true,
				link: post.link,
				id: post.id,
				status: post.status,
				publishDate: post.date,
				category: categoryId ? CATEGORY_NAME : 'None',
				featuredImage: featuredImageId ? 'Set (random)' : 'Not found',
				message: isScheduled ? `Scheduled for ${formattedDate}` : `Published for ${formattedDate}`
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('DGR Publish Error:', error);

		return new Response(
			JSON.stringify({
				success: false,
				error: error.message
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}
