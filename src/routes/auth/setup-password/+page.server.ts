import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	// Must be authenticated to set password
	// Session is established by /auth/confirm route via verifyOtp
	if (!session || !user) {
		throw redirect(303, '/auth');
	}

	return {
		user
	};
};
