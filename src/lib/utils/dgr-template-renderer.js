// DGR Template Renderer
// Processes database templates with data

import { parseReadings } from './dgr-utils.js';

export function renderTemplate(templateHtml, data) {
  let processed = templateHtml;

  // Escape HTML for safe rendering (except for designated HTML fields)
  const escapeHtml = (text) => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Process special template helpers first
  processed = processSpecialHelpers(processed, data);

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
function processSpecialHelpers(template, data) {
  let processed = template;

  // Handle readings pills helper {{readingsPills readings}}
  processed = processed.replace(/{{readingsPills\s+(\w+)}}/g, (match, variable) => {
    const readingsValue = data[variable];
    if (!readingsValue) return '';

    const readings = parseReadings(readingsValue);
    return readings.map((reading, index) =>
      `<div style="background:#e6f7f7; border:1px solid #8dd3d3; color:#0d5f5f; padding:10px 16px; border-radius:24px; font-size:14px; font-weight:500; box-shadow:0 2px 4px rgba(1,157,164,0.1); transition:all 0.2s ease; display:inline-block; margin:0 5px 5px 0;"><span style="font-weight:600;">${reading.book}</span><span style="margin-left:6px; opacity:0.9;">${reading.verses}</span></div>`
    ).join('');
  });

  // Handle promo tiles helper {{promoTiles promoTiles}}
  processed = processed.replace(/{{promoTiles\s+(\w+)}}/g, (match, variable) => {
    const tilesValue = data[variable];
    if (!tilesValue || !Array.isArray(tilesValue) || tilesValue.length === 0) return '';

    const activeTiles = tilesValue.filter(tile => tile.active && tile.image_url);
    if (activeTiles.length === 0) return '';

    return `
    <div style="background:#f8f9fa; border:1px solid #e9ecef; border-radius:16px; padding:24px; margin:40px 0;">
      <h3 style="font-size:16px; color:#495057; margin:0 0 20px 0; font-weight:600; text-align:center;">Upcoming Events</h3>
      <div style="display:flex; flex-wrap:wrap; gap:16px; justify-content:center;">
        ${activeTiles.map(tile => `
          <a href="${tile.link_url}" target="_blank" style="text-decoration:none; display:block; max-width:200px;">
            <img src="${tile.image_url}" alt="${tile.title || 'Event'}" style="width:100%; height:auto; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); transition:transform 0.2s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ${tile.title ? `<div style="text-align:center; margin-top:8px; font-size:12px; color:#666; font-weight:500;">${tile.title}</div>` : ''}
          </a>
        `).join('')}
      </div>
    </div>`;
  });

  return processed;
}

// Format the reflection text into paragraphs
export function formatReflectionText(text) {
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