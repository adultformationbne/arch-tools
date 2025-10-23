import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

/**
 * GET /api/dgr-admin/assignment-rules
 * Returns all assignment rules
 */
export async function GET({ locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { data: rules, error } = await supabase
			.from('dgr_assignment_rules')
			.select('*')
			.order('priority', { ascending: true });

		if (error) throw error;

		return json({ rules });
	} catch (error) {
		console.error('Failed to fetch assignment rules:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

/**
 * POST /api/dgr-admin/assignment-rules
 * Create, update, or delete assignment rules
 */
export async function POST({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { action, rule, rule_id, updates } = await request.json();

		switch (action) {
			case 'create': {
				// Clean up empty string values to null
				const cleanedRule = Object.fromEntries(
					Object.entries(rule).map(([key, value]) => [key, value === '' ? null : value])
				);

				const { data, error } = await supabase
					.from('dgr_assignment_rules')
					.insert(cleanedRule)
					.select()
					.single();

				if (error) throw error;

				return json({ success: true, rule: data });
			}

			case 'update': {
				if (!rule_id) {
					return json({ error: 'rule_id is required' }, { status: 400 });
				}

				const { data, error } = await supabase
					.from('dgr_assignment_rules')
					.update({ ...updates, updated_at: new Date().toISOString() })
					.eq('id', rule_id)
					.select()
					.single();

				if (error) throw error;

				return json({ success: true, rule: data });
			}

			case 'delete': {
				if (!rule_id) {
					return json({ error: 'rule_id is required' }, { status: 400 });
				}

				const { error } = await supabase.from('dgr_assignment_rules').delete().eq('id', rule_id);

				if (error) throw error;

				return json({ success: true });
			}

			default:
				return json({ error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		console.error('Assignment rules API error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
