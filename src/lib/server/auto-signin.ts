import { supabaseAdmin } from './supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Programmatically sign a user in server-side and set the session cookie.
 *
 * Mechanism: mint a magic-link token with the admin client
 * (`generateLink({ type: 'magiclink' })`), then verify that token hash through
 * the request-scoped SSR client (`event.locals.supabase`). verifyOtp establishes
 * the session in cookies — the exact same path /login/confirm uses for OTP login.
 *
 * The user must already exist (use CourseMutations.ensureParticipantAccount first).
 * Returns true if the session was established, false otherwise.
 */
export async function autoSignInByEmail(
	localsSupabase: SupabaseClient,
	email: string
): Promise<boolean> {
	const normalized = email.trim().toLowerCase();

	const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
		type: 'magiclink',
		email: normalized
	});

	if (linkError || !data?.properties?.hashed_token) {
		console.error('autoSignInByEmail: failed to generate magic link:', linkError);
		return false;
	}

	const { error: verifyError } = await localsSupabase.auth.verifyOtp({
		type: 'email',
		token_hash: data.properties.hashed_token
	});

	if (verifyError) {
		console.error('autoSignInByEmail: failed to verify token:', verifyError);
		return false;
	}

	return true;
}
