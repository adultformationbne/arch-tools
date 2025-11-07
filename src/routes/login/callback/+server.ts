import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const token_hash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');
	const next = url.searchParams.get('next') ?? '/';

	// Check if setup=true is in current URL or in the next redirect URL
	const isSetup = url.searchParams.get('setup') === 'true' || next.includes('setup=true');

	// Handle PKCE code flow (newer method)
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			// If this is a new user invitation, redirect to password setup
			if (isSetup) {
				// Parse next URL and remove setup param if present
				const nextUrl = new URL(next, url.origin);
				nextUrl.searchParams.delete('setup');
				const cleanNext = nextUrl.pathname + nextUrl.search || '/';

				throw redirect(303, `/login/setup-password?next=${encodeURIComponent(cleanNext)}`);
			}
			throw redirect(303, next);
		}
	}

	// Handle token hash flow (email links - used for invites, password resets, etc.)
	if (token_hash && type) {
		const { error } = await supabase.auth.verifyOtp({
			token_hash,
			type: type as any
		});

		if (!error) {
			// If this is an invitation, redirect to password setup
			if (type === 'invite' || isSetup) {
				// Parse next URL and remove setup param if present
				const nextUrl = new URL(next, url.origin);
				nextUrl.searchParams.delete('setup');
				const cleanNext = nextUrl.pathname + nextUrl.search || '/';

				throw redirect(303, `/login/setup-password?next=${encodeURIComponent(cleanNext)}`);
			}
			throw redirect(303, next);
		}
	}

	// Handle URL fragment (hash) containing access_token - this happens when Supabase
	// redirects from email verification. The session will be set by the client-side code.
	// Just check if there's already a session established
	const { data: { session } } = await supabase.auth.getSession();
	if (session) {
		if (type === 'invite' || isSetup) {
			const nextUrl = new URL(next, url.origin);
			nextUrl.searchParams.delete('setup');
			const cleanNext = nextUrl.pathname + nextUrl.search || '/';
			throw redirect(303, `/login/setup-password?next=${encodeURIComponent(cleanNext)}`);
		}
		throw redirect(303, next);
	}

	throw redirect(303, '/login/error');
};
