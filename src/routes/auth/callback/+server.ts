import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';
	const setup = url.searchParams.get('setup');

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			// If this is a new user invitation (setup=true), redirect to password setup
			if (setup === 'true') {
				throw redirect(303, `/auth/setup-password?next=${encodeURIComponent(next)}`);
			}
			throw redirect(303, next);
		}
	}

	throw redirect(303, '/auth/error');
};
