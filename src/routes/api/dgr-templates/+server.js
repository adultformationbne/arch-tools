import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { renderTemplate } from '$lib/utils/dgr-template-renderer.js';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

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

  // Process template using the proper renderer
  const html = renderTemplate(template.html, templateData);

  return json({ html, template });
}