import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals: { supabase } }) => {
	// Sign out the user
	await supabase.auth.signOut();

	// Redirect to login page
	throw redirect(303, '/login');
};
