import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import {
	getCohortStatus,
	isCohortArchived,
	isCohortLive,
	selectCurrentEnrollment
} from '$lib/utils/cohort-status';

/**
 * Cohort status and enrolment selection.
 *
 * A cohort's progress is computed from session numbers; only archiving is
 * stored. These tests pin down both halves, and the rule that decides which
 * cohort a participant sees when they hold several in one course.
 *
 * The regression behind them: a participant who finished Module 3 was still
 * being shown Module 3 months into Module 4, because an explicit cohort
 * choice was stored in a year-long cookie and consulted before anything else.
 */

describe('Cohort progress (computed)', () => {
	it('treats session 0 as not yet started', () => {
		expect(getCohortStatus(0, 10)).toBe('scheduled');
	});

	it('stays active through the final session', () => {
		expect(getCohortStatus(1, 10)).toBe('active');
		expect(getCohortStatus(10, 10)).toBe('active');
	});

	it('is complete only once it passes the final session', () => {
		expect(getCohortStatus(11, 10)).toBe('completed');
	});
});

describe('isCohortArchived', () => {
	it('reads the stored archive flag', () => {
		expect(isCohortArchived({ status: 'archived' })).toBe(true);
		expect(isCohortArchived({ status: 'active' })).toBe(false);
	});

	it('treats a missing cohort as not archived', () => {
		expect(isCohortArchived(null)).toBe(false);
		expect(isCohortArchived(undefined)).toBe(false);
		expect(isCohortArchived({})).toBe(false);
	});
});

describe('isCohortLive', () => {
	it('counts a cohort partway through its module', () => {
		expect(isCohortLive({ status: 'active', current_session: 2, total_sessions: 10 })).toBe(true);
	});

	it('counts a cohort that has not started yet', () => {
		expect(isCohortLive({ status: 'active', current_session: 0, total_sessions: 10 })).toBe(true);
	});

	it('counts the final session itself', () => {
		expect(isCohortLive({ status: 'active', current_session: 10, total_sessions: 10 })).toBe(true);
	});

	it('rejects a cohort past its final session', () => {
		expect(isCohortLive({ status: 'active', current_session: 11, total_sessions: 10 })).toBe(false);
	});

	it('rejects an archived cohort regardless of progress', () => {
		expect(isCohortLive({ status: 'archived', current_session: 2, total_sessions: 10 })).toBe(false);
	});

	it('accepts camelCase and nested module shapes', () => {
		expect(isCohortLive({ status: 'active', currentSession: 3, module: { total_sessions: 10 } })).toBe(
			true
		);
	});
});

describe('selectCurrentEnrollment', () => {
	// Ordered most-recently-enrolled first, as the query returns them.
	const module4 = { cohort_id: 'm4', label: 'Module 4' };
	const module3 = { cohort_id: 'm3', label: 'Module 3' };
	const enrollments = [module4, module3];
	const onlyM4Live = (id: string) => id === 'm4';

	it('returns null when there are no enrolments', () => {
		expect(selectCurrentEnrollment([], onlyM4Live, 'm3')).toBeNull();
	});

	it('returns the single live cohort', () => {
		expect(selectCurrentEnrollment(enrollments, onlyM4Live)).toBe(module4);
	});

	it('ignores a stale preference pointing at a finished cohort', () => {
		// The regression: preferring Module 3 must not override the live Module 4.
		expect(selectCurrentEnrollment(enrollments, onlyM4Live, 'm3')).toBe(module4);
	});

	it('honours a preference for the live cohort', () => {
		expect(selectCurrentEnrollment(enrollments, onlyM4Live, 'm4')).toBe(module4);
	});

	it('uses the preference to break a tie between two live cohorts', () => {
		expect(selectCurrentEnrollment(enrollments, () => true, 'm3')).toBe(module3);
	});

	it('falls back to the most recent when two are live and none is preferred', () => {
		expect(selectCurrentEnrollment(enrollments, () => true)).toBe(module4);
	});

	it('still shows a past cohort when the user has no live one', () => {
		expect(selectCurrentEnrollment(enrollments, () => false)).toBe(module4);
		expect(selectCurrentEnrollment(enrollments, () => false, 'm3')).toBe(module3);
	});
});

describe('courses_cohorts.status column', () => {
	beforeAll(async () => {
		await testHelpers.cleanup();
	});

	afterEach(async () => {
		await testHelpers.cleanup();
	});

	async function newModule() {
		const course = await testHelpers.createCourse();
		return testHelpers.createModule(course.id);
	}

	it('defaults a new cohort to active, not archived', async () => {
		const module = await newModule();

		const { data: cohort, error } = await supabaseAdmin
			.from('courses_cohorts')
			.insert({
				module_id: module.id,
				name: 'Defaulted',
				start_date: '2026-01-01',
				end_date: '2026-03-01'
				// status deliberately omitted — the column default should supply it.
			})
			.select()
			.single();

		expect(error).toBeNull();
		expect(cohort?.status).toBe('active');
		expect(isCohortArchived(cohort)).toBe(false);
	});

	it('rejects lifecycle values that progress now computes', async () => {
		const module = await newModule();

		const { error } = await supabaseAdmin
			.from('courses_cohorts')
			.insert({
				module_id: module.id,
				name: 'Drafty',
				start_date: '2026-01-01',
				end_date: '2026-03-01',
				status: 'draft'
			})
			.select()
			.single();

		expect(error).not.toBeNull();
	});

	it('rejects a null status', async () => {
		const module = await newModule();

		const { error } = await supabaseAdmin
			.from('courses_cohorts')
			.insert({
				module_id: module.id,
				name: 'Nulled',
				start_date: '2026-01-01',
				end_date: '2026-03-01',
				status: null as unknown as string
			})
			.select()
			.single();

		expect(error).not.toBeNull();
	});

	it('round-trips archiving and unarchiving', async () => {
		const module = await newModule();
		const cohort = await testHelpers.createCohort(module.id, { current_session: 4 });

		await supabaseAdmin
			.from('courses_cohorts')
			.update({ status: 'archived' })
			.eq('id', cohort.id);

		const { data: archived } = await supabaseAdmin
			.from('courses_cohorts')
			.select('status, current_session')
			.eq('id', cohort.id)
			.single();

		expect(isCohortArchived(archived)).toBe(true);
		// Archiving takes it out of circulation even though it is mid-module.
		expect(isCohortLive({ ...archived, total_sessions: 10 })).toBe(false);

		// unarchiveCohort() restores 'active' — 'draft'/null would now be rejected.
		const { error: unarchiveError } = await supabaseAdmin
			.from('courses_cohorts')
			.update({ status: 'active', content_snapshot: null })
			.eq('id', cohort.id);

		expect(unarchiveError).toBeNull();

		const { data: restored } = await supabaseAdmin
			.from('courses_cohorts')
			.select('status, current_session')
			.eq('id', cohort.id)
			.single();

		expect(isCohortArchived(restored)).toBe(false);
		expect(isCohortLive({ ...restored, total_sessions: 10 })).toBe(true);
	});
});
