import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireRole } from '$lib/utils/auth';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	// Check if user has at least contributor role
	const hasAccess = await requireRole(supabase, user.id, 'contributor');

	if (!hasAccess) {
		throw redirect(303, '/profile?message=You need at least contributor role to access the editor');
	}

	return {};
};