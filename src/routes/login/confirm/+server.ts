import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const token_hash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');
	const next = url.searchParams.get('next') ?? '/';

	// Log all URL parameters for debugging
	console.log('Auth confirm params:', {
		token_hash: token_hash ? 'present' : 'missing',
		type,
		all_params: Object.fromEntries(url.searchParams.entries())
	});

	if (token_hash && type) {
		// Verify the OTP and establish session
		const { error } = await supabase.auth.verifyOtp({
			type: type as any,
			token_hash
		});

		if (error) {
			console.error('Error verifying token:', error);
			console.error('Token hash (first 10 chars):', token_hash.substring(0, 10));
			throw redirect(303, '/login/error');
		}

		// Successfully verified - session is now established in cookies
		// Redirect based on type
		if (type === 'invite') {
			// For invitations, send to password setup
			throw redirect(303, '/login/setup-password?next=' + encodeURIComponent(next));
		} else if (type === 'recovery') {
			// For password recovery, send to password setup (same page, different context)
			throw redirect(303, '/login/setup-password?next=' + encodeURIComponent(next));
		} else if (type === 'signup' || type === 'email') {
			// For signup confirmation or email verification, redirect to app
			// Check user profile to determine best redirect
			const { data: { user } } = await supabase.auth.getUser();

			if (user) {
				const { data: profile } = await supabase
					.from('user_profiles')
					.select('modules')
					.eq('id', user.id)
					.single();

				const modules = profile?.modules || [];

				// Determine redirect based on modules
				if (modules.includes('platform.admin')) {
					throw redirect(303, '/settings');
				} else if (modules.includes('courses.admin') || modules.includes('courses.manager')) {
					throw redirect(303, '/courses');
				} else if (modules.includes('dgr')) {
					throw redirect(303, '/dgr');
				} else if (modules.includes('editor')) {
					throw redirect(303, '/editor');
				} else if (modules.includes('courses.participant')) {
					throw redirect(303, '/my-courses');
				} else {
					throw redirect(303, '/profile');
				}
			}

			throw redirect(303, next);
		} else {
			// For other types, go to specified next or default
			throw redirect(303, next);
		}
	}

	// No valid params
	throw redirect(303, '/login/error');
};
