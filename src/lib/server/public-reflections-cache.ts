/**
 * In-memory TTL cache for the public reflections feed shown on the student
 * dashboard. The same 20 rows are identical for every participant in a
 * cohort, so caching collapses per-visit re-fetches into one shared read.
 * Not distributed - works per-process only (same pattern as course-cache.ts).
 */

const TTL_MS = 5 * 60_000; // 5 minutes - freshness isn't critical for a community feed

interface CacheEntry {
	data: any[];
	cachedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedPublicReflections(cohortId: string): any[] | null {
	const entry = cache.get(cohortId);
	if (!entry) return null;

	if (Date.now() - entry.cachedAt > TTL_MS) {
		cache.delete(cohortId);
		return null;
	}

	return entry.data;
}

export function setCachedPublicReflections(cohortId: string, data: any[]) {
	cache.set(cohortId, { data, cachedAt: Date.now() });
}

// Clean up expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [cohortId, entry] of cache) {
			if (now - entry.cachedAt > TTL_MS) {
				cache.delete(cohortId);
			}
		}
	}, 60_000);
}
