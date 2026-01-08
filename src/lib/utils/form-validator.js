/**
 * Form Validation System
 *
 * A simple, extensible validation system designed for easy migration to schema-based
 * validation (like Zod) in the future. Uses functional approach for composability.
 *
 * @example
 * import { validate, validators } from '$lib/utils/form-validator.js';
 *
 * const result = validate(data, {
 *   email: [validators.required, validators.email],
 *   password: [validators.required, validators.minLength(6)]
 * });
 *
 * if (!result.isValid) {
 *   console.log(result.errors); // { email: 'Invalid email format' }
 * }
 */

/**
 * Built-in validator functions
 */
export const validators = {
	/**
	 * Validates required fields
	 * @param {any} value - The value to validate
	 * @param {string} fieldName - Name of the field for error messages
	 * @returns {string|null} Error message or null if valid
	 */
	required: (value, fieldName = 'Field') => {
		if (value === null || value === undefined) {
			return `${fieldName} is required`;
		}

		// Handle strings, arrays, and objects
		if (typeof value === 'string' && !value.trim()) {
			return `${fieldName} is required`;
		}

		if (Array.isArray(value) && value.length === 0) {
			return `${fieldName} is required`;
		}

		return null;
	},

	/**
	 * Validates minimum length for strings
	 * @param {number} min - Minimum length
	 * @returns {Function} Validator function
	 */
	minLength: (min) => (value, fieldName = 'Field') => {
		if (!value || typeof value !== 'string') return null;
		return value.length < min ? `${fieldName} must be at least ${min} characters` : null;
	},

	/**
	 * Validates maximum length for strings
	 * @param {number} max - Maximum length
	 * @returns {Function} Validator function
	 */
	maxLength: (max) => (value, fieldName = 'Field') => {
		if (!value || typeof value !== 'string') return null;
		return value.length > max ? `${fieldName} must be no more than ${max} characters` : null;
	},

	/**
	 * Validates email format
	 * @param {string} value - Email to validate
	 * @param {string} fieldName - Field name for error messages
	 * @returns {string|null} Error message or null if valid
	 */
	email: (value, fieldName = 'Email') => {
		if (!value) return null; // Use required validator separately
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return !emailRegex.test(value) ? `${fieldName} must be a valid email address` : null;
	},

	/**
	 * Validates password strength (minimum 6 characters for now)
	 * @param {string} value - Password to validate
	 * @param {string} fieldName - Field name for error messages
	 * @returns {string|null} Error message or null if valid
	 */
	password: (value, fieldName = 'Password') => {
		if (!value) return null; // Use required validator separately
		if (value.length < 6) {
			return `${fieldName} must be at least 6 characters`;
		}
		return null;
	},

	/**
	 * Validates that two values match (useful for password confirmation)
	 * @param {any} compareValue - Value to compare against
	 * @param {string} compareFieldName - Name of the field being compared to
	 * @returns {Function} Validator function
	 */
	matches: (compareValue, compareFieldName = 'field') => (value, fieldName = 'Field') => {
		return value !== compareValue ? `${fieldName} must match ${compareFieldName}` : null;
	},

	/**
	 * Validates URL format (accepts URLs with or without protocol)
	 * @param {string} value - URL to validate
	 * @param {string} fieldName - Field name for error messages
	 * @returns {string|null} Error message or null if valid
	 */
	url: (value, fieldName = 'URL') => {
		if (!value) return null; // Use required validator separately
		try {
			// Try with the value as-is first
			new URL(value);
			return null;
		} catch {
			// If it fails, try adding https:// prefix
			try {
				new URL(`https://${value}`);
				return null;
			} catch {
				return `${fieldName} must be a valid URL`;
			}
		}
	},

	/**
	 * Validates numeric range
	 * @param {number} min - Minimum value
	 * @param {number} max - Maximum value
	 * @returns {Function} Validator function
	 */
	range: (min, max) => (value, fieldName = 'Field') => {
		const num = Number(value);
		if (isNaN(num)) return `${fieldName} must be a number`;
		if (num < min || num > max) return `${fieldName} must be between ${min} and ${max}`;
		return null;
	},

	/**
	 * Custom validator creator for specific patterns
	 * @param {RegExp} regex - Regular expression to test
	 * @param {string} message - Error message
	 * @returns {Function} Validator function
	 */
	pattern: (regex, message) => (value, fieldName = 'Field') => {
		if (!value) return null; // Use required validator separately
		return !regex.test(value) ? message.replace('{field}', fieldName) : null;
	}
};

/**
 * Validation result type
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Object} errors - Object with field names as keys and error messages as values
 * @property {string[]} errorMessages - Array of all error messages
 */

/**
 * Validates form data against a set of validation rules
 * @param {Object} data - The form data to validate
 * @param {Object} rules - Validation rules object where keys are field names and values are arrays of validators
 * @param {Object} fieldNames - Optional custom field names for error messages
 * @returns {ValidationResult} Validation result
 *
 * @example
 * const result = validate({
 *   email: 'invalid-email',
 *   password: '123'
 * }, {
 *   email: [validators.required, validators.email],
 *   password: [validators.required, validators.password]
 * }, {
 *   email: 'Email Address',
 *   password: 'Password'
 * });
 */
export function validate(data, rules, fieldNames = {}) {
	const errors = {};
	const errorMessages = [];

	for (const [fieldName, validators] of Object.entries(rules)) {
		const value = data[fieldName];
		const displayName = fieldNames[fieldName] || fieldName;

		for (const validator of validators) {
			const error = validator(value, displayName);
			if (error) {
				errors[fieldName] = error;
				errorMessages.push(error);
				break; // Stop at first error for this field
			}
		}
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
		errorMessages
	};
}

/**
 * Validates a single field
 * @param {any} value - The value to validate
 * @param {Function[]} validators - Array of validator functions
 * @param {string} fieldName - Field name for error messages
 * @returns {string|null} Error message or null if valid
 */
export function validateField(value, validators, fieldName = 'Field') {
	for (const validator of validators) {
		const error = validator(value, fieldName);
		if (error) return error;
	}
	return null;
}

/**
 * Normalizes a URL by adding https:// if no protocol is present
 * @param {string} url - The URL to normalize
 * @returns {string} The normalized URL with protocol
 *
 * @example
 * normalizeUrl('facebook.com/page') // => 'https://facebook.com/page'
 * normalizeUrl('https://google.com') // => 'https://google.com'
 * normalizeUrl('http://example.com') // => 'http://example.com'
 * normalizeUrl('mailto:test@example.com') // => 'mailto:test@example.com'
 */
export function normalizeUrl(url) {
	if (!url || typeof url !== 'string') return url;

	const trimmed = url.trim();
	if (!trimmed) return trimmed;

	// Already has a protocol (http, https, mailto, tel, etc.)
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
		return trimmed;
	}

	// Add https:// by default
	return `https://${trimmed}`;
}

/**
 * Common validation rule sets for reuse
 */
export const commonRules = {
	email: [validators.required, validators.email],
	password: [validators.required, validators.password],
	requiredText: [validators.required],
	requiredEmail: [validators.required, validators.email],
	url: [validators.url],
	requiredUrl: [validators.required, validators.url]
};

/**
 * Creates a password confirmation validator
 * @param {string} passwordValue - The password to match against
 * @returns {Function[]} Array of validators for password confirmation
 */
export function passwordConfirmation(passwordValue) {
	return [
		validators.required,
		validators.matches(passwordValue, 'password')
	];
}

/**
 * Migration helper: converts current validation patterns to new system
 * This helps with gradual migration of existing validation code
 *
 * @example
 * // Old way:
 * if (!email) return 'Email is required';
 * if (!email.includes('@')) return 'Invalid email';
 *
 * // New way:
 * const error = migrateValidation(email, commonRules.email, 'Email');
 * if (error) return error;
 */
export function migrateValidation(value, validators, fieldName) {
	return validateField(value, validators, fieldName);
}

/**
 * Future-proofing: Schema-like interface for easy Zod migration
 * This provides a schema-like API that can be easily converted to Zod later
 *
 * @example
 * const userSchema = createSchema({
 *   email: commonRules.email,
 *   password: commonRules.password
 * });
 *
 * const result = userSchema.validate(userData);
 */
export function createSchema(rules) {
	return {
		validate: (data, fieldNames = {}) => validate(data, rules, fieldNames),

		// Future Zod migration helper
		toZod: () => {
			console.warn('Zod migration not yet implemented. Rules:', rules);
			return null;
		}
	};
}

/**
 * Integration with existing toast system
 * Assumes toast is available in the calling context
 */
export function createValidationToastHelper(toast) {
	return {
		/**
		 * Shows validation errors using toast
		 * @param {ValidationResult} result - Validation result
		 * @param {string} title - Toast title
		 */
		showValidationErrors: (result, title = 'Validation Error') => {
			if (!result.isValid) {
				const message = result.errorMessages.length === 1
					? result.errorMessages[0]
					: result.errorMessages.join('\n');

				toast.error({
					title,
					message,
					duration: 4000
				});
			}
		},

		/**
		 * Shows single field error
		 * @param {string} error - Error message
		 * @param {string} title - Toast title
		 */
		showFieldError: (error, title = 'Validation Error') => {
			if (error) {
				toast.error({
					title,
					message: error,
					duration: 4000
				});
			}
		}
	};
}