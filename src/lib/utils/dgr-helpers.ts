/**
 * DGR (Daily Gospel Reflection) helper utilities
 */

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface SchedulePattern {
	type: 'day_of_month' | 'day_of_week';
	value?: number;
	values?: number[];
}

export interface Contributor {
	id: string;
	name: string;
	email: string;
	title?: string;
	notes?: string;
	active: boolean;
	access_token?: string;
	schedule_pattern?: SchedulePattern;
	welcome_email_sent_at?: string;
	last_visited_at?: string;
	visit_count?: number;
}

export function getOrdinalSuffix(num: number): string {
	const j = num % 10;
	const k = num % 100;
	if (j === 1 && k !== 11) return 'st';
	if (j === 2 && k !== 12) return 'nd';
	if (j === 3 && k !== 13) return 'rd';
	return 'th';
}

export function getPatternDescription(pattern: SchedulePattern | null | undefined): string {
	if (!pattern) return 'Manual assignment only';

	// Support both 'value' (single) and 'values' (array)
	const getValues = (p: SchedulePattern): number[] => {
		if (p.values && Array.isArray(p.values)) return p.values;
		if (p.value !== undefined) return [p.value];
		return [];
	};

	const values = getValues(pattern);
	if (values.length === 0) return 'Manual assignment only';

	if (pattern.type === 'day_of_month') {
		if (values.length === 1) {
			return `Every ${values[0]}${getOrdinalSuffix(values[0])} of month`;
		}
		const formatted = values.map(v => `${v}${getOrdinalSuffix(v)}`).join(', ');
		return `Every ${formatted} of month`;
	}

	if (pattern.type === 'day_of_week') {
		if (values.length === 1) {
			return `Every ${DAY_NAMES[values[0]]}`;
		}
		const formatted = values.map(v => DAY_NAMES[v]).join(', ');
		return `Every ${formatted}`;
	}

	return 'Manual assignment';
}

export function formatDate(dateStr: string | null | undefined): string | null {
	if (!dateStr) return null;
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-AU', {
		day: 'numeric',
		month: 'short'
	});
}

export function formatRelativeTime(dateStr: string | null | undefined): string | null {
	if (!dateStr) return null;
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffMinutes = Math.floor(diffMs / (1000 * 60));

	if (diffMinutes < 1) return 'Just now';
	if (diffMinutes < 60) return `${diffMinutes}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays === 1) return 'Yesterday';
	if (diffDays < 7) return `${diffDays}d ago`;
	if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
	return formatDate(dateStr);
}

export function needsFollowUp(contributor: Contributor): boolean {
	if (!contributor.welcome_email_sent_at) return false;
	if (contributor.last_visited_at) return false;
	// If welcomed more than 3 days ago and never visited
	const welcomedDate = new Date(contributor.welcome_email_sent_at);
	const daysSinceWelcome = (new Date().getTime() - welcomedDate.getTime()) / (1000 * 60 * 60 * 24);
	return daysSinceWelcome > 3;
}

export function getContributorLink(contributor: Contributor): string | null {
	if (!contributor.access_token) return null;
	if (typeof window === 'undefined') return null;
	return `${window.location.origin}/dgr/write/${contributor.access_token}`;
}

/**
 * Format a contributor's name with their title (Fr, Sr, Br, Deacon) if present.
 * @example formatContributorName({ name: 'Michael Grace', title: 'Fr' }) => 'Fr Michael Grace'
 * @example formatContributorName({ name: 'Jane Doe' }) => 'Jane Doe'
 */
export function formatContributorName(contributor: { name?: string; title?: string } | null | undefined): string {
	if (!contributor) return '';
	const name = contributor.name || '';
	const title = contributor.title || '';
	return title ? `${title} ${name}` : name;
}

/**
 * Format a scripture reference for display.
 * Converts periods between verse numbers to commas.
 * @example formatReading('Psalm 121:1-2.4-5.6-9') => 'Psalm 121:1-2, 4-5, 6-9'
 * @example formatReading('Romans 4:13.16-18.22') => 'Romans 4:13, 16-18, 22'
 */
export function formatReading(reading: string | null | undefined): string {
	if (!reading) return '';
	// Replace periods between numbers with ", "
	return reading.replace(/(\d)\.(\d)/g, '$1, $2');
}
