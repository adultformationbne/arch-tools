/**
 * Cohort Status Utility
 *
 * A cohort has two independent pieces of state, and they are stored differently:
 *
 * 1. Progress through the module — computed here from session numbers, never
 *    stored. Nothing writes it, so it cannot drift.
 *      - scheduled: current_session === 0 (not started)
 *      - active:    current_session > 0 && current_session <= total_sessions
 *      - completed: current_session > total_sessions
 *
 * 2. Archived — a deliberate admin action that freezes content and takes a
 *    snapshot, so it has to be stored. That is the ONLY thing the
 *    courses_cohorts.status column means; it holds 'active' or 'archived' and
 *    nothing else. Read it through isCohortArchived() rather than comparing
 *    strings, so there stays exactly one definition of it.
 *
 * Ask "has this cohort finished?" with isCohortLive(), which accounts for both.
 */

export type CohortStatus = 'scheduled' | 'active' | 'completed';

export interface CohortStatusInfo {
	status: CohortStatus;
	color: string;
	label: string;
}

const STATUS_CONFIG: Record<CohortStatus, { color: string; label: string }> = {
	scheduled: { color: '#D97706', label: 'SCHEDULED' },
	active: { color: '#059669', label: 'ACTIVE' },
	completed: { color: '#2563EB', label: 'COMPLETED' }
};

/**
 * Compute cohort status from session progress
 *
 * - scheduled: session 0 (not started)
 * - active: session 1 to N (in progress, including final session)
 * - completed: session > N (manually marked complete after final session)
 */
export function getCohortStatus(currentSession: number, totalSessions: number): CohortStatus {
	if (currentSession === 0) {
		return 'scheduled';
	}
	if (currentSession > totalSessions) {
		return 'completed';
	}
	return 'active';
}

/**
 * Get status with display info (color, label)
 */
export function getCohortStatusInfo(currentSession: number, totalSessions: number): CohortStatusInfo {
	const status = getCohortStatus(currentSession, totalSessions);
	return {
		status,
		...STATUS_CONFIG[status]
	};
}

/**
 * Extract total sessions from a cohort object.
 * Single source of truth — use this instead of `|| 8` fallbacks.
 * Checks cohort.total_sessions, cohort.totalSessions, cohort.module?.total_sessions.
 * Falls back to 0 (not 8) so missing data is visible rather than silently wrong.
 */
export function getTotalSessions(cohort: {
	total_sessions?: number;
	totalSessions?: number;
	module?: { total_sessions?: number };
}): number {
	return cohort?.total_sessions ?? cohort?.totalSessions ?? cohort?.module?.total_sessions ?? 0;
}

/**
 * Helper to get status info from a cohort object
 * Handles various property naming conventions
 */
export function getCohortStatusFromObject(cohort: {
	current_session?: number;
	currentSession?: number;
	total_sessions?: number;
	totalSessions?: number;
	module?: { total_sessions?: number };
}): CohortStatusInfo {
	const currentSession = cohort.current_session ?? cohort.currentSession ?? 0;
	const totalSessions = getTotalSessions(cohort);
	return getCohortStatusInfo(currentSession, totalSessions);
}

/**
 * Whether a cohort has been archived by an admin.
 *
 * The stored status column is a two-state archive flag — see the note at the
 * top of this file. Progress through the module is never stored there.
 */
export function isCohortArchived(cohort: { status?: string | null } | null | undefined): boolean {
	return cohort?.status === 'archived';
}

/**
 * Whether a cohort is still running — not archived, and not past its last
 * session. Scheduled cohorts count as live: they have yet to start.
 *
 * This is the question to ask when deciding which of a user's cohorts is the
 * current one, or whether their content should still be editable.
 */
export function isCohortLive(
	cohort: {
		status?: string | null;
		current_session?: number;
		currentSession?: number;
		total_sessions?: number;
		totalSessions?: number;
		module?: { total_sessions?: number };
	} | null | undefined
): boolean {
	if (!cohort || isCohortArchived(cohort)) return false;
	const currentSession = cohort.current_session ?? cohort.currentSession ?? 0;
	return currentSession <= getTotalSessions(cohort);
}

/**
 * Choose which of a user's enrolments is the one they mean, when they hold
 * several in the same course.
 *
 * Almost always they have one live cohort and some finished ones, so a single
 * live cohort wins outright. Only when two are running at once (a hub
 * coordinator carried into a new module, say) is there anything to decide, and
 * that is what preferredCohortId — the cohort they picked on "My Courses" — is
 * for. Consulting it first would pin someone to a module they finished months
 * ago, since the preference outlives the cohort.
 *
 * @param enrollments Ordered most-recently-enrolled first.
 * @param isLive Whether a cohort id is still running; see isCohortLive().
 * @param preferredCohortId The cohort the user last chose explicitly, if any.
 */
export function selectCurrentEnrollment<T extends { cohort_id: string }>(
	enrollments: T[],
	isLive: (cohortId: string) => boolean,
	preferredCohortId?: string | null
): T | null {
	if (!enrollments.length) return null;

	const live = enrollments.filter((e) => isLive(e.cohort_id));
	if (live.length === 1) return live[0];

	// Ambiguous, or nothing live and they have only past cohorts to look back on.
	const candidates = live.length ? live : enrollments;
	if (preferredCohortId) {
		const preferred = candidates.find((e) => e.cohort_id === preferredCohortId);
		if (preferred) return preferred;
	}
	return candidates[0];
}
