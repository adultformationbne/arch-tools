import type { LayoutServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: LayoutServerLoad = async (event) => {
	await requireModule(event, 'dgr', {
		mode: 'redirect',
		redirectTo: '/login?error=insufficient_permissions'
	});
	return {};
};
