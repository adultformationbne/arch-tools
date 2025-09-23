import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET - Retrieve active template for rendering
export async function GET({ url }) {
  const templateKey = url.searchParams.get('key') || 'default';

  const { data, error } = await supabase
    .from('dgr_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  return json(data);
}

// POST - Render template with data
export async function POST({ request }) {
  const { templateKey = 'default', data: templateData } = await request.json();

  // Get active template
  const { data: template, error } = await supabase
    .from('dgr_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  // Process template
  let html = template.html;

  // Replace variables
  Object.entries(templateData).forEach(([key, value]) => {
    // Handle {{variable}}
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, escapeHtml(value || ''));

    // Handle {{{variable}}} for unescaped HTML
    const regexTriple = new RegExp(`{{{${key}}}}`, 'g');
    html = html.replace(regexTriple, value || '');
  });

  // Handle conditionals
  html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
    return templateData[variable] ? content : '';
  });

  return json({ html, template });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}