import { redirect } from '@sveltejs/kit';
import { activeCohortCookieName } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * Sets the active cohort cookie for a course and redirects to the course dashboard.
 *
 * The cookie only breaks ties between two cohorts that are running at the same
 * time — a single live cohort wins on its own in getUserCourseEnrollment(),
 * which is also the only place it is read. So it is a session cookie: it must
 * not outlive the cohort it points at, and getUserCourseEnrollment() clears it
 * as soon as it does.
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
	const courseSlug = url.searchParams.get('course');
	const cohortId = url.searchParams.get('cohort');

	if (!courseSlug || !cohortId) {
		throw redirect(303, '/courses');
	}

	// Set cookie for this specific course (cleared when the browser closes)
	cookies.set(activeCohortCookieName(courseSlug), cohortId, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax'
	});

	throw redirect(303, `/courses/${courseSlug}`);
};
