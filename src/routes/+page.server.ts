import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();

	// Redirect to login if not authenticated
	if (!session || !user) {
		throw redirect(303, '/login');
	}

	// Get user's modules to determine redirect
	const { data: profile } = await supabase
		.from('user_profiles')
		.select('modules')
		.eq('id', user.id)
		.single();

	const modules = profile?.modules || [];

	// Redirect courses.participant-only users to /my-courses
	if (modules.length === 1 && modules[0] === 'courses.participant') {
		throw redirect(303, '/my-courses');
	}

	// If user has no modules, check for course enrollments
	if (modules.length === 0) {
		const { data: enrollments } = await supabase
			.from('courses_enrollments')
			.select('id')
			.eq('email', user.email)
			.eq('status', 'active')
			.limit(1);

		if (enrollments && enrollments.length > 0) {
			throw redirect(303, '/my-courses');
		}
	}

	// Allow authenticated users with other modules to proceed
	// The page will handle module-based routing
};
