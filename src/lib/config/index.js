import { platformConfig } from './platform.js';

/**
 * Platform branding and configuration
 * @type {Object}
 * @property {string} name - Full platform name
 * @property {string} shortName - Short version of name
 * @property {string} organization - Organization name
 * @property {string} fromEmail - Default from email address
 * @property {string} supportEmail - Support contact email
 * @property {string} logoPath - Path to logo mark
 * @property {string} primaryLogoPath - Path to primary logo
 */
export const platform = platformConfig;

/**
 * Get platform configuration
 * @returns {Object} Platform configuration
 */
export function getPlatformConfig() {
	return platformConfig;
}
