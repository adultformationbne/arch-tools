import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	const { locals } = event;

	const { user } = await requireModule(event, 'dgr', {
		mode: 'redirect',
		redirectTo: '/login'
	});

	const { session } = await locals.safeGetSession();

	if (!session) {
		throw redirect(303, '/login');
	}

	return { session, user };
};
