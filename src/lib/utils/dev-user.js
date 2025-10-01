/**
 * Development user utilities for ACCF platform
 * Only works in localhost development environment
 */

/**
 * Gets the current development user from localStorage
 * @returns {Object|null} The current dev user object or null
 */
export function getDevUser() {
	if (typeof window === 'undefined') {
		// Server-side: return null, will need to get from cookies/headers
		return null;
	}

	// Client-side: get from localStorage
	try {
		const saved = localStorage.getItem('dev-user');
		return saved ? JSON.parse(saved) : null;
	} catch (error) {
		console.error('Error reading dev user from localStorage:', error);
		return null;
	}
}

/**
 * Sets the current development user in localStorage
 * @param {Object} user - The user object to store
 */
export function setDevUser(user) {
	if (typeof window === 'undefined') {
		return; // Can't set localStorage on server
	}

	try {
		localStorage.setItem('dev-user', JSON.stringify(user));
	} catch (error) {
		console.error('Error saving dev user to localStorage:', error);
	}
}

/**
 * Checks if we're in development mode
 * @returns {boolean}
 */
export function isDevMode() {
	if (typeof window === 'undefined') {
		// Server-side: check NODE_ENV or other indicators
		return process.env.NODE_ENV === 'development';
	}

	// Client-side: check hostname
	return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Real user data from Supabase - this will replace the mock data
 */
export const realDevUsers = [
	{
		id: 'c4bf9f0b-b7e6-4331-b787-3cc8a1e07830',
		name: 'Desi Cleary',
		role: 'accf_admin',
		email: 'desicl@bne.catholic.net.au',
		full_name: 'Desi Cleary',
		current_week: null,
		cohort_id: null
	},
	{
		id: '33e35496-c46a-4633-8ff9-c73672141f56',
		name: 'Jennifer Davis',
		role: 'accf_student',
		email: 'student5@example.com',
		full_name: 'Jennifer Davis',
		current_week: 3,
		cohort_id: '82d230c2-6ecc-4eab-96fc-c90a11dbd5fe'
	},
	{
		id: '4b69f1d6-453f-405c-9d91-25f91e04439f',
		name: 'Lisa Anderson',
		role: 'accf_student',
		email: 'student7@example.com',
		full_name: 'Lisa Anderson',
		current_week: 3,
		cohort_id: '82d230c2-6ecc-4eab-96fc-c90a11dbd5fe'
	},
	{
		id: '5ed629a4-614b-476e-a1da-8e3f0ad0915c',
		name: 'David Miller',
		role: 'accf_student',
		email: 'student6@example.com',
		full_name: 'David Miller',
		current_week: 3,
		cohort_id: '82d230c2-6ecc-4eab-96fc-c90a11dbd5fe'
	},
	{
		id: '65deff22-b9a8-4278-b3bc-e9923affe424',
		name: 'Christopher Lee',
		role: 'accf_student',
		email: 'student10@example.com',
		full_name: 'Christopher Lee',
		current_week: 2,
		cohort_id: '82d230c2-6ecc-4eab-96fc-c90a11dbd5fe'
	},
	{
		id: 'd25d06ef-7fb6-4031-9aaa-8e78cd908194',
		name: 'Amanda White',
		role: 'accf_student',
		email: 'student9@example.com',
		full_name: 'Amanda White',
		current_week: 2,
		cohort_id: '82d230c2-6ecc-4eab-96fc-c90a11dbd5fe'
	},
	{
		id: 'e7633cd0-5609-4094-901c-272403828e68',
		name: 'Andrew Wilson',
		role: 'accf_student',
		email: 'student16@example.com',
		full_name: 'Andrew Wilson',
		current_week: 1,
		cohort_id: '82d230c2-6ecc-4eab-96fc-c90a11dbd5fe'
	}
];