import type { PageServerLoad } from './$types';
import { supabaseAdmin, getPlatformSettings } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ locals }) => {
	// Get current user for test email default
	const { user } = await locals.safeGetSession();

	// Get all DGR email templates and email logs in parallel
	const [templatesResult, logsResult, platformSettings] = await Promise.all([
		supabaseAdmin
			.from('email_templates')
			.select('*')
			.eq('context', 'dgr')
			.order('name'),
		supabaseAdmin
			.from('platform_email_log')
			.select('*, email_templates(name)')
			.eq('metadata->>context', 'dgr')
			.order('sent_at', { ascending: false })
			.limit(100),
		getPlatformSettings()
	]);

	if (templatesResult.error) {
		console.error('Error loading DGR email templates:', templatesResult.error);
	}

	if (logsResult.error) {
		console.error('Error loading DGR email logs:', logsResult.error);
	}

	return {
		templates: templatesResult.data || [],
		emailLogs: logsResult.data || [],
		platformLogo: platformSettings?.logo_path || null,
		currentUserEmail: user?.email || ''
	};
};
