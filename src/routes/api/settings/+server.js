import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

// GET /api/settings?key=analytics_thresholds
export async function GET({ url, locals }) {
	try {
		const settingKey = url.searchParams.get('key');

		if (!settingKey) {
			return json({ error: 'Setting key is required' }, { status: 400 });
		}

		const { data, error } = await supabase
			.from('admin_settings')
			.select('setting_value')
			.eq('setting_key', settingKey)
			.single();

		if (error) {
			console.error('Error loading setting:', error);
			return json({ error: 'Failed to load setting' }, { status: 500 });
		}

		return json({
			success: true,
			data: data?.setting_value || null
		});
	} catch (error) {
		console.error('Settings GET error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

// POST /api/settings
export async function POST({ request, locals }) {
	try {
		const { key, value, description } = await request.json();

		if (!key || !value) {
			return json({ error: 'Key and value are required' }, { status: 400 });
		}

		const { data, error } = await supabase
			.from('admin_settings')
			.upsert(
				{
					setting_key: key,
					setting_value: value,
					description: description || null
				},
				{
					onConflict: 'setting_key'
				}
			)
			.select()
			.single();

		if (error) {
			console.error('Error saving setting:', error);
			return json({ error: 'Failed to save setting' }, { status: 500 });
		}

		return json({
			success: true,
			data: data
		});
	} catch (error) {
		console.error('Settings POST error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
