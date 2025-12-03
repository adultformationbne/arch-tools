import type { LayoutServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: LayoutServerLoad = async (event) => {
	// Skip auth for public contributor write page (token-based access)
	if (event.url.pathname.startsWith('/dgr/write/')) {
		return {};
	}

	await requireModule(event, 'dgr', {
		mode: 'redirect',
		redirectTo: '/login?error=insufficient_permissions'
	});
	return {};
};
