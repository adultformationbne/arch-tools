import { describe, it, expect, afterAll } from 'vitest';
import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { ensureHubLeaderCohorts, HUB_LEADER_COHORT_NAME } from '$lib/server/hub-leader-cohorts';
import { EVERGREEN_END_DATE, isCohortLive, isEvergreenCohort } from '$lib/utils/cohort-status';

/**
 * A hub-leader course never asks an admin for a cohort: each module gets one
 * standing cohort that is free, auto-approved and never finishes.
 */

describe('Evergreen cohorts', () => {
	it('recognises a cohort with no real end', () => {
		expect(isEvergreenCohort({ end_date: EVERGREEN_END_DATE })).toBe(true);
		expect(isEvergreenCohort({ endDate: '2099-12-31' })).toBe(true);
		expect(isEvergreenCohort({ end_date: '2026-12-01' })).toBe(false);
		expect(isEvergreenCohort({ end_date: null })).toBe(false);
		expect(isEvergreenCohort(null)).toBe(false);
	});
});

describe('ensureHubLeaderCohorts', () => {
	afterAll(async () => {
		await testHelpers.cleanup();
	});

	const cohortsFor = async (moduleIds: string[]) => {
		const { data } = await supabaseAdmin.from('courses_cohorts').select('*').in('module_id', moduleIds);
		return data ?? [];
	};

	it('gives each module one free, auto-approved, never-ending cohort', async () => {
		const course = await testHelpers.createCourse();
		const m1 = await testHelpers.createModule(course.id, { order_number: 1 });
		const m2 = await testHelpers.createModule(course.id, { order_number: 2 });

		expect(await ensureHubLeaderCohorts(course.id, [m1.id, m2.id])).toBe(2);

		const cohorts = await cohortsFor([m1.id, m2.id]);
		expect(cohorts).toHaveLength(2);
		for (const cohort of cohorts) {
			expect(cohort.name).toBe(HUB_LEADER_COHORT_NAME);
			expect(cohort.enrollment_type).toBe('auto_approve');
			expect(cohort.price_cents).toBeNull();
			expect(cohort.current_session).toBe(0);
			expect(cohort.end_date).toBe(EVERGREEN_END_DATE);
			expect(isEvergreenCohort(cohort)).toBe(true);
			// still running, so participants resolve into it
			expect(isCohortLive({ ...cohort, total_sessions: 8 })).toBe(true);
		}
	});

	it('is idempotent, and only fills in the modules that are missing one', async () => {
		const course = await testHelpers.createCourse();
		const m1 = await testHelpers.createModule(course.id, { order_number: 1 });
		await ensureHubLeaderCohorts(course.id, [m1.id]);
		expect(await ensureHubLeaderCohorts(course.id, [m1.id])).toBe(0);

		// a module added later gets its own, without a second one for the first module
		const m2 = await testHelpers.createModule(course.id, { order_number: 2 });
		expect(await ensureHubLeaderCohorts(course.id, [m1.id, m2.id])).toBe(1);
		expect(await cohortsFor([m1.id, m2.id])).toHaveLength(2);
	});

	it('does not double up when two page loads race', async () => {
		const course = await testHelpers.createCourse();
		const m1 = await testHelpers.createModule(course.id, { order_number: 1 });
		await Promise.all([
			ensureHubLeaderCohorts(course.id, [m1.id]),
			ensureHubLeaderCohorts(course.id, [m1.id]),
			ensureHubLeaderCohorts(course.id, [m1.id])
		]);
		expect(await cohortsFor([m1.id])).toHaveLength(1);
	});

	it('leaves an existing live cohort alone, and replaces only an archived one', async () => {
		const course = await testHelpers.createCourse();
		const live = await testHelpers.createModule(course.id, { order_number: 1 });
		const archived = await testHelpers.createModule(course.id, { order_number: 2 });
		await testHelpers.createCohort(live.id, { name: 'Existing' });
		await testHelpers.createCohort(archived.id, { name: 'Old', status: 'archived' });

		expect(await ensureHubLeaderCohorts(course.id, [live.id, archived.id])).toBe(1);
		expect((await cohortsFor([live.id])).map((c) => c.name)).toEqual(['Existing']);
		expect(await cohortsFor([archived.id])).toHaveLength(2);
	});

	it('does nothing for a course with no modules', async () => {
		const course = await testHelpers.createCourse();
		expect(await ensureHubLeaderCohorts(course.id, [])).toBe(0);
	});
});
