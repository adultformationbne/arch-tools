import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals: { safeGetSession }, url }) => {
	const { session } = await safeGetSession();

	// If already logged in, redirect to appropriate page
	if (session) {
		const next = url.searchParams.get('next') ?? '/dashboard';
		throw redirect(303, next);
	}

	return {};
}) satisfies PageServerLoad;