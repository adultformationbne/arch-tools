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
			.from('email_templates')
			.select('*')
			.eq('context', 'dgr')
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
 * Compatible with EmailTemplateEditor (accepts template_id or id)
 */
export async function PUT({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		// Support both 'template_id' (from EmailTemplateEditor) and 'id' (legacy)
		const templateId = body.template_id || body.id;
		const { name, subject_template, body_template, available_variables, is_active } = body;

		if (!templateId) {
			return json({ error: 'Template ID is required' }, { status: 400 });
		}

		const updateData = {
			updated_at: new Date().toISOString(),
			updated_by: user.id
		};

		if (name !== undefined) updateData.name = name;
		if (subject_template !== undefined) updateData.subject_template = subject_template;
		if (body_template !== undefined) updateData.body_template = body_template;
		if (available_variables !== undefined) updateData.available_variables = available_variables;
		if (is_active !== undefined) updateData.is_active = is_active;

		const { data, error } = await supabaseAdmin
			.from('email_templates')
			.update(updateData)
			.eq('id', templateId)
			.eq('context', 'dgr')
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, template: data });
	} catch (error) {
		console.error('DGR template update error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
