import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, data, depends, url }) => {
	depends('supabase:auth');

	const supabase = isBrowser()
		? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
				global: {
					fetch
				}
			})
		: createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
				global: {
					fetch
				},
				cookies: {
					getAll() {
						return data?.cookies || [];
					}
				}
			});

	return {
		supabase,
		session: data?.session || null,
		user: data?.user || null,
		userProfile: data?.userProfile || null,
		url: url.origin,
		userModules: data?.userModules || [],
		courseTheme: data?.courseTheme,
		courseBranding: data?.courseBranding,
		courseInfo: data?.courseInfo,
		isCoursesRoute: data?.isCoursesRoute,
		platform: data?.platform
	};
};
