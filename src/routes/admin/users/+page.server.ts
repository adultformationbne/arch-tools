import { requireModule } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	await requireModule(event, 'platform.admin', { mode: 'redirect', redirectTo: '/my-courses' });

	return {};
};
