import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';

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
