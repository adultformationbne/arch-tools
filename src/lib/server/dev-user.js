/**
 * Server-side development user utilities for ACCF platform
 */

/**
 * Gets the current development user from request cookies
 * @param {Request} request - The request object
 * @returns {Object|null} The current dev user object or null
 */
export function getDevUserFromRequest(request) {
	// Only in development mode
	if (process.env.NODE_ENV !== 'development') {
		return null;
	}

	try {
		const cookieHeader = request.headers.get('cookie');

		if (!cookieHeader) {
			return defaultDevUser;
		}

		// Parse cookies manually since we don't have a cookie parser
		const cookies = {};
		cookieHeader.split(';').forEach(cookie => {
			const [name, value] = cookie.trim().split('=');
			if (name && value) {
				cookies[name] = decodeURIComponent(value);
			}
		});

		const devUserCookie = cookies['dev-user'];

		if (!devUserCookie) {
			return defaultDevUser;
		}

		const parsedUser = JSON.parse(devUserCookie);
		return parsedUser;
	} catch (error) {
		console.error('Error reading dev user from cookies:', error);
		return defaultDevUser;
	}
}

/**
 * Sets a cookie for the dev user (for client-side use)
 * @param {Object} user - The user object
 * @returns {string} Cookie string
 */
export function createDevUserCookie(user) {
	if (process.env.NODE_ENV !== 'development') {
		return '';
	}

	const userJson = JSON.stringify(user);
	const encodedUser = encodeURIComponent(userJson);
	return `dev-user=${encodedUser}; Path=/; SameSite=Lax`;
}

/**
 * Default fallback user for development
 */
export const defaultDevUser = {
	id: '33e35496-c46a-4633-8ff9-c73672141f56',
	name: 'Jennifer Davis',
	role: 'accf_student',
	email: 'student5@example.com',
	full_name: 'Jennifer Davis',
	current_session: 3,
	cohort_id: '2cb2b8a1-d2f2-4994-b5ca-ede68b29c231'
};