import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request, locals }) {
	try {
		// Check if user is authenticated and is admin
		const { session, user } = await locals.safeGetSession();

		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check if user is admin
		const { data: profile } = await locals.supabase
			.from('user_profiles')
			.select('role, modules')
			.eq('id', user.id)
			.single();

		if (profile?.role !== 'admin') {
			return json({ error: 'Forbidden - Admin access required' }, { status: 403 });
		}

		// Get request data
		const { email, full_name } = await request.json();

		if (!email) {
			return json({ error: 'Email is required' }, { status: 400 });
		}

		// Create admin client with service role key
		const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
			auth: {
				autoRefreshToken: false,
				persistSession: false
			}
		});

		// Send invite - Supabase will use the "Invite User" email template configured in dashboard
		const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
			data: {
				full_name: full_name || undefined,
				invited_by: user.email || 'Administrator'
			},
			redirectTo: `${request.headers.get('origin')}/auth/callback`
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
