/**
 * Hub-leader courses do not ask an admin to create cohorts. Each module gets one
 * standing cohort ("Hub leaders") that is free, auto-approved and never ends, and
 * leaders enrol into it through the module's enrolment link.
 *
 * ensureHubLeaderCohorts() is idempotent: it only adds a cohort to a module that
 * has no live one, so it is safe to call whenever the admin screens load. That
 * also covers modules added later.
 */
import { supabaseAdmin } from '$lib/server/supabase.js';
import { EVERGREEN_END_DATE, isCohortArchived } from '$lib/utils/cohort-status';

export const HUB_LEADER_COHORT_NAME = 'Hub leaders';

// Two admin pages loading at once must not both create the cohort
const inFlight = new Map<string, Promise<number>>();

/** Returns how many cohorts were created. */
export function ensureHubLeaderCohorts(courseId: string, moduleIds: string[]): Promise<number> {
	const running = inFlight.get(courseId);
	if (running) return running;
	const job = createMissing(moduleIds).finally(() => inFlight.delete(courseId));
	inFlight.set(courseId, job);
	return job;
}

async function createMissing(moduleIds: string[]): Promise<number> {
	if (moduleIds.length === 0) return 0;

	const { data: existing, error } = await supabaseAdmin
		.from('courses_cohorts')
		.select('module_id, status')
		.in('module_id', moduleIds);
	if (error) throw error;

	const covered = new Set((existing ?? []).filter((c) => !isCohortArchived(c)).map((c) => c.module_id));
	const missing = moduleIds.filter((id) => !covered.has(id));
	if (missing.length === 0) return 0;

	const today = new Date().toISOString().slice(0, 10);
	const { error: insertError } = await supabaseAdmin.from('courses_cohorts').insert(
		missing.map((module_id) => ({
			name: HUB_LEADER_COHORT_NAME,
			module_id,
			start_date: today,
			end_date: EVERGREEN_END_DATE,
			current_session: 0,
			status: 'active',
			enrollment_type: 'auto_approve',
			price_cents: null,
			currency: 'AUD'
		}))
	);
	if (insertError) throw insertError;
	return missing.length;
}
