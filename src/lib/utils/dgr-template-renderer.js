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