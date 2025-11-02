import type { LayoutServerLoad } from './$types';
import { requireModule } from '$lib/server/auth';

export const load: LayoutServerLoad = async (event) => {
	await requireModule(event, 'editor', {
		mode: 'redirect',
		redirectTo: '/auth?error=insufficient_permissions'
	});
	return {};
};
