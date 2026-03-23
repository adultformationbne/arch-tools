/**
 * Cohort Status Utility
 *
 * Status is computed automatically from session progress:
 * - scheduled: current_session === 0 (not started)
 * - active: current_session > 0 && current_session < total_sessions
 * - completed: current_session >= total_sessions
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
