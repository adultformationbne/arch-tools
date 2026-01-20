import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function GET({ params }) {
	try {
		const { token } = params;

		if (!token) {
			return json({ error: 'Token is required' }, { status: 400 });
		}

		// Find schedule entry by token
		const { data: schedule, error } = await supabaseAdmin
			.from('dgr_schedule')
			.select(
				`
        *,
        contributor:dgr_contributors(name, email)
      `
			)
			.eq('submission_token', token)
			.single();

		if (error || !schedule) {
			return json({ error: 'Invalid or expired submission link' }, { status: 404 });
		}

		return json({ schedule });
	} catch (error) {
		console.error('Schedule fetch error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
