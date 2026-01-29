import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle, HandleServerError } from '@sveltejs/kit';

export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID().slice(0, 8);

	// Try to get user ID if available (may fail if error occurred during auth)
	let userId = 'anonymous';
	try {
		const { user } = await event.locals.safeGetSession();
		if (user?.id) userId = user.id;
	} catch {
		// Ignore - auth itself may have failed
	}

	console.error(`\n[ERROR ${errorId}] ${status} - ${message}`);
	console.error(`  URL: ${event.request.method} ${event.url.pathname}${event.url.search}`);
	console.error(`  Route: ${event.route.id || 'unknown'}`);
	console.error(`  User: ${userId}`);

	if (error instanceof Error) {
		console.error(`  Message: ${error.message}`);
		if (error.stack) {
			console.error(`  Stack:\n${error.stack.split('\n').map(l => '    ' + l).join('\n')}`);
		}
	} else {
		console.error(`  Error:`, error);
	}
	console.error('');

	// Return user-friendly error (errorId helps correlate logs)
	return {
		message: status === 500 ? `Something went wrong (${errorId})` : message,
		errorId
	};
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	// ✅ OPTIMIZATION: Initialize request-scoped caches
	event.locals.authCache = new Map();
	event.locals.courseCache = new Map();

	// Cache the session result per request to avoid multiple auth calls
	let cachedSession: { session: any; user: any } | null = null;

	event.locals.safeGetSession = async () => {
		// Return cached result if already fetched during this request
		if (cachedSession !== null) {
			return cachedSession;
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();

		if (error || !user) {
			// If refresh token is invalid/not found, clear stale auth cookies
			if (error?.code === 'refresh_token_not_found' || error?.code === 'invalid_refresh_token') {
				console.log('[auth] Clearing stale session cookies due to invalid refresh token');
				// Clear all Supabase auth cookies
				const cookies = event.cookies.getAll();
				for (const cookie of cookies) {
					if (cookie.name.startsWith('sb-')) {
						event.cookies.delete(cookie.name, { path: '/' });
					}
				}
			}
			cachedSession = { session: null, user: null };
			return cachedSession;
		}

		// Create a minimal session object with authenticated user
		// Instead of using the potentially insecure getSession()
		cachedSession = {
			session: { user },
			user
		};

		return cachedSession;
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
