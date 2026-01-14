import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireModule } from '$lib/server/auth';
import type { RequestHandler } from './$types';

// GET - Fetch platform settings
export const GET: RequestHandler = async (event) => {
	const { data: settings, error } = await supabaseAdmin
		.from('platform_settings')
		.select('id, platform_name, logo_path, from_email, reply_to_email, organization, updated_at')
		.single();

	if (error) {
		console.error('Error fetching platform settings:', error);
		return json({ error: 'Failed to fetch platform settings' }, { status: 500 });
	}

	return json(settings);
};

// PUT - Update platform settings
export const PUT: RequestHandler = async (event) => {
	// Require 'platform.admin' module to update platform settings
	const { user } = await requireModule(event, 'platform.admin');

	const body = await event.request.json();
	const { platform_name, logo_path, from_email, reply_to_email, organization } = body;

	// Validate required fields (reply_to_email is optional)
	if (!platform_name || !logo_path || !from_email || !organization) {
		return json({ error: 'All fields are required' }, { status: 400 });
	}

	// Update the single platform_settings row
	const { data, error } = await supabaseAdmin
		.from('platform_settings')
		.update({
			platform_name,
			logo_path,
			from_email,
			reply_to_email: reply_to_email || null,
			organization,
			updated_at: new Date().toISOString(),
			updated_by: user.id
		})
		.eq('id', (await supabaseAdmin.from('platform_settings').select('id').single()).data?.id)
		.select()
		.single();

	if (error) {
		console.error('Error updating platform settings:', error);
		return json({ error: 'Failed to update platform settings' }, { status: 500 });
	}

	return json({ message: 'Platform settings updated successfully', data });
};
