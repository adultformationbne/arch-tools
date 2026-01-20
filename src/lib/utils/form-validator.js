/**
 * Form Validation System - Simple, composable validators
 *
 * Usage:
 *   const result = validate(data, {
 *     email: [validators.required, validators.email],
 *     password: [validators.required, validators.minLength(6)]
 *   });
 */

/** Canonical email regex - import this instead of duplicating */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Simple email validation check */
export const isValidEmail = (email) => EMAIL_REGEX.test(email);

export const validators = {
	required: (value, fieldName = 'Field') => {
		if (value === null || value === undefined) return `${fieldName} is required`;
		if (typeof value === 'string' && !value.trim()) return `${fieldName} is required`;
		if (Array.isArray(value) && value.length === 0) return `${fieldName} is required`;
		return null;
	},

	minLength: (min) => (value, fieldName = 'Field') => {
		if (!value || typeof value !== 'string') return null;
		return value.length < min ? `${fieldName} must be at least ${min} characters` : null;
	},

	maxLength: (max) => (value, fieldName = 'Field') => {
		if (!value || typeof value !== 'string') return null;
		return value.length > max ? `${fieldName} must be no more than ${max} characters` : null;
	},

	email: (value, fieldName = 'Email') => {
		if (!value) return null;
		return !EMAIL_REGEX.test(value) ? `${fieldName} must be a valid email address` : null;
	},

	password: (value, fieldName = 'Password') => {
		if (!value) return null;
		return value.length < 6 ? `${fieldName} must be at least 6 characters` : null;
	},

	matches: (compareValue, compareFieldName = 'field') => (value, fieldName = 'Field') => {
		return value !== compareValue ? `${fieldName} must match ${compareFieldName}` : null;
	},

	url: (value, fieldName = 'URL') => {
		if (!value) return null;
		try {
			new URL(value);
			return null;
		} catch {
			try {
				new URL(`https://${value}`);
				return null;
			} catch {
				return `${fieldName} must be a valid URL`;
			}
		}
	},

	range: (min, max) => (value, fieldName = 'Field') => {
		const num = Number(value);
		if (isNaN(num)) return `${fieldName} must be a number`;
		if (num < min || num > max) return `${fieldName} must be between ${min} and ${max}`;
		return null;
	},

	pattern: (regex, message) => (value, fieldName = 'Field') => {
		if (!value) return null;
		return !regex.test(value) ? message.replace('{field}', fieldName) : null;
	}
};

/**
 * Validate form data against rules
 * @returns {{ isValid: boolean, errors: Object, errorMessages: string[] }}
 */
export function validate(data, rules, fieldNames = {}) {
	const errors = {};
	const errorMessages = [];

	for (const [fieldName, fieldValidators] of Object.entries(rules)) {
		const value = data[fieldName];
		const displayName = fieldNames[fieldName] || fieldName;

		for (const validator of fieldValidators) {
			const error = validator(value, displayName);
			if (error) {
				errors[fieldName] = error;
				errorMessages.push(error);
				break;
			}
		}
	}

	return {
		isValid: Object.keys(errors).length === 0,
		errors,
		errorMessages
	};
}

/** Validate a single field, returns error message or null */
export function validateField(value, fieldValidators, fieldName = 'Field') {
	for (const validator of fieldValidators) {
		const error = validator(value, fieldName);
		if (error) return error;
	}
	return null;
}

/** Add https:// to URLs missing a protocol */
export function normalizeUrl(url) {
	if (!url || typeof url !== 'string') return url;
	const trimmed = url.trim();
	if (!trimmed) return trimmed;
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

/** Common validation rule sets */
export const commonRules = {
	email: [validators.required, validators.email],
	password: [validators.required, validators.password],
	requiredText: [validators.required],
	requiredEmail: [validators.required, validators.email],
	url: [validators.url],
	requiredUrl: [validators.required, validators.url]
};

/** Create password confirmation validators */
export function passwordConfirmation(passwordValue) {
	return [validators.required, validators.matches(passwordValue, 'password')];
}

/** Toast integration helper */
export function createValidationToastHelper(toast) {
	return {
		showValidationErrors: (result, title = 'Validation Error') => {
			if (!result.isValid) {
				const message = result.errorMessages.length === 1
					? result.errorMessages[0]
					: result.errorMessages.join('\n');
				toast.error({ title, message, duration: 4000 });
			}
		},
		showFieldError: (error, title = 'Validation Error') => {
			if (error) {
				toast.error({ title, message: error, duration: 4000 });
			}
		}
	};
}
