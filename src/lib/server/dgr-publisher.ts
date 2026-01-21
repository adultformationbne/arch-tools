/**
 * DGR WordPress Publisher
 *
 * Extracts the WordPress publishing logic into a reusable server-side function.
 * Used by both the manual publish API and the cron auto-publish.
 */

import { WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { renderTemplate } from '$lib/utils/dgr-template-renderer.js';
import { formatDGRDate, formatReflectionText } from '$lib/utils/dgr-common.js';
import { minifyHTML } from '$lib/utils/wordpress-safe-html.js';
import { headerImages, featuredImages } from '$lib/utils/dgr-images.js';

export interface PublishParams {
	date: string;
	liturgicalDate: string;
	readings: string;
	title: string;
	gospelQuote: string;
	reflectionText: string;
	authorName: string;
	templateKey?: string;
	gospelFullText?: string;
	gospelReference?: string;
}

export interface PublishResult {
	success: boolean;
	link?: string;
	id?: number;
	status?: string;
	publishDate?: string;
	category?: string;
	featuredImage?: string;
	featuredImageUrl?: string;
	featuredImageId?: number;
	message?: string;
	error?: string;
}

/**
 * Publish a DGR reflection to WordPress
 */
export async function publishDGRToWordPress(params: PublishParams): Promise<PublishResult> {
	const templateKey = params.templateKey || 'default';

	// Format the date nicely
	const formattedDate = formatDGRDate(params.date);

	// Generate the excerpt for email (first ~50 words + ellipsis)
	// Normalize text: remove extra whitespace, line breaks, and multiple spaces
	const normalizedText = params.reflectionText
		.replace(/\s+/g, ' ')
		.trim();

	// Truncate to ~50 words
	const words = normalizedText.split(' ').filter((word) => word.length > 0);
	const truncatedText = words.length > 50 ? words.slice(0, 50).join(' ') + '...' : normalizedText;

	const excerpt = `${params.title} – ${params.liturgicalDate}<br><br><br>
<I>${params.gospelQuote}</I><br><br>
${truncatedText}`;

	// Get the active template
	const { data: template, error: templateError } = await supabaseAdmin
		.from('dgr_templates')
		.select('*')
		.eq('template_key', templateKey)
		.eq('is_active', true)
		.single();

	if (templateError) {
		return {
			success: false,
			error: `Template not found: ${templateError.message}`
		};
	}

	// Prepare template data
	const templateData: Record<string, any> = {
		title: params.title,
		date: params.date,
		formattedDate: formattedDate,
		liturgicalDate: params.liturgicalDate,
		readings: params.readings,
		gospelQuote: params.gospelQuote,
		reflectionText: formatReflectionText(params.reflectionText),
		authorName: params.authorName,
		gospelFullText: params.gospelFullText || '',
		gospelReference: params.gospelReference || ''
	};

	// Fetch promo tiles for templates that support them
	try {
		const { data: tiles, error } = await supabaseAdmin
			.from('dgr_promo_tiles')
			.select('*')
			.eq('active', true)
			.order('position');

		if (!error && tiles) {
			templateData.promoTiles = tiles;
		}
	} catch (err) {
		console.warn('Could not fetch promo tiles:', err);
	}

	// Render template with header images
	let content = renderTemplate(template.html, templateData, { headerImages });

	// Add CSS to hide WordPress post title and fix potential styling issues
	const wordpressCSS = `<style>h1.entry-title {display: none !important;}</style>`;
	content = wordpressCSS + content;

	// Minify HTML to prevent WordPress wpautop from adding unwanted <br> tags
	content = minifyHTML(content);

	// Get random featured image from imported array (for WordPress metadata)
	let featuredImageId: number | undefined;
	let selectedImageUrl: string | null = null;

	try {
		if (featuredImages.length > 0) {
			// Select a random image URL
			const randomUrl = featuredImages[Math.floor(Math.random() * featuredImages.length)];
			selectedImageUrl = randomUrl;

			// Fetch media items and find exact URL match
			const mediaResponse = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/media?per_page=100`, {
				headers: {
					Authorization:
						'Basic ' +
						Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
				}
			});

			if (mediaResponse.ok) {
				const mediaItems = await mediaResponse.json();
				const matchedImage = mediaItems.find((item: any) => item.source_url === randomUrl);

				if (matchedImage) {
					featuredImageId = matchedImage.id;
				} else {
					console.warn('Image not found in WordPress media library:', randomUrl);
				}
			}
		}
	} catch (error) {
		console.warn('Could not set featured image:', error);
	}

	// Get or create the category
	const CATEGORY_NAME = 'Daily Reflections';
	let categoryId: number | undefined;

	try {
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

	// Set the publish date at 1:00 AM Brisbane time
	const publishDate = new Date(params.date + 'T01:00:00+10:00');
	const now = new Date();
	const isScheduled = publishDate > now;

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
			status: isScheduled ? 'future' : 'publish',
			date: publishDate.toISOString(),
			categories: categoryId ? [categoryId] : [],
			featured_media: featuredImageId || null,
			meta: {
				dgr_title: params.title,
				dgr_liturgical_date: params.liturgicalDate,
				dgr_readings: params.readings,
				dgr_gospel_quote: params.gospelQuote,
				dgr_reflection: params.reflectionText,
				dgr_author: params.authorName,
				dgr_formatted_date: formattedDate
			}
		})
	});

	if (!wpResponse.ok) {
		const errorText = await wpResponse.text();
		let errorMessage: string;

		try {
			const errorData = JSON.parse(errorText);
			errorMessage = errorData.message || errorText;
		} catch {
			errorMessage = errorText;
		}

		return {
			success: false,
			error: `WordPress API error (${wpResponse.status}): ${errorMessage}`
		};
	}

	const post = await wpResponse.json();

	return {
		success: true,
		link: post.link,
		id: post.id,
		status: post.status,
		publishDate: post.date,
		category: categoryId ? CATEGORY_NAME : 'None',
		featuredImage: featuredImageId ? 'Set (random)' : 'Not found',
		featuredImageUrl: selectedImageUrl || undefined,
		featuredImageId: featuredImageId,
		message: isScheduled ? `Scheduled for ${formattedDate}` : `Published for ${formattedDate}`
	};
}
