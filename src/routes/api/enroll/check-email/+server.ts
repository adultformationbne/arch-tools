import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { checkRateLimit } from '$lib/server/rate-limit';

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

/**
 * Public, unauthenticated email lookup for the enrolment form.
 *
 * Returns ONLY a boolean { registered } — never any of the person's details —
 * so the form can skip collecting (and the server can authoritatively fill)
 * the details of someone who already has an account, without ever leaking PII
 * to whoever typed the address. Rate-limited; responses are uniform.
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const ip = getClientAddress();
	if (!checkRateLimit(`enroll:checkemail:${ip}`, 30, 60_000)) {
		throw error(429, 'Too many requests. Please slow down.');
	}

	const body = await request.json().catch(() => ({}));
	const email = (body?.email || '').trim().toLowerCase();

	// Invalid input is reported as "not registered" — no distinct signal, no detail.
	if (!isValidEmail(email)) {
		return json({ registered: false });
	}

	const { data } = await supabaseAdmin
		.from('user_profiles')
		.select('id')
		.eq('email', email)
		.maybeSingle();

	return json({ registered: !!data });
};
