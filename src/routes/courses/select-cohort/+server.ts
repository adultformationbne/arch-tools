import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Sets the active cohort cookie for a course and redirects to the course dashboard.
 * Cookie persists for 1 year.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const courseSlug = url.searchParams.get('course');
	const cohortId = url.searchParams.get('cohort');
	const courseId = url.searchParams.get('courseId');

	if (!courseSlug || !cohortId || !courseId) {
		throw redirect(303, '/courses');
	}

	// Set cookie for this specific course (expires in 1 year)
	cookies.set(`active_cohort_${courseId}`, cohortId, {
		path: '/',
		maxAge: 60 * 60 * 24 * 365, // 1 year
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax'
	});

	throw redirect(303, `/courses/${courseSlug}`);
};
