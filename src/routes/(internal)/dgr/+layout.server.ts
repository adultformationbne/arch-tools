import { redirect, error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ parent }) => {
	const { userRole } = await parent();

	// Only admin role can access DGR management
	if (!userRole || userRole !== 'admin') {
		throw error(403, {
			message: 'You do not have permission to access DGR management. Required role: Admin.'
		});
	}

	return {};
};
