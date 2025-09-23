import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	const { data: profile, error } = await supabase
		.from('user_profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	if (error) {
		console.error('Error loading profile:', error);
	}

	return {
		profile
	};
};