import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * GET /api/dgr/templates
 * Get all DGR email templates or a specific one by template_key
 */
export async function GET({ url, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const templateKey = url.searchParams.get('key');

		let query = supabaseAdmin
			.from('dgr_email_templates')
			.select('*')
			.order('name');

		if (templateKey) {
			query = query.eq('template_key', templateKey).single();
		}

		const { data, error } = await query;

		if (error) throw error;

		return json(templateKey ? { template: data } : { templates: data });
	} catch (error) {
		console.error('DGR templates fetch error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

/**
 * PUT /api/dgr/templates
 * Update a DGR email template
 */
export async function PUT({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id, subject_template, body_template, is_active } = await request.json();

		if (!id) {
			return json({ error: 'Template ID is required' }, { status: 400 });
		}

		const updateData = {
			updated_at: new Date().toISOString(),
			updated_by: user.id
		};

		if (subject_template !== undefined) updateData.subject_template = subject_template;
		if (body_template !== undefined) updateData.body_template = body_template;
		if (is_active !== undefined) updateData.is_active = is_active;

		const { data, error } = await supabaseAdmin
			.from('dgr_email_templates')
			.update(updateData)
			.eq('id', id)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, template: data });
	} catch (error) {
		console.error('DGR template update error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
