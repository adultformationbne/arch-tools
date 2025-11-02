import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;

	// Ensure the user has DGR management access
	const { user } = await requireModule(event, 'dgr', {
		mode: 'redirect',
		redirectTo: '/auth'
	});

	const { session } = await locals.safeGetSession();

	if (!session) {
		throw redirect(303, '/auth');
	}

	return { session, user };
};
