/**
 * Reflection Status Utility
 *
 * Single source of truth for reflection status display across the app.
 * Database values: draft, submitted, under_review, passed, needs_revision, resubmitted
 */

import type { ComponentType } from 'svelte';
import { Clock, CheckCircle, AlertCircle, FileEdit, Send, Eye, RotateCcw } from 'lucide-svelte';

// =============================================================================
// Types
// =============================================================================

export type ReflectionStatus =
	| 'draft'
	| 'submitted'
	| 'under_review'
	| 'passed'
	| 'needs_revision'
	| 'resubmitted';

export interface StatusConfig {
	label: string;
	color: string;        // Tailwind text color
	bg: string;           // Tailwind bg color
	badge: string;        // Combined badge classes
	icon: ComponentType;
	editable: boolean;
	complete: boolean;
	needsReview: boolean;
}

// =============================================================================
// Single Status Configuration
// =============================================================================

const STATUS: Record<ReflectionStatus, StatusConfig> = {
	draft: {
		label: 'Draft',
		color: 'text-gray-600',
		bg: 'bg-gray-100',
		badge: 'bg-gray-100 text-gray-600',
		icon: FileEdit,
		editable: true,
		complete: false,
		needsReview: false
	},
	submitted: {
		label: 'Submitted',
		color: 'text-blue-600',
		bg: 'bg-blue-50',
		badge: 'bg-blue-50 text-blue-600',
		icon: Send,
		editable: false,
		complete: false,
		needsReview: true
	},
	under_review: {
		label: 'Under Review',
		color: 'text-purple-600',
		bg: 'bg-purple-50',
		badge: 'bg-purple-50 text-purple-600',
		icon: Eye,
		editable: false,
		complete: false,
		needsReview: true
	},
	resubmitted: {
		label: 'Resubmitted',
		color: 'text-blue-600',
		bg: 'bg-blue-50',
		badge: 'bg-blue-50 text-blue-600',
		icon: RotateCcw,
		editable: false,
		complete: false,
		needsReview: true
	},
	needs_revision: {
		label: 'Needs Revision',
		color: 'text-amber-600',
		bg: 'bg-amber-50',
		badge: 'bg-amber-50 text-amber-600',
		icon: AlertCircle,
		editable: true,
		complete: false,
		needsReview: false
	},
	passed: {
		label: 'Passed',
		color: 'text-green-700',
		bg: 'bg-green-50',
		badge: 'bg-green-50 text-green-700',
		icon: CheckCircle,
		editable: false,
		complete: true,
		needsReview: false
	}
};

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Normalize any status value to a valid ReflectionStatus
 */
export function normalizeStatus(status: string | null | undefined): ReflectionStatus {
	if (!status) return 'submitted';
	const s = status.toLowerCase().trim();
	if (s === 'graded') return 'passed'; // legacy
	if (s in STATUS) return s as ReflectionStatus;
	return 'submitted';
}

/**
 * Get full config for a status
 */
export function getStatus(status: string | null | undefined): StatusConfig {
	return STATUS[normalizeStatus(status)];
}

/**
 * Get display label
 */
export function getStatusLabel(status: string | null | undefined): string {
	return getStatus(status).label;
}

/**
 * Get badge classes (bg + text color)
 */
export function getStatusBadge(status: string | null | undefined): string {
	return getStatus(status).badge;
}

/**
 * Get icon component
 */
export function getStatusIcon(status: string | null | undefined): ComponentType {
	return getStatus(status).icon;
}

/**
 * Get text color class
 */
export function getStatusColor(status: string | null | undefined): string {
	return getStatus(status).color;
}

/**
 * Get background color class
 */
export function getStatusBg(status: string | null | undefined): string {
	return getStatus(status).bg;
}

/**
 * Check if status allows editing
 */
export function isEditable(status: string | null | undefined): boolean {
	return getStatus(status).editable;
}

/**
 * Check if status is complete (passed)
 */
export function isComplete(status: string | null | undefined): boolean {
	return getStatus(status).complete;
}

/**
 * Check if status needs admin review
 */
export function needsReview(status: string | null | undefined): boolean {
	return getStatus(status).needsReview;
}

/**
 * Check if overdue (submitted > X days ago without being marked)
 */
export function isOverdue(
	status: string | null | undefined,
	submittedAt: string | Date | null | undefined,
	days = 7
): boolean {
	if (!needsReview(status) || !submittedAt) return false;
	const diff = (Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24);
	return diff > days;
}

// =============================================================================
// Status Lists
// =============================================================================

export const ALL_STATUSES: ReflectionStatus[] = Object.keys(STATUS) as ReflectionStatus[];
export const PENDING_STATUSES: ReflectionStatus[] = ['submitted', 'under_review', 'resubmitted'];
export const EDITABLE_STATUSES: ReflectionStatus[] = ['draft', 'needs_revision'];

// =============================================================================
// Server-side Status Helpers
// =============================================================================

/**
 * Get reflection status from a response object (server-side helper)
 * Returns the database status or 'not_started' if no response
 */
export function getReflectionStatus(response: { status?: string | null } | null | undefined): ReflectionStatus | 'not_started' {
	if (!response) return 'not_started';
	return normalizeStatus(response.status);
}

// =============================================================================
// Admin Page Helpers
// =============================================================================

interface ReflectionResponse {
	session_number?: number;
	question?: { session?: { session_number?: number } };
	status?: string | null;
}

interface SessionWithQuestion {
	session_number: number;
}

interface UserReflectionStatus {
	status: 'complete' | 'behind' | 'on_track' | 'no_questions';
	count: { completed: number; total: number };
}

/**
 * Fetch reflections data by cohort from API
 */
export async function fetchReflectionsByCohort(cohortId: string, courseSlug: string): Promise<Map<string, ReflectionResponse[]>> {
	const response = await fetch(`/admin/courses/${courseSlug}/api?endpoint=reflection_responses&cohort_id=${cohortId}`);
	const result = await response.json();

	const reflectionMap = new Map<string, ReflectionResponse[]>();
	if (result.success && result.data) {
		result.data.forEach((reflection: any) => {
			const userId = reflection.enrollment?.auth_user_id;
			if (userId) {
				if (!reflectionMap.has(userId)) {
					reflectionMap.set(userId, []);
				}
				reflectionMap.get(userId)!.push(reflection);
			}
		});
	}
	return reflectionMap;
}

/**
 * Calculate user's reflection status based on their submissions and current session
 */
export function getUserReflectionStatus(
	userReflections: ReflectionResponse[],
	currentSession: number,
	sessionsWithQuestions: SessionWithQuestion[]
): UserReflectionStatus {
	// Get sessions with questions up to user's current session
	const relevantSessions = sessionsWithQuestions.filter(s => s.session_number <= currentSession);
	const totalQuestions = relevantSessions.length;

	if (totalQuestions === 0) {
		return { status: 'no_questions', count: { completed: 0, total: 0 } };
	}

	// Count completed reflections (passed status)
	const completedReflections = userReflections.filter(r => {
		const sessionNum = r.session_number || r.question?.session?.session_number;
		return sessionNum && sessionNum <= currentSession && isComplete(r.status);
	}).length;

	const status = completedReflections >= totalQuestions
		? 'complete'
		: completedReflections < totalQuestions - 1
			? 'behind'
			: 'on_track';

	return {
		status,
		count: { completed: completedReflections, total: totalQuestions }
	};
}

/**
 * Format user reflection status for display
 */
export function formatUserReflectionStatus(status: string, count: { completed: number; total: number }): string {
	if (status === 'no_questions') return 'N/A';
	return `${count.completed}/${count.total}`;
}

/**
 * Get badge classes for user reflection status
 */
export function getStatusBadgeClass(status: string): string {
	switch (status) {
		case 'complete':
			return 'bg-green-100 text-green-700';
		case 'behind':
			return 'bg-red-100 text-red-700';
		case 'on_track':
			return 'bg-blue-100 text-blue-700';
		default:
			return 'bg-gray-100 text-gray-600';
	}
}
