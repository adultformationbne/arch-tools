import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Sets the active cohort cookie for a course and redirects to the course dashboard.
 *
 * The cookie only breaks ties between two cohorts that are running at the same
 * time — a single live cohort wins on its own in getUserCourseEnrollment(). So
 * it is a session cookie: it must not outlive the cohort it points at.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const courseSlug = url.searchParams.get('course');
	const cohortId = url.searchParams.get('cohort');
	const courseId = url.searchParams.get('courseId');

	if (!courseSlug || !cohortId || !courseId) {
		throw redirect(303, '/courses');
	}

	// Set cookie for this specific course (cleared when the browser closes)
	cookies.set(`active_cohort_${courseId}`, cohortId, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax'
	});

	throw redirect(303, `/courses/${courseSlug}`);
};
