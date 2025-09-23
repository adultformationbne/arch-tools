import { WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD } from '$env/static/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { decodeHtmlEntities } from '$lib/utils/html.js';
import { renderTemplate, formatReflectionText } from '$lib/utils/dgr-template-renderer.js';

// Initialize Supabase client
const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);


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
		const templateKey = data.templateKey || 'default'; // Which template to use

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

		// Get the active template
		const { data: template, error: templateError } = await supabase
			.from('dgr_templates')
			.select('*')
			.eq('template_key', templateKey)
			.eq('is_active', true)
			.single();

		if (templateError) {
			throw new Error(`Template not found: ${templateError.message}`);
		}

		// Prepare template data
		const templateData = {
			title: data.title,
			date: data.date,
			formattedDate: formattedDate,
			liturgicalDate: data.liturgicalDate,
			readings: data.readings,
			gospelQuote: data.gospelQuote,
			reflectionText: formatReflectionText(data.reflectionText),
			authorName: data.authorName,
			gospelFullText: data.gospelFullText || '',
			gospelReference: data.gospelReference || ''
		};

		// Fetch promo tiles for templates that support them
		let promoTiles = [];
		try {
			const { data: tiles, error } = await supabase
				.from('dgr_promo_tiles')
				.select('*')
				.eq('active', true)
				.order('position');

			if (!error && tiles) {
				promoTiles = tiles;
				templateData.promoTiles = promoTiles;
			}
		} catch (err) {
			console.warn('Could not fetch promo tiles:', err);
		}

		console.log('=== Template Rendering ===');
		console.log('Template key:', templateKey);
		console.log('Template name:', template.name);
		console.log('Data keys:', Object.keys(templateData));
		console.log('=========================');

		// Render template
		const content = renderTemplate(template.html, templateData);

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
