import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	// Require 'platform.admin' module to access platform settings
	await requireModule(event, 'platform.admin', {
		mode: 'redirect',
		redirectTo: '/login'
	});

	return {};
};
