import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { platform as defaultPlatform } from '$lib/config';

// Server-side Supabase client with service role key
export const supabaseAdmin = createClient(
	PUBLIC_SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	}
);

/**
 * Load platform settings from database with fallback to defaults
 * @returns {Promise<Object>} Platform settings object
 */
export async function getPlatformSettings() {
	const { data, error } = await supabaseAdmin
		.from('platform_settings')
		.select('platform_name, logo_path, from_email, reply_to_email, organization')
		.single();

	if (error) {
		console.error('Error loading platform settings:', error);
		// Fallback to default config
		return {
			name: defaultPlatform.name,
			logoPath: defaultPlatform.logoPath,
			fromEmail: defaultPlatform.fromEmail,
			replyToEmail: defaultPlatform.replyToEmail || null,
			organization: defaultPlatform.organization
		};
	}

	return {
		name: data.platform_name,
		logoPath: data.logo_path,
		fromEmail: data.from_email,
		replyToEmail: data.reply_to_email || null,
		organization: data.organization
	};
}
