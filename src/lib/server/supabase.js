import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { platform as defaultPlatform } from '$lib/config';

/**
 * Server-side Supabase client with service role key.
 *
 * NEVER CALL A METHOD THAT RETURNS A SESSION ON THIS CLIENT.
 *
 * `signInWithPassword()`, `verifyOtp()`, `setSession()` and
 * `exchangeCodeForSession()` do not merely return a session — they ADOPT it.
 * supabase-js stores the resulting user token and sends it instead of the
 * service key on every later request, so this module-level singleton stops
 * being the service role and becomes whichever user signed in last, for every
 * request the instance goes on to serve. `persistSession: false` does not
 * prevent this; it only stops the session being written to storage rather than
 * memory.
 *
 * `signInWithOtp()` is the exception and is safe: it dispatches the email and
 * returns `session: null`, so nothing is adopted. The session arrives later
 * from `verifyOtp()`, which must run on a request-scoped client.
 *
 * The failure is silent. `auth_otp_tracker` and `courses_payment_failures` have
 * RLS on with no policies, so reads through a demoted client return zero rows
 * and updates affect nothing, with no error and nothing in the logs.
 *
 * `supabaseAdmin.auth.admin.*` is fine: those send the service key explicitly
 * and never touch the client's session. To check a password, use
 * `verifyPassword()` below.
 */
export const supabaseAdmin = /** @type {import('@supabase/supabase-js').SupabaseClient<import('$lib/database.types').Database>} */ (createClient(
	PUBLIC_SUPABASE_URL,
	SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	}
));

/**
 * Is this the account's current password?
 *
 * GoTrue offers no "check this password" call, so the only way to ask is to
 * sign in — which is exactly the operation that must not touch a shared client.
 * A throwaway client is created for the attempt and discarded with it.
 *
 * Note `scope: 'local'`. `signOut()` defaults to a GLOBAL scope, which would
 * revoke every session the account has everywhere — signing someone out of all
 * their devices as a side effect of them correctly typing their own password.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(email, password) {
	const throwaway = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});

	const { error } = await throwaway.auth.signInWithPassword({ email, password });

	if (!error) {
		await throwaway.auth.signOut({ scope: 'local' }).catch(() => {});
	}

	return !error;
}

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
