/**
 * Permissions Utility
 * Helper functions for checking user permissions across the application
 */

/**
 * Available modules in the system
 */
export const MODULES = {
	PLATFORM_ADMIN: 'platform.admin',
	DGR: 'dgr',
	EDITOR: 'editor',
	COURSES_PARTICIPANT: 'courses.participant',
	COURSES_MANAGER: 'courses.manager',
	COURSES_ADMIN: 'courses.admin'
};

/**
 * Course enrollment roles (PARTICIPANTS ONLY - managers/admins are NOT enrolled)
 * Managers/admins manage courses via platform modules + assigned_course_ids
 */
export const ENROLLMENT_ROLES = {
	STUDENT: 'student',
	COORDINATOR: 'coordinator'
};

/**
 * Check if user has access to a specific module (supports namespaced modules)
 * @param {Object} userProfile - User profile object with modules array
 * @param {string} moduleId - Module ID to check (use MODULES constants)
 * @returns {boolean} True if user has access to the module
 */
export function hasModuleAccess(userProfile, moduleId) {
	if (!userProfile || !userProfile.modules) return false;
	// Support both exact match and namespaced match (e.g., 'courses' matches 'courses.participant')
	return userProfile.modules.some(m => m === moduleId || m.startsWith(`${moduleId}.`));
}

/**
 * Check if user has exact module.level match
 * @param {Object} userProfile - User profile object with modules array
 * @param {string} moduleLevel - Module.level to check (e.g., 'courses.admin')
 * @returns {boolean} True if user has the exact module level
 */
export function hasModuleLevel(userProfile, moduleLevel) {
	if (!userProfile || !userProfile.modules) return false;
	return userProfile.modules.includes(moduleLevel);
}

/**
 * Check if user has access to any of the specified modules
 * @param {Object} userProfile - User profile object with modules array
 * @param {string[]} moduleIds - Array of module IDs to check
 * @returns {boolean} True if user has access to at least one module
 */
export function hasAnyModuleAccess(userProfile, moduleIds) {
	if (!userProfile || !userProfile.modules) return false;
	return moduleIds.some(moduleId => hasModuleAccess(userProfile, moduleId));
}

/**
 * Check if user has access to all of the specified modules
 * @param {Object} userProfile - User profile object with modules array
 * @param {string[]} moduleIds - Array of module IDs to check
 * @returns {boolean} True if user has access to all modules
 */
export function hasAllModuleAccess(userProfile, moduleIds) {
	if (!userProfile || !userProfile.modules) return false;
	return moduleIds.every(moduleId => hasModuleAccess(userProfile, moduleId));
}

/**
 * Check if user has platform admin access
 * @param {Object} userProfile - User profile object
 * @returns {boolean} True if user can manage users and platform settings
 */
export function canManageUsers(userProfile) {
	return hasModuleAccess(userProfile, MODULES.PLATFORM_ADMIN);
}

/**
 * Check if user has any course management access
 * @param {Object} userProfile - User profile object
 * @returns {boolean} True if user can manage courses
 */
export function canManageCourses(userProfile) {
	return hasModuleLevel(userProfile, MODULES.COURSES_ADMIN) ||
	       hasModuleLevel(userProfile, MODULES.COURSES_MANAGER);
}

/**
 * Check if user is a course participant
 * @param {Object} userProfile - User profile object
 * @returns {boolean} True if user has course participant access
 */
export function isCourseParticipant(userProfile) {
	return hasModuleLevel(userProfile, MODULES.COURSES_PARTICIPANT);
}

/**
 * Get the default redirect path based on user modules
 * @param {Object} userProfile - User profile object
 * @returns {string} Default path to redirect user to
 */
export function getDefaultRedirectPath(userProfile) {
	if (!userProfile) return '/login';

	// Platform admin → /users
	if (hasModuleAccess(userProfile, MODULES.PLATFORM_ADMIN)) {
		return '/settings';
	}

	// Course management → /courses
	if (canManageCourses(userProfile)) {
		return '/courses';
	}

	// DGR access → /dgr
	if (hasModuleAccess(userProfile, MODULES.DGR)) {
		return '/dgr';
	}

	// Editor access → /editor
	if (hasModuleAccess(userProfile, MODULES.EDITOR)) {
		return '/editor';
	}

	// Course participant → /my-courses
	if (isCourseParticipant(userProfile)) {
		return '/my-courses';
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
 * Format module name for display
 * @param {string} moduleId - Module ID
 * @returns {string} Formatted module name
 */
export function getModuleName(moduleId) {
	const names = {
		[MODULES.PLATFORM_ADMIN]: 'Platform Admin',
		[MODULES.DGR]: 'Daily Gospel Reflections',
		[MODULES.EDITOR]: 'Content Editor',
		[MODULES.COURSES_PARTICIPANT]: 'Course Participant',
		[MODULES.COURSES_MANAGER]: 'Course Manager',
		[MODULES.COURSES_ADMIN]: 'Course Admin'
	};
	return names[moduleId] || moduleId;
}
