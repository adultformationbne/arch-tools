import type { PageServerLoad} from './$types';
import { requireModule } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	// Check if user has 'editor' module access (admins automatically have access)
	await requireModule(event, 'editor', { mode: 'redirect', redirectTo: '/profile' });

	return {};
};