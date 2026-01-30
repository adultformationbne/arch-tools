import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, cookies }) => {
	// Try to sign out - ignore errors (session may already be invalid)
	try {
		await supabase.auth.signOut();
	} catch {
		// Ignore - session may already be invalid
	}

	// Manually clear all Supabase auth cookies to ensure clean state
	const allCookies = cookies.getAll();
	for (const cookie of allCookies) {
		if (cookie.name.startsWith('sb-')) {
			cookies.delete(cookie.name, { path: '/' });
		}
	}

	throw redirect(303, '/login');
};
