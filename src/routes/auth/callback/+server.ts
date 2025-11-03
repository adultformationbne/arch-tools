import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	// Check if setup=true is in current URL or in the next redirect URL
	const isSetup = url.searchParams.get('setup') === 'true' || next.includes('setup=true');

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			// If this is a new user invitation, redirect to password setup
			if (isSetup) {
				// Parse next URL and remove setup param if present
				const nextUrl = new URL(next, url.origin);
				nextUrl.searchParams.delete('setup');
				const cleanNext = nextUrl.pathname + nextUrl.search || '/';

				throw redirect(303, `/auth/setup-password?next=${encodeURIComponent(cleanNext)}`);
			}
			throw redirect(303, next);
		}
	}

	throw redirect(303, '/auth/error');
};
