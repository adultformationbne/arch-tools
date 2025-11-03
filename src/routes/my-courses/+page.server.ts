import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Redirect old /my-courses path to new /courses path
export const load: PageServerLoad = async () => {
	throw redirect(308, '/courses');
};
