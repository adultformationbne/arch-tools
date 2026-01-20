import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { renderTemplate } from '$lib/utils/dgr-template-renderer.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// GET - Retrieve active template for rendering
export async function GET({ url }) {
  const templateKey = url.searchParams.get('key') || 'default';

  const { data, error } = await supabaseAdmin
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
  const { data: template, error } = await supabaseAdmin
    .from('dgr_templates')
    .select('*')
    .eq('template_key', templateKey)
    .eq('is_active', true)
    .single();

  if (error) {
    return json({ error: error.message }, { status: 400 });
  }

  // Load header images from header-images.txt
  let headerImages = [];
  try {
    const headerImagesPath = join(process.cwd(), 'header-images.txt');
    const headerImagesContent = readFileSync(headerImagesPath, 'utf8');
    headerImages = headerImagesContent
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.trim());
  } catch (error) {
    console.warn('Could not load header images for preview:', error);
  }

  // Process template using the proper renderer with header images
  const html = renderTemplate(template.html, templateData, { headerImages });

  return json({ html, template });
}