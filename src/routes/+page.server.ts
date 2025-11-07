import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	// Redirect to login if not authenticated
	if (!session || !user) {
		throw redirect(303, '/login');
	}

	// Allow authenticated users to proceed
	// The page will handle module-based routing
};
