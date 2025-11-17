/**
 * User Avatar Utilities
 *
 * Provides consistent color schemes and initials for user avatars
 * Colors are calculated based on user ID (immutable) for consistency
 */

// Light background colors with dark text (suitable for white backgrounds)
// All colors meet WCAG AA contrast requirements (4.5:1 minimum)
export const avatarColors = [
	{ bg: '#FEE2E2', text: '#991B1B' }, // Light red
	{ bg: '#FFEDD5', text: '#9A3412' }, // Light orange
	{ bg: '#FEF3C7', text: '#92400E' }, // Light amber
	{ bg: '#DCFCE7', text: '#166534' }, // Light green
	{ bg: '#D1FAE5', text: '#065F46' }, // Light emerald
	{ bg: '#CFFAFE', text: '#155E75' }, // Light cyan
	{ bg: '#DBEAFE', text: '#1E40AF' }, // Light blue
	{ bg: '#E0E7FF', text: '#3730A3' }, // Light indigo
	{ bg: '#EDE9FE', text: '#5B21B6' }, // Light violet
	{ bg: '#F3E8FF', text: '#6B21A8' }, // Light purple
	{ bg: '#FCE7F3', text: '#9D174D' }, // Light pink
	{ bg: '#FEF9C3', text: '#854D0E' }  // Light yellow
];

/**
 * Get consistent color for a user based on their ID
 * Same user ID will always return the same color
 *
 * @param {string} userId - User's unique ID (immutable)
 * @returns {{ bg: string, text: string }} - Background and text colors
 */
export function getColorForUser(userId) {
	if (!userId) {
		// Fallback to first color if no ID
		return avatarColors[0];
	}

	// Simple hash function to convert user ID to a number
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = userId.charCodeAt(i) + ((hash << 5) - hash);
	}

	// Use modulo to select a color from the palette
	const index = Math.abs(hash) % avatarColors.length;
	return avatarColors[index];
}

/**
 * Extract initials from a user's full name
 *
 * Examples:
 *   "Liam Desic" → "LD"
 *   "John" → "JO"
 *   "Mary Jane Watson" → "MW"
 *   "" (empty, with email) → First 2 chars of email
 *
 * @param {string} fullName - User's full name
 * @param {string} email - User's email (fallback if no name)
 * @returns {string} - Two-character initials
 */
export function getUserInitials(fullName, email = '') {
	// If no name, use email as fallback
	if (!fullName || !fullName.trim()) {
		if (email) {
			const emailName = email.split('@')[0];
			return emailName.substring(0, 2).toUpperCase();
		}
		return '??'; // Ultimate fallback
	}

	// Split name into parts
	const parts = fullName.trim().split(/\s+/);

	if (parts.length === 1) {
		// Single name → use first 2 characters
		return parts[0].substring(0, 2).toUpperCase();
	}

	// Multiple names → first initial + last initial
	const firstInitial = parts[0][0];
	const lastInitial = parts[parts.length - 1][0];
	return (firstInitial + lastInitial).toUpperCase();
}
