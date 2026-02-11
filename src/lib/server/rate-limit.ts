/**
 * Simple in-memory rate limiter for API endpoints.
 * Not distributed - works per-process only.
 * Sufficient for single-server deployments.
 */

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Check if a request is within rate limits.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
	const now = Date.now();
	const entry = store.get(key);

	if (!entry || now > entry.resetAt) {
		store.set(key, { count: 1, resetAt: now + windowMs });
		return true;
	}

	if (entry.count >= maxRequests) {
		return false;
	}

	entry.count++;
	return true;
}

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
	setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (now > entry.resetAt) {
				store.delete(key);
			}
		}
	}, 5 * 60_000);
}
