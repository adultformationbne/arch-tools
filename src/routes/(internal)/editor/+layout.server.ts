import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { userRole } = await parent();

	// Only admin and editor roles can access the editor
	if (!userRole || !['admin', 'editor'].includes(userRole)) {
		throw error(403, {
			message: 'You do not have permission to access the editor. Required role: Admin or Editor.'
		});
	}

	return {};
};
