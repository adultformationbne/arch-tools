import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { hasModule, hasModuleLevel } from '$lib/server/auth.js';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		// Check if user is authenticated and is admin
		const { session, user } = await locals.safeGetSession();

		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check if user has access to send invites
		const { data: profile } = await locals.supabase
			.from('user_profiles')
			.select('modules')
			.eq('id', user.id)
			.single();

		const modules = Array.isArray(profile?.modules) ? profile.modules : [];
		const isPlatformAdmin = hasModule(modules, 'platform.admin') || hasModuleLevel(modules, 'courses.admin');

		if (!isPlatformAdmin) {
			return json({ error: 'Forbidden - Admin access required' }, { status: 403 });
		}

		// Get request data
		const { email, full_name } = await request.json();

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Send invite - Supabase will use the "Invite User" email template configured in dashboard
		const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
			data: {
				full_name: full_name || undefined,
				invited_by: user.email || 'Administrator'
			},
			// Supabase will append token_hash and type=invite to this URL
			redirectTo: `${request.headers.get('origin')}/auth/confirm`
		});

		if (error) {
			console.error('Invite error:', error);
			return json({ error: error.message }, { status: 400 });
		}

		return json({ success: true, data });
	} catch (error) {
		console.error('Server error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}
