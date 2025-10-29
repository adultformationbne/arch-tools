/**
 * Reflection Status Utility
 * Handles reflection status logic for ACCF students
 */

/**
 * Individual reflection status states
 */
export const ReflectionStatus = {
	NOT_SUBMITTED: 'not_submitted',
	SUBMITTED: 'submitted',           // Waiting for marking
	NEEDS_REVISION: 'needs_revision',
	MARKED_PASS: 'marked_pass',
	MARKED_FAIL: 'marked_fail',
	OVERDUE: 'overdue'                // Submitted but not marked within deadline
};

/**
 * Overall user status (prioritized)
 * Higher priority = more urgent
 */
export const UserReflectionStatus = {
	MULTIPLE_OVERDUE: { key: 'multiple_overdue', priority: 5 },
	OVERDUE: { key: 'overdue', priority: 4 },
	NEEDS_REVISION: { key: 'needs_revision', priority: 3 },
	WAITING_FOR_MARKING: { key: 'waiting_for_marking', priority: 2 },
	NOT_SUBMITTED: { key: 'not_submitted', priority: 1 },
	ALL_CAUGHT_UP: { key: 'all_caught_up', priority: 0 }
};

/**
 * Deadline for marking (in days)
 */
const MARKING_DEADLINE_DAYS = 14;

/**
 * Get the status of an individual reflection
 * @param {Object} reflection - Reflection response object from database
 * @returns {string} - ReflectionStatus value
 */
export function getReflectionStatus(reflection) {
	if (!reflection) {
		return ReflectionStatus.NOT_SUBMITTED;
	}

	const dbStatus = reflection.status;

	// Skip draft status (not yet submitted)
	if (dbStatus === 'draft') {
		return ReflectionStatus.NOT_SUBMITTED;
	}

	// Passed - marked successfully
	if (dbStatus === 'passed') {
		return ReflectionStatus.MARKED_PASS;
	}

	// Needs revision - marked but needs work
	if (dbStatus === 'needs_revision') {
		return ReflectionStatus.NEEDS_REVISION;
	}

	// Check if overdue (submitted or resubmitted but not marked within deadline)
	if ((dbStatus === 'submitted' || dbStatus === 'resubmitted') && !reflection.marked_at) {
		const submittedDate = new Date(reflection.created_at);
		const daysSinceSubmission = (Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24);

		if (daysSinceSubmission > MARKING_DEADLINE_DAYS) {
			return ReflectionStatus.OVERDUE;
		}
		return ReflectionStatus.SUBMITTED;
	}

	// Default to submitted if status is present
	return ReflectionStatus.SUBMITTED;
}

/**
 * Get overall reflection status for a student
 * Prioritizes the most urgent status across all reflections
 * @param {Array} reflections - Array of reflection response objects
 * @param {number} currentSession - Student's current session number
 * @returns {Object} - { status: string, count: number, details: Object }
 */
export function getUserReflectionStatus(reflections, currentSession) {
	if (!reflections || reflections.length === 0) {
		return {
			status: UserReflectionStatus.NOT_SUBMITTED.key,
			count: currentSession,
			details: {
				notSubmitted: currentSession,
				submitted: 0,
				needsRevision: 0,
				overdue: 0,
				markedPass: 0,
				markedFail: 0
			}
		};
	}

	// Count reflections by status
	const counts = {
		notSubmitted: 0,
		submitted: 0,
		needsRevision: 0,
		overdue: 0,
		markedPass: 0,
		markedFail: 0
	};

	// Create a map of session_number -> reflection
	const reflectionMap = new Map();
	reflections.forEach(r => {
		reflectionMap.set(r.session_number, r);
	});

	// Check all sessions up to currentSession
	for (let session = 1; session <= currentSession; session++) {
		const reflection = reflectionMap.get(session);
		const status = getReflectionStatus(reflection);

		switch (status) {
			case ReflectionStatus.NOT_SUBMITTED:
				counts.notSubmitted++;
				break;
			case ReflectionStatus.SUBMITTED:
				counts.submitted++;
				break;
			case ReflectionStatus.NEEDS_REVISION:
				counts.needsRevision++;
				break;
			case ReflectionStatus.OVERDUE:
				counts.overdue++;
				break;
			case ReflectionStatus.MARKED_PASS:
				counts.markedPass++;
				break;
			case ReflectionStatus.MARKED_FAIL:
				counts.markedFail++;
				break;
		}
	}

	// Determine overall status based on priority
	let overallStatus;
	let displayCount;

	if (counts.overdue > 1) {
		overallStatus = UserReflectionStatus.MULTIPLE_OVERDUE.key;
		displayCount = counts.overdue;
	} else if (counts.overdue === 1) {
		overallStatus = UserReflectionStatus.OVERDUE.key;
		displayCount = 1;
	} else if (counts.needsRevision > 0) {
		overallStatus = UserReflectionStatus.NEEDS_REVISION.key;
		displayCount = counts.needsRevision;
	} else if (counts.submitted > 0) {
		overallStatus = UserReflectionStatus.WAITING_FOR_MARKING.key;
		displayCount = counts.submitted;
	} else if (counts.notSubmitted > 0) {
		overallStatus = UserReflectionStatus.NOT_SUBMITTED.key;
		displayCount = counts.notSubmitted;
	} else {
		// All sessions are marked as pass
		overallStatus = UserReflectionStatus.ALL_CAUGHT_UP.key;
		displayCount = counts.markedPass;
	}

	return {
		status: overallStatus,
		count: displayCount,
		details: counts
	};
}

/**
 * Format user reflection status for display
 * @param {string} status - UserReflectionStatus key
 * @param {number} count - Number of reflections in this status
 * @returns {string} - Formatted display text
 */
export function formatUserReflectionStatus(status, count) {
	switch (status) {
		case UserReflectionStatus.MULTIPLE_OVERDUE.key:
			return `${count} overdue`;
		case UserReflectionStatus.OVERDUE.key:
			return '1 overdue';
		case UserReflectionStatus.NEEDS_REVISION.key:
			return count === 1 ? '1 needs revision' : `${count} need revision`;
		case UserReflectionStatus.WAITING_FOR_MARKING.key:
			return count === 1 ? '1 waiting for marking' : `${count} waiting for marking`;
		case UserReflectionStatus.NOT_SUBMITTED.key:
			return count === 1 ? '1 not submitted' : `${count} not submitted`;
		case UserReflectionStatus.ALL_CAUGHT_UP.key:
			return 'All caught up';
		default:
			return '';
	}
}

/**
 * Get CSS class for status badge styling
 * @param {string} status - UserReflectionStatus key
 * @returns {string} - CSS class names
 */
export function getStatusBadgeClass(status) {
	switch (status) {
		case UserReflectionStatus.MULTIPLE_OVERDUE.key:
		case UserReflectionStatus.OVERDUE.key:
			return 'bg-red-100 text-red-800';
		case UserReflectionStatus.NEEDS_REVISION.key:
			return 'bg-orange-100 text-orange-800';
		case UserReflectionStatus.WAITING_FOR_MARKING.key:
			return 'bg-blue-100 text-blue-800';
		case UserReflectionStatus.NOT_SUBMITTED.key:
			return 'bg-yellow-100 text-yellow-800';
		case UserReflectionStatus.ALL_CAUGHT_UP.key:
			return 'bg-green-100 text-green-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

/**
 * Fetch reflection responses for a cohort
 * @param {string} cohortId - Cohort ID
 * @param {string} courseSlug - Course slug for API path
 * @returns {Promise<Map>} - Map of user_id -> array of reflections
 */
export async function fetchReflectionsByCohort(cohortId, courseSlug) {
	try {
		const response = await fetch(`/courses/${courseSlug}/admin/api?endpoint=reflection_responses&cohort_id=${cohortId}`);
		const result = await response.json();

		if (!result.success) {
			console.error('Failed to fetch reflections:', result.message);
			return new Map();
		}

		// Group reflections by user_id
		const reflectionsByUser = new Map();
		result.data.forEach(reflection => {
			if (!reflectionsByUser.has(reflection.user_id)) {
				reflectionsByUser.set(reflection.user_id, []);
			}
			reflectionsByUser.get(reflection.user_id).push(reflection);
		});

		return reflectionsByUser;
	} catch (error) {
		console.error('Error fetching reflections:', error);
		return new Map();
	}
}