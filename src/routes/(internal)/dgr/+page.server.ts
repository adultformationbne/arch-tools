import type { PageServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	// Require 'dgr' module access (admins automatically have access)
	await requireModule(event, 'dgr', { mode: 'redirect', redirectTo: '/profile' });

	return {};
};