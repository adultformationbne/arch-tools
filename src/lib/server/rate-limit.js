/**
 * Rate Limiting Utility
 *
 * In-memory rate limiting for preventing brute force attacks.
 * Uses IP-based throttling with configurable limits.
 *
 * SECURITY NOTE: This is a simple in-memory implementation.
 * For production with multiple servers, consider Redis-based rate limiting.
 */

// Store attempts in memory: Map<identifier, timestamp[]>
const attempts = new Map();

// Cleanup interval to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_STORED_IDENTIFIERS = 10000;

let lastCleanup = Date.now();

/**
 * Check if request should be rate limited
 *
 * @param {string} identifier - Unique identifier (usually IP address)
 * @param {number} maxAttempts - Maximum attempts allowed (default: 5)
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @throws {Error} If rate limit exceeded
 */
export function checkRateLimit(identifier, maxAttempts = 5, windowMs = 60000) {
	const now = Date.now();

	// Get existing attempts for this identifier
	const userAttempts = attempts.get(identifier) || [];

	// Filter out attempts outside the time window
	const recentAttempts = userAttempts.filter((timestamp) => now - timestamp < windowMs);

	// Check if rate limit exceeded
	if (recentAttempts.length >= maxAttempts) {
		const oldestAttempt = Math.min(...recentAttempts);
		const retryAfterMs = windowMs - (now - oldestAttempt);
		const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

		throw new Error(
			`Too many attempts. Please try again in ${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}.`
		);
	}

	// Add current attempt
	recentAttempts.push(now);
	attempts.set(identifier, recentAttempts);

	// Opportunistic cleanup to prevent memory leaks
	if (now - lastCleanup > CLEANUP_INTERVAL || attempts.size > MAX_STORED_IDENTIFIERS) {
		cleanupOldAttempts(now, windowMs);
		lastCleanup = now;
	}
}

/**
 * Clean up old attempts from memory
 * Removes identifiers with no recent attempts within the window
 *
 * @param {number} now - Current timestamp
 * @param {number} windowMs - Time window to keep
 */
function cleanupOldAttempts(now, windowMs) {
	let cleaned = 0;

	for (const [identifier, timestamps] of attempts.entries()) {
		// Remove this identifier if all attempts are outside the window
		const hasRecentAttempts = timestamps.some((timestamp) => now - timestamp < windowMs);

		if (!hasRecentAttempts) {
			attempts.delete(identifier);
			cleaned++;
		}
	}

	if (cleaned > 0) {
		console.log(`[Rate Limit] Cleaned up ${cleaned} expired identifiers`);
	}
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or after successful authentication
 *
 * @param {string} identifier - Identifier to reset
 */
export function resetRateLimit(identifier) {
	attempts.delete(identifier);
}

/**
 * Get current attempt count for an identifier
 * Useful for monitoring
 *
 * @param {string} identifier - Identifier to check
 * @param {number} windowMs - Time window to check (default: 60000)
 * @returns {number} Number of attempts in window
 */
export function getAttemptCount(identifier, windowMs = 60000) {
	const now = Date.now();
	const userAttempts = attempts.get(identifier) || [];
	return userAttempts.filter((timestamp) => now - timestamp < windowMs).length;
}

/**
 * Get total number of tracked identifiers
 * Useful for monitoring memory usage
 *
 * @returns {number}
 */
export function getTrackedIdentifierCount() {
	return attempts.size;
}
