export interface SessionGroup<T> {
	/** Section heading, or null for sessions that sit outside any section */
	label: string | null;
	items: T[];
}

/** Group consecutive sessions that share a section name, keeping session order. */
export function groupSessionsBySection<T extends { sectionName?: string | null }>(sessions: T[]): SessionGroup<T>[] {
	const groups: SessionGroup<T>[] = [];
	for (const session of sessions) {
		const label = session.sectionName ?? null;
		const last = groups[groups.length - 1];
		if (last && last.label === label) last.items.push(session);
		else groups.push({ label, items: [session] });
	}
	return groups;
}
