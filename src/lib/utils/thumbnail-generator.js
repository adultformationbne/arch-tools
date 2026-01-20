/**
 * Template Thumbnail Generator
 * Generates preview thumbnails for DGR templates using browser APIs
 */

import { renderTemplate } from './dgr-template-renderer.js';

// Sample data for thumbnail generation
const SAMPLE_THUMBNAIL_DATA = {
  title: 'Faith in Action',
  date: '2025-09-23',
  formattedDate: 'Monday, 23 September 2025',
  liturgicalDate: 'Monday of the 25th Week in Ordinary Time',
  readings: 'Ezra 1:1-6; Luke 8:16-18',
  gospelQuote: 'No one lights a lamp and covers it with a bowl or puts it under a bed.',
  reflectionText: `<p style="margin:0 0 18px 0;">Today's Gospel reminds us that our faith is meant to shine brightly in the world. Like a lamp that illuminates a room, our actions and words should reflect God's love to those around us.</p><p style="margin:0 0 18px 0;">When we hide our light under a bushel, we deny others the opportunity to experience God's grace through us. Let us be bold in our witness and generous in our love.</p>`,
  authorName: 'Fr. Michael Thompson',
  gospelFullText: '<p style="margin:0 0 18px 0;">Jesus said to them, "No one lights a lamp and covers it with a bowl or puts it under a bed. Instead, they put it on a stand, so that those who come in can see the light."</p>',
  gospelReference: 'Luke 8:16-18'
};

/**
 * Generate a thumbnail by capturing the actual preview area
 * This uses the existing preview rendering system for accuracy
 */
export async function generateThumbnailFromPreview(previewElement, width = 400, height = 300) {
  try {
    // Load html2canvas dynamically if not available
    if (!window.html2canvas) {
      await loadHtml2Canvas();
    }

    if (!window.html2canvas) {
      throw new Error('html2canvas not available');
    }

    // Capture the preview element
    const canvas = await window.html2canvas(previewElement, {
      width: width * 2,
      height: height * 2,
      scale: 0.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      removeContainer: false,
      foreignObjectRendering: true
    });

    return canvas.toDataURL('image/png', 0.8);
  } catch (error) {
    console.error('Error generating thumbnail from preview:', error);
    return generateFallbackThumbnail(width, height);
  }
}

/**
 * Generate a thumbnail using the template renderer (fallback)
 */
export async function generateThumbnailCanvas(templateHtml, width = 400, height = 300) {
  try {
    // Render the template with sample data, handling errors gracefully
    let renderedHtml;
    try {
      renderedHtml = renderTemplate(templateHtml, SAMPLE_THUMBNAIL_DATA);
    } catch (renderError) {
      console.warn('Template rendering failed, using simplified version:', renderError);
      // Fallback: create a simplified version without complex helpers
      renderedHtml = createSimplifiedTemplate(templateHtml);
    }

    // Create a temporary container
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      top: -9999px;
      left: -9999px;
      width: ${width * 2}px;
      height: ${height * 2}px;
      transform: scale(0.5);
      transform-origin: top left;
      background: white;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    container.innerHTML = renderedHtml;
    document.body.appendChild(container);

    // Load html2canvas if needed
    if (!window.html2canvas) {
      await loadHtml2Canvas();
    }

    let canvas;
    if (window.html2canvas) {
      canvas = await window.html2canvas(container, {
        width: width * 2,
        height: height * 2,
        scale: 0.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
    } else {
      // Ultimate fallback
      return generateFallbackThumbnail(width, height);
    }

    document.body.removeChild(container);
    return canvas.toDataURL('image/png', 0.8);
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return generateFallbackThumbnail(width, height);
  }
}

/**
 * Create a simplified template version that removes complex helpers
 */
function createSimplifiedTemplate(templateHtml) {
  return templateHtml
    // Remove complex helper calls
    .replace(/\{\{#if [^}]+\}\}/g, '')
    .replace(/\{\{\/if\}\}/g, '')
    .replace(/\{\{[^{}]*\s+[^{}]*\}\}/g, '') // Remove helpers with parameters
    // Replace image placeholders
    .replace(/\{\{randomHeaderImage\}\}/g, 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY2NzI4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkhlYWRlciBJbWFnZTwvdGV4dD48L3N2Zz4=')
    .replace(/\{\{randomIcon\}\}/g, 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgc3Ryb2tlPSIjOTM5OWE0IiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=')
    // Keep simple variable substitutions
    .replace(/\{\{\{?(\w+)\}?\}\}/g, (match, varName) => {
      return SAMPLE_THUMBNAIL_DATA[varName] || `{{${varName}}}`;
    });
}

/**
 * Load html2canvas dynamically
 */
async function loadHtml2Canvas() {
  try {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);

    return new Promise((resolve) => {
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
    });
  } catch (error) {
    console.error('Failed to load html2canvas:', error);
    return false;
  }
}

/**
 * Generate a fallback thumbnail when other methods fail
 */
function generateFallbackThumbnail(width = 400, height = 300) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Draw a simple preview
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(0, 0, width, 50);

  ctx.fillStyle = '#374151';
  ctx.font = '16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Template Preview', width / 2, 30);

  ctx.fillStyle = '#6b7280';
  ctx.font = '12px Arial';
  ctx.fillText('Preview not available', width / 2, height / 2);

  return canvas.toDataURL('image/png', 0.8);
}

/**
 * Generate thumbnail using SVG foreignObject (fallback method)
 */
function generateSVGThumbnail(html, width, height) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="
          width: ${width}px;
          height: ${height}px;
          background: white;
          overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 12px;
          transform: scale(0.8);
        ">
          ${html}
        </div>
      </foreignObject>
    </svg>
  `;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png', 0.8));
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;base64,' + btoa(svg);
  });
}

/**
 * Upload thumbnail to Supabase Storage
 */
export async function uploadThumbnail(supabase, templateId, dataUrl) {
  try {
    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    const fileName = `template-${templateId}-${Date.now()}.png`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('dgr-thumbnails')
      .upload(fileName, blob, {
        contentType: 'image/png',
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('dgr-thumbnails')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading thumbnail:', error);
    return null;
  }
}

/**
 * Generate and save thumbnail for a template
 */
export async function generateAndSaveThumbnail(supabase, template) {
  try {

    // Generate thumbnail
    const dataUrl = await generateThumbnailCanvas(template.html);
    if (!dataUrl) {
      console.error('Failed to generate thumbnail data');
      return false;
    }

    // Upload to storage
    const thumbnailUrl = await uploadThumbnail(supabase, template.id, dataUrl);
    if (!thumbnailUrl) {
      console.error('Failed to upload thumbnail');
      return false;
    }

    // Update database
    const { error } = await supabase
      .from('dgr_templates')
      .update({
        thumbnail_url: thumbnailUrl,
        thumbnail_generated_at: new Date().toISOString()
      })
      .eq('id', template.id);

    if (error) {
      console.error('Error updating template with thumbnail:', error);
      return false;
    }

    return thumbnailUrl;
  } catch (error) {
    console.error('Error in generateAndSaveThumbnail:', error);
    return false;
  }
}

/**
 * Generate thumbnails for all templates that don't have them
 */
export async function generateMissingThumbnails(supabase, templates) {
  const templatesNeedingThumbnails = templates.filter(t => !t.thumbnail_url);

  if (templatesNeedingThumbnails.length === 0) {
    return [];
  }


  const results = [];
  for (const template of templatesNeedingThumbnails) {
    const result = await generateAndSaveThumbnail(supabase, template);
    results.push({ template: template.id, success: !!result, url: result });

    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return results;
}