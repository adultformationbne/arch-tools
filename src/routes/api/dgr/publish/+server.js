import { WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD } from '$env/static/private';

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
        'Authorization': 'Basic ' + Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
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
      .replace(/\s+/g, ' ')  // Replace all whitespace (including line breaks) with single space
      .trim();               // Remove leading/trailing space
    
    // Truncate to ~50 words
    const words = normalizedText.split(' ').filter(word => word.length > 0);
    const truncatedText = words.length > 50 
      ? words.slice(0, 50).join(' ') + '...'
      : normalizedText;
    
    const excerpt = `${data.title} – ${data.liturgicalDate}<br><br><br>
<I>'${data.gospelQuote}' (${data.gospelReference})</I><br><br>
${truncatedText}`;

    // Use the specific hero image
    const heroImageUrl = 'https://archdiocesanministries.org.au/wp-content/uploads/2024/10/image-20240803-012152-4ace2c2e-Large-Medium.jpeg';
    
    // Recreate the exact template design from wordpress-site-example.png
    const content = `
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
      '${data.gospelQuote}' <span style="font-weight: normal; color: #666;">(${data.gospelReference})</span>
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
    ${data.reflectionText.split('\n').filter(p => p.trim()).map(paragraph => 
      `<p style="margin: 0 0 1.5rem 0; text-indent: 0;">${paragraph.trim()}</p>`
    ).join('')}
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
  
  <!-- Dynamic Footer/Ad Content via Elementor Template -->
  <div style="margin-top: 3rem;">
    [elementor-template id="10072"]
  </div>
  
</div>`;

    // Get featured image ID for the post
    let featuredImageId;
    try {
      // Search for the featured image in media library
      const mediaResponse = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/media?search=15.png`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
        }
      });
      
      if (mediaResponse.ok) {
        const mediaItems = await mediaResponse.json();
        if (mediaItems.length > 0) {
          featuredImageId = mediaItems[0].id;
        }
      }
    } catch (error) {
      console.warn('Could not find featured image:', error);
    }

    // Get or create the category (use "Test Reflections" for testing)
    const CATEGORY_NAME = 'Test Reflections'; // Change back to 'Daily Reflections' for production
    let categoryId;
    try {
      // First, try to find existing category
      const categoryResponse = await fetch(`${WORDPRESS_URL}/wp-json/wp/v2/categories?search=${CATEGORY_NAME}`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
        }
      });
      
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
              'Authorization': 'Basic ' + Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
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

    // Set the publish date
    const publishDate = new Date(data.date);
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
        'Authorization': 'Basic ' + Buffer.from(`${WORDPRESS_USERNAME}:${WORDPRESS_APP_PASSWORD}`).toString('base64')
      },
      body: JSON.stringify({
        title: formattedDate,
        content: content,
        excerpt: excerpt,
        status: 'draft', // Always create as draft for manual review
        // date: publishDate.toISOString(), // Don't set date, let WordPress use current time
        categories: categoryId ? [categoryId] : [], // Add to Test Reflections category
        featured_media: featuredImageId || null, // Set featured image if found
        
        // Store data as custom fields for potential future use
        meta: {
          'dgr_title': data.title,
          'dgr_liturgical_date': data.liturgicalDate,
          'dgr_readings': data.readings,
          'dgr_gospel_quote': data.gospelQuote,
          'dgr_gospel_reference': data.gospelReference,
          'dgr_reflection': data.reflectionText,
          'dgr_author': data.authorName,
          'dgr_formatted_date': formattedDate
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
    
    return new Response(JSON.stringify({
      success: true,
      link: post.link,
      id: post.id,
      status: post.status,
      publishDate: post.date,
      category: categoryId ? CATEGORY_NAME : 'None',
      featuredImage: featuredImageId ? 'Set (15.png)' : 'Not found',
      message: `Draft created for ${formattedDate} - manually set publish date in WordPress`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('DGR Publish Error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}