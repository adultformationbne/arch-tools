import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireAdmin } from '$lib/utils/auth-helpers';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!session || !user) {
		throw redirect(303, '/auth');
	}

	// Require admin role for email testing
	const userProfile = await requireAdmin(supabase, user.id);

	return {
		session,
		userProfile
	};
};
