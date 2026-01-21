// DGR Template Renderer
// Processes database templates with data

import { parseReadings } from './dgr-utils.js';
import { formatReflectionText, escapeHtml } from './dgr-common.js';
import { generateSubscribeSection } from './dgr-subscribe-section.js';

export function renderTemplate(templateHtml, data, options = {}) {
  let processed = templateHtml;

  // escapeHtml is now imported from dgr-common.js

  // Process special template helpers first
  processed = processSpecialHelpers(processed, data, options);

  // Process variables
  Object.entries(data).forEach(([key, value]) => {
    // Skip non-string values (arrays, objects, etc) - they'll be handled by helpers
    if (typeof value !== 'string' && value !== null && value !== undefined) {
      return;
    }

    // Fields that should allow HTML
    const htmlFields = ['reflectionText', 'gospelFullText', 'gospelReference'];

    if (htmlFields.includes(key)) {
      // Replace {{{variable}}} for unescaped HTML
      const regexTriple = new RegExp(`{{{${key}}}}`, 'g');
      processed = processed.replace(regexTriple, value || '');

      // Also replace {{variable}} with unescaped for these fields
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, value || '');
    } else {
      // Escape HTML for regular fields
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, escapeHtml(value || ''));
    }
  });

  // Handle conditionals {{#if variable}}...{{/if}}
  processed = processed.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
    return data[variable] ? content : '';
  });

  // Handle negative conditionals {{#unless variable}}...{{/unless}}
  processed = processed.replace(/{{#unless\s+(\w+)}}([\s\S]*?){{\/unless}}/g, (match, variable, content) => {
    return !data[variable] ? content : '';
  });

  // Handle each loops {{#each array}}...{{/each}}
  processed = processed.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
    const array = data[arrayName];
    if (!Array.isArray(array)) return '';

    return array.map(item => {
      let itemContent = content;

      // Replace item properties
      if (typeof item === 'object') {
        Object.entries(item).forEach(([key, value]) => {
          const regex = new RegExp(`{{${key}}}`, 'g');
          itemContent = itemContent.replace(regex, escapeHtml(value || ''));
        });
      } else {
        // For simple arrays
        itemContent = itemContent.replace(/{{this}}/g, escapeHtml(item || ''));
      }

      return itemContent;
    }).join('');
  });

  return processed;
}

// Process special template helpers
function processSpecialHelpers(template, data, options = {}) {
  let processed = template;
  const { headerImages = [] } = options;

  // Handle readings pills helper {{readingsPills readings}}
  // Accepts either an array of reading strings OR a readingsArray from readings_data
  processed = processed.replace(/{{readingsPills\s+(\w+)}}/g, (match, variable) => {
    const readingsValue = data[variable];
    if (!readingsValue) return '';

    // If it's an array, process each reading as a single pill
    // If it's a string (legacy), fall back to parseReadings
    let readingsArray;
    if (Array.isArray(readingsValue)) {
      // Each array item is one reading (e.g., "1 Samuel 18:6-9; 19:1-7")
      readingsArray = readingsValue.map(reading => {
        const parsed = parseReadings(reading);
        if (parsed.length === 0) return null;
        // Combine all parts back into one reading with the first book name
        const book = parsed[0].book;
        const allVerses = parsed.map(p => p.verses).join('; ');
        return { book, verses: allVerses };
      }).filter(Boolean);
    } else {
      // Legacy: string like "1 Samuel 18:6-9; Psalm 55:2-3; Mark 3:7-12"
      readingsArray = parseReadings(readingsValue);
    }

    return readingsArray.map((reading) =>
      `<div style="background:#e6f7f7; border:1px solid #8dd3d3; color:#0d5f5f; padding:10px 16px; border-radius:24px; font-size:14px; font-weight:500; box-shadow:0 2px 4px rgba(1,157,164,0.1); transition:all 0.2s ease; display:inline-block; margin:0 5px 5px 0;"><span style="font-weight:600;">${reading.book}</span><span style="margin-left:6px; opacity:0.9;">${reading.verses}</span></div>`
    ).join('');
  });

  // Handle promo tiles helper {{promoTiles promoTiles}}
  processed = processed.replace(/{{promoTiles\s+(\w+)}}/g, (match, variable) => {
    const tilesValue = data[variable];
    if (!tilesValue || !Array.isArray(tilesValue) || tilesValue.length === 0) return '';

    const activeTiles = tilesValue.filter(tile => tile.active && tile.image_url);
    if (activeTiles.length === 0) return '';

    // Adjust tile size based on count - bigger when fewer tiles
    const tileMaxWidth = activeTiles.length === 1 ? '300px' :
                         activeTiles.length === 2 ? '250px' :
                         activeTiles.length === 3 ? '200px' : '180px';

    return `
    <div style="background:#f8f9fa; border:1px solid #e9ecef; border-radius:16px; padding:24px; margin:40px 0;">
      <h3 style="font-size:16px; color:#495057; margin:0 0 20px 0; font-weight:600; text-align:center;">Upcoming Events</h3>
      <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:center;">
        ${activeTiles.map(tile => `
          <a href="${tile.link_url}" target="_blank" style="text-decoration:none; display:block; max-width:${tileMaxWidth};">
            <img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:auto; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); transition:transform 0.2s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ${tile.title ? `<div style="text-align:center; margin-top:8px; font-size:13px; color:#666; font-weight:500;">${tile.title}</div>` : ''}
          </a>
        `).join('')}
      </div>
    </div>`;
  });

  // Handle random header image helper {{randomHeaderImage}}
  processed = processed.replace(/{{randomHeaderImage}}/g, () => {
    if (headerImages.length > 0) {
      // Pick a random image from the provided list
      const randomIndex = Math.floor(Math.random() * headerImages.length);
      const selectedImage = headerImages[randomIndex];
      return selectedImage;
    }
    // Fallback if no images provided
    return 'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-6-1.png';
  });

  // Handle random icon helper {{randomIcon}}
  processed = processed.replace(/{{randomIcon}}/g, () => {
    // Simple fallback for browser compatibility
    return 'https://archdiocesanministries.org.au/wp-content/uploads/2025/09/Asset-6.png';
  });

  // Handle Subscribe section helper {{subscribeSection}}
  processed = processed.replace(/{{subscribeSection}}/g, () => {
    return generateSubscribeSection();
  });

  return processed;
}

// Re-export formatReflectionText from common utilities
export { formatReflectionText } from './dgr-common.js';