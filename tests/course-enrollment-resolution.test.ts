import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getUserCourseEnrollment, activeCohortCookieName } from '$lib/server/auth';
import { CourseQueries } from '$lib/server/course-data.js';

/**
 * Which cohort a participant is currently in, end to end.
 *
 * CourseQueries.getEnrollment() is the single resolver — it decides which of
 * someone's enrolments in a course is the live one. getUserCourseEnrollment()
 * is the request-level wrapper the auth gate uses: it supplies the stored
 * preference from the cookie, and clears it once it has gone stale. Everything
 * else is handed the enrolment those two produce, so there is nowhere left for
 * a second opinion to form.
 *
 * The scenario throughout is the one that caused the bug — a participant who
 * completed Module 3 and is now partway through Module 4, carrying a stored
 * preference for Module 3 from months earlier.
 */

/** Minimal stand-in for SvelteKit's cookie jar, recording what gets cleared. */
function cookieJar(values: Record<string, string> = {}) {
	const deleted: string[] = [];
	const jar = {
		get: (name: string) => values[name],
		delete: (name: string) => {
			deleted.push(name);
			delete values[name];
		}
	};
	return Object.assign(jar as unknown as RequestEvent['cookies'], { deleted });
}

/**
 * The welcome page every real module carries. It is session 0, not a teaching
 * session, so it must not count towards the total — createSessions() numbers
 * from 1 and so never produced one.
 */
async function addWelcomeSession(moduleId: string) {
	const { error } = await supabaseAdmin.from('courses_sessions').insert({
		module_id: moduleId,
		session_number: 0,
		title: 'Welcome',
		description: 'Welcome to the module'
	});
	if (error) throw error;
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
			user.id,
			course.slug,
			cookieJar({ [activeCohortCookieName(course.slug)]: pastCohort.id })
		);

		expect(enrollment?.cohort_id).toBe(currentCohort.id);
	});

	it('clears a preference that no longer names the current cohort', async () => {
		// It outlived what it pointed at, so it must not survive the request that
		// found that out — otherwise it keeps being consulted on every later one.
		const { course, user, pastCohort } = await buildTwoModuleCourse();
		const cookieName = activeCohortCookieName(course.slug);
		const cookies = cookieJar({ [cookieName]: pastCohort.id });

		await getUserCourseEnrollment(user.id, course.slug, cookies);

		expect((cookies as unknown as { deleted: string[] }).deleted).toEqual([cookieName]);
	});

	it('keeps a preference that still names the cohort in use', async () => {
		const { course, user, pastCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: 1
		});
		const cookieName = activeCohortCookieName(course.slug);
		const cookies = cookieJar({ [cookieName]: pastCohort.id });

		const enrollment = await getUserCourseEnrollment(user.id, course.slug, cookies);

		expect(enrollment?.cohort_id).toBe(pastCohort.id);
		expect((cookies as unknown as { deleted: string[] }).deleted).toEqual([]);
	});

	it('works with no cookie jar at all', async () => {
		const { course, user, currentCohort } = await buildTwoModuleCourse();

		const enrollment = await getUserCourseEnrollment(user.id, course.slug);

		expect(enrollment?.cohort_id).toBe(currentCohort.id);
	});

	it('returns null for an unknown course slug', async () => {
		const { user } = await buildTwoModuleCourse();

		const enrollment = await getUserCourseEnrollment(user.id, 'test-no-such-course', cookieJar());

		expect(enrollment).toBeNull();
	});
});

/**
 * The resolver itself, which every participant page and API now reaches through
 * the enrolment the gate hands them. It used to be a second, separate
 * resolution that preferred the cookie outright, so a participant could be
 * admitted to Module 4 and then served Module 3 — frozen, with the current
 * reflections refusing to save as archived.
 */
describe('CourseQueries.getEnrollment', { timeout: 30_000 }, () => {
	beforeAll(async () => {
		await testHelpers.cleanup();
	});

	afterAll(async () => {
		await testHelpers.cleanup();
	});

	it('returns the live cohort despite a stored preference for the completed one', async () => {
		const { course, user, pastCohort, currentCohort } = await buildTwoModuleCourse();

		const { data } = await CourseQueries.getEnrollment(user.id, course.slug, pastCohort.id);

		expect(data?.cohort_id).toBe(currentCohort.id);
	});

	it('returns the live cohort when no preference is stored', async () => {
		const { course, user, currentCohort } = await buildTwoModuleCourse();

		const { data } = await CourseQueries.getEnrollment(user.id, course.slug);

		expect(data?.cohort_id).toBe(currentCohort.id);
	});

	it('excludes a cohort that has run past its final session, without archiving', async () => {
		const { course, user, pastCohort, currentCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: SESSIONS_PER_MODULE + 1
		});

		const { data } = await CourseQueries.getEnrollment(user.id, course.slug, pastCohort.id);

		expect(data?.cohort_id).toBe(currentCohort.id);
	});

	it('honours the preference when both cohorts are genuinely running', async () => {
		const { course, user, pastCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: 1
		});

		const { data } = await CourseQueries.getEnrollment(user.id, course.slug, pastCohort.id);

		expect(data?.cohort_id).toBe(pastCohort.id);
	});

	it('still returns a completed cohort when the participant has no live one', async () => {
		const course = await testHelpers.createCourse();
		const user = await testHelpers.createUser();
		const module = await testHelpers.createModule(course.id);
		await testHelpers.createSessions(module.id, SESSIONS_PER_MODULE);
		const cohort = await testHelpers.createCohort(module.id, {
			current_session: SESSIONS_PER_MODULE,
			status: 'archived'
		});
		await testHelpers.createEnrollment(user.id, cohort.id);

		const { data } = await CourseQueries.getEnrollment(user.id, course.slug);

		expect(data?.cohort_id).toBe(cohort.id);
	});

	it('scopes to the requested course, not another the user is also in', async () => {
		const { user } = await buildTwoModuleCourse();

		const otherCourse = await testHelpers.createCourse();
		const otherModule = await testHelpers.createModule(otherCourse.id);
		await testHelpers.createSessions(otherModule.id, SESSIONS_PER_MODULE);
		const otherCohort = await testHelpers.createCohort(otherModule.id, { current_session: 1 });
		await testHelpers.createEnrollment(user.id, otherCohort.id);

		const { data } = await CourseQueries.getEnrollment(user.id, otherCourse.slug);

		expect(data?.cohort_id).toBe(otherCohort.id);
	});

	it('returns null for a course the user is not enrolled in', async () => {
		const { user } = await buildTwoModuleCourse();

		const otherCourse = await testHelpers.createCourse();
		const otherModule = await testHelpers.createModule(otherCourse.id);
		await testHelpers.createSessions(otherModule.id, SESSIONS_PER_MODULE);
		await testHelpers.createCohort(otherModule.id, { current_session: 1 });

		const { data } = await CourseQueries.getEnrollment(user.id, otherCourse.slug);

		expect(data).toBeNull();
	});

	it('falls back to the most recent when both are running and none is preferred', async () => {
		const { course, user, currentCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: 1
		});

		const { data } = await CourseQueries.getEnrollment(user.id, course.slug);

		expect(data?.cohort_id).toBe(currentCohort.id);
	});

	it('ignores enrolments that are no longer current', async () => {
		const { course, user, currentEnrollment, pastCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: 1
		});

		// Withdraw from Module 4; the still-running Module 3 should take over.
		await supabaseAdmin
			.from('courses_enrollments')
			.update({ status: 'withdrawn' })
			.eq('id', currentEnrollment.id);

		const { data } = await CourseQueries.getEnrollment(user.id, course.slug);

		expect(data?.cohort_id).toBe(pastCohort.id);
	});
});

/**
 * Session 0 is the welcome page, and every module in production has one. Counting
 * it as a teaching session leaves a finished cohort one session short of
 * "completed", so it still reads as live and keeps its hold on the participant.
 */
describe('session 0 does not count towards a module\'s length', { timeout: 30_000 }, () => {
	beforeAll(async () => {
		await testHelpers.cleanup();
	});

	afterAll(async () => {
		await testHelpers.cleanup();
	});

	it('treats a cohort past its last teaching session as finished on both paths', async () => {
		const { course, user, pastCohort, currentCohort } = await buildTwoModuleCourse({
			pastCohortStatus: 'active',
			pastCohortSession: SESSIONS_PER_MODULE + 1
		});
		await addWelcomeSession(pastCohort.module_id);
		await addWelcomeSession(currentCohort.module_id);

		const gate = await getUserCourseEnrollment(
			user.id,
			course.slug,
			cookieJar({ [activeCohortCookieName(course.slug)]: pastCohort.id })
		);
		const { data: content } = await CourseQueries.getEnrollment(
			user.id,
			course.slug,
			pastCohort.id
		);

		expect(gate?.cohort_id).toBe(currentCohort.id);
		expect(content?.cohort_id).toBe(currentCohort.id);
	});
});
