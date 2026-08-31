import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getUserCourseEnrollment } from '$lib/server/auth';

/**
 * getUserCourseEnrollment() end-to-end.
 *
 * tests/cohort-status.test.ts covers the selection rule in isolation. This
 * file covers the wiring around it: the course → modules → cohorts → enrolments
 * queries, the session counts that decide whether a cohort has finished, and
 * the cookie lookup.
 *
 * The scenario throughout is the one that caused the bug — a participant who
 * completed Module 3 and is now partway through Module 4, carrying a stored
 * preference for Module 3 from months earlier.
 */

/** Minimal stand-in for SvelteKit's cookie jar; only get() is read. */
function cookieJar(values: Record<string, string> = {}) {
	return { get: (name: string) => values[name] } as unknown as RequestEvent['cookies'];
}

// Kept small deliberately: each session is a separate insert against a remote
// Supabase, and these tests only care about the boundary at the final session.
const SESSIONS_PER_MODULE = 3;

/**
 * A course with two modules, each with a cohort, and a participant enrolled in
 * both — Module 3 first, then Module 4, so Module 4 is the more recent.
 */
async function buildTwoModuleCourse(options?: {
	pastCohortStatus?: string;
	pastCohortSession?: number;
	currentCohortSession?: number;
}) {
	const course = await testHelpers.createCourse();
	const user = await testHelpers.createUser();

	const pastModule = await testHelpers.createModule(course.id, { name: 'Module 3' });
	const currentModule = await testHelpers.createModule(course.id, { name: 'Module 4' });
	await testHelpers.createSessions(pastModule.id, SESSIONS_PER_MODULE);
	await testHelpers.createSessions(currentModule.id, SESSIONS_PER_MODULE);

	const pastCohort = await testHelpers.createCohort(pastModule.id, {
		name: 'Module 3 - 2026',
		current_session: options?.pastCohortSession ?? SESSIONS_PER_MODULE,
		status: options?.pastCohortStatus ?? 'archived'
	});
	const currentCohort = await testHelpers.createCohort(currentModule.id, {
		name: 'Module 4',
		current_session: options?.currentCohortSession ?? 2
	});

	// Order matters: enrolled_at decides the fallback, and Module 3 came first.
	const pastEnrollment = await testHelpers.createEnrollment(user.id, pastCohort.id);
	const currentEnrollment = await testHelpers.createEnrollment(user.id, currentCohort.id);

	return { course, user, pastCohort, currentCohort, pastEnrollment, currentEnrollment };
}

// Every case builds a two-module course from scratch, which is a couple of
// dozen round trips — well past vitest's 5s default.
describe('getUserCourseEnrollment', { timeout: 30_000 }, () => {
	beforeAll(async () => {
		await testHelpers.cleanup();
	});

	// Each case builds its own course with a unique slug, so they cannot collide;
	// one sweep at the end is far cheaper than a full scan between every test.
	afterAll(async () => {
		await testHelpers.cleanup();
	});

	it('returns the live cohort despite a stored preference for the completed one', async () => {
		// The regression. Before the fix this returned the Module 3 enrolment,
		// which is what the participant kept landing on for months.
		const { course, user, pastCohort, currentCohort } = await buildTwoModuleCourse();

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			course.slug,
			cookieJar({ [`active_cohort_${course.id}`]: pastCohort.id })
		);

		expect(enrollment?.cohort_id).toBe(currentCohort.id);
	});

	it('returns the live cohort when no preference is stored', async () => {
		const { course, user, currentCohort } = await buildTwoModuleCourse();

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			course.slug,
			cookieJar()
		);

		expect(enrollment?.cohort_id).toBe(currentCohort.id);
	});

	it('works with no cookie jar at all', async () => {
		const { course, user, currentCohort } = await buildTwoModuleCourse();

		const enrollment = await getUserCourseEnrollment(supabaseAdmin, user.id, course.slug);

		expect(enrollment?.cohort_id).toBe(currentCohort.id);
	});

	it('excludes a cohort that has run past its final session, without archiving', async () => {
		// The state CLI 2026 was in: finished, but never archived. Session counts,
		// not the stored flag, are what rule it out.
		const { course, user, currentCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: SESSIONS_PER_MODULE + 1
		});

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			course.slug,
			cookieJar()
		);

		expect(enrollment?.cohort_id).toBe(currentCohort.id);
	});

	it('honours the preference when both cohorts are genuinely running', async () => {
		// A hub coordinator carried into a new module: the tie the cookie is for.
		const { course, user, pastCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: 3
		});

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			course.slug,
			cookieJar({ [`active_cohort_${course.id}`]: pastCohort.id })
		);

		expect(enrollment?.cohort_id).toBe(pastCohort.id);
	});

	it('falls back to the most recent when both are running and none is preferred', async () => {
		const { course, user, currentCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: 3
		});

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			course.slug,
			cookieJar()
		);

		expect(enrollment?.cohort_id).toBe(currentCohort.id);
	});

	it('still returns a completed cohort when the participant has no live one', async () => {
		// Someone who finished Module 3 and has not enrolled again must still be
		// able to open it, rather than being locked out of the course entirely.
		const course = await testHelpers.createCourse();
		const user = await testHelpers.createUser();
		const module = await testHelpers.createModule(course.id);
		await testHelpers.createSessions(module.id, SESSIONS_PER_MODULE);
		const cohort = await testHelpers.createCohort(module.id, {
			current_session: SESSIONS_PER_MODULE,
			status: 'archived'
		});
		await testHelpers.createEnrollment(user.id, cohort.id);

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			course.slug,
			cookieJar()
		);

		expect(enrollment?.cohort_id).toBe(cohort.id);
	});

	it('scopes to the requested course, not another the user is also in', async () => {
		const { user } = await buildTwoModuleCourse();

		const otherCourse = await testHelpers.createCourse();
		const otherModule = await testHelpers.createModule(otherCourse.id);
		await testHelpers.createSessions(otherModule.id, SESSIONS_PER_MODULE);
		const otherCohort = await testHelpers.createCohort(otherModule.id, { current_session: 1 });
		await testHelpers.createEnrollment(user.id, otherCohort.id);

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			otherCourse.slug,
			cookieJar()
		);

		expect(enrollment?.cohort_id).toBe(otherCohort.id);
	});

	it('returns null for a course the user is not enrolled in', async () => {
		const { user } = await buildTwoModuleCourse();

		const otherCourse = await testHelpers.createCourse();
		const otherModule = await testHelpers.createModule(otherCourse.id);
		await testHelpers.createSessions(otherModule.id, SESSIONS_PER_MODULE);
		await testHelpers.createCohort(otherModule.id, { current_session: 1 });

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			otherCourse.slug,
			cookieJar()
		);

		expect(enrollment).toBeNull();
	});

	it('returns null for an unknown course slug', async () => {
		const { user } = await buildTwoModuleCourse();

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			'test-no-such-course',
			cookieJar()
		);

		expect(enrollment).toBeNull();
	});

	it('ignores enrolments that are no longer current', async () => {
		const { course, user, currentEnrollment, pastCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: 3
		});

		// Withdraw from Module 4; the still-running Module 3 should take over.
		await supabaseAdmin
			.from('courses_enrollments')
			.update({ status: 'withdrawn' })
			.eq('id', currentEnrollment.id);

		const enrollment = await getUserCourseEnrollment(
			supabaseAdmin,
			user.id,
			course.slug,
			cookieJar()
		);

		expect(enrollment?.cohort_id).toBe(pastCohort.id);
	});
});
