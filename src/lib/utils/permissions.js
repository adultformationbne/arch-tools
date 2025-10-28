/**
 * Permissions Utility
 * Helper functions for checking user permissions across the application
 */

/**
 * Available modules in the system
 */
export const MODULES = {
	USER_MANAGEMENT: 'user_management',
	DGR: 'dgr',
	EDITOR: 'editor',
	COURSES: 'courses'
};

/**
 * User roles
 */
export const ROLES = {
	ADMIN: 'admin',
	STUDENT: 'student',
	HUB_COORDINATOR: 'hub_coordinator'
};

/**
 * Check if user has access to a specific module
 * @param {Object} userProfile - User profile object with modules array
 * @param {string} moduleId - Module ID to check (use MODULES constants)
 * @returns {boolean} True if user has access to the module
 */
export function hasModuleAccess(userProfile, moduleId) {
	if (!userProfile || !userProfile.modules) return false;
	return userProfile.modules.includes(moduleId);
}

/**
 * Check if user has access to any of the specified modules
 * @param {Object} userProfile - User profile object with modules array
 * @param {string[]} moduleIds - Array of module IDs to check
 * @returns {boolean} True if user has access to at least one module
 */
export function hasAnyModuleAccess(userProfile, moduleIds) {
	if (!userProfile || !userProfile.modules) return false;
	return moduleIds.some(moduleId => userProfile.modules.includes(moduleId));
}

/**
 * Check if user has access to all of the specified modules
 * @param {Object} userProfile - User profile object with modules array
 * @param {string[]} moduleIds - Array of module IDs to check
 * @returns {boolean} True if user has access to all modules
 */
export function hasAllModuleAccess(userProfile, moduleIds) {
	if (!userProfile || !userProfile.modules) return false;
	return moduleIds.every(moduleId => userProfile.modules.includes(moduleId));
}

/**
 * Check if user is an admin (has role='admin')
 * @param {Object} userProfile - User profile object
 * @returns {boolean} True if user is an admin
 */
export function isAdmin(userProfile) {
	return userProfile?.role === ROLES.ADMIN;
}

/**
 * Check if user is a student (has role='student')
 * @param {Object} userProfile - User profile object
 * @returns {boolean} True if user is a student
 */
export function isStudent(userProfile) {
	return userProfile?.role === ROLES.STUDENT;
}

/**
 * Check if user is a hub coordinator (has role='hub_coordinator')
 * @param {Object} userProfile - User profile object
 * @returns {boolean} True if user is a hub coordinator
 */
export function isHubCoordinator(userProfile) {
	return userProfile?.role === ROLES.HUB_COORDINATOR;
}

/**
 * Get the default redirect path based on user role and modules
 * @param {Object} userProfile - User profile object
 * @returns {string} Default path to redirect user to
 */
export function getDefaultRedirectPath(userProfile) {
	if (!userProfile) return '/login';

	// Students and hub coordinators go to ACCF dashboard
	if (isStudent(userProfile) || isHubCoordinator(userProfile)) {
		return '/dashboard';
	}

	// Admins go to /admin (will show modules they have access to)
	if (isAdmin(userProfile)) {
		return '/admin';
	}

	// Fallback
	return '/profile';
}

/**
 * Get user's accessible modules
 * @param {Object} userProfile - User profile object
 * @returns {string[]} Array of module IDs user has access to
 */
export function getUserModules(userProfile) {
	return userProfile?.modules || [];
}

/**
 * Check if user can manage other users
 * @param {Object} userProfile - User profile object
 * @returns {boolean} True if user has user management access
 */
export function canManageUsers(userProfile) {
	return hasModuleAccess(userProfile, MODULES.USER_MANAGEMENT);
}

/**
 * Format module name for display
 * @param {string} moduleId - Module ID
 * @returns {string} Formatted module name
 */
export function getModuleName(moduleId) {
	const names = {
		[MODULES.USER_MANAGEMENT]: 'User Management',
		[MODULES.DGR]: 'Daily Gospel Reflections',
		[MODULES.EDITOR]: 'Content Editor',
		[MODULES.COURSES]: 'Courses'
	};
	return names[moduleId] || moduleId;
}
