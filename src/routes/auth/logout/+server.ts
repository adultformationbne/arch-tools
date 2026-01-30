import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase }, cookies }) => {
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

	// Redirect to login page
	throw redirect(303, '/login');
};
