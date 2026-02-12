/**
 * In-memory TTL cache for admin course layout data.
 * Caches course record, modules, cohorts, and hubs per slug.
 * Not distributed - works per-process only (same pattern as rate-limit.ts).
 */

const TTL_MS = 30_000; // 30 seconds

interface CachedCourseData {
	course: any;
	modules: any[];
	cohorts: any[];
	hubs: any[];
	cachedAt: number;
}

const cache = new Map<string, CachedCourseData>();

/**
 * Get cached course data if it exists and hasn't expired.
 */
export function getCachedCourseData(slug: string): CachedCourseData | null {
	const entry = cache.get(slug);
	if (!entry) return null;

	if (Date.now() - entry.cachedAt > TTL_MS) {
		cache.delete(slug);
		return null;
	}

	return entry;
}

/**
 * Store course data in the cache.
 */
export function setCachedCourseData(
	slug: string,
	data: { course: any; modules: any[]; cohorts: any[]; hubs: any[] }
) {
	cache.set(slug, {
		...data,
		cachedAt: Date.now()
	});
}

/**
 * Invalidate cache for a specific course slug.
 */
export function invalidateCourseCache(slug: string) {
	cache.delete(slug);
}

/**
 * Invalidate cache by course ID (scans all entries).
 * Useful when you have the course ID but not the slug.
 */
export function invalidateCourseCacheById(courseId: string) {
	for (const [slug, entry] of cache) {
		if (entry.course?.id === courseId) {
			cache.delete(slug);
			return;
		}
	}
}

// Clean up expired entries every 60 seconds
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [slug, entry] of cache) {
			if (now - entry.cachedAt > TTL_MS) {
				cache.delete(slug);
			}
		}
	}, 60_000);
}
