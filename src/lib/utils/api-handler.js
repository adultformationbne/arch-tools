import {
	toastLoading,
	toastSuccess,
	toastError,
	updateToastStatus,
	toastMultiStep,
	toastNextStep
} from './toast-helpers.js';

/**
 * Default configuration for API requests
 */
const DEFAULT_CONFIG = {
	showToast: true,
	loadingMessage: 'Processing...',
	loadingTitle: 'Loading...',
	successMessage: 'Operation completed successfully',
	successTitle: 'Success!',
	errorTitle: 'Operation Failed',
	timeout: 30000, // 30 seconds
	retries: 0
};

/**
 * Custom error class for API responses
 */
export class ApiError extends Error {
	constructor(message, status, response) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.response = response;
	}
}

/**
 * Parse error response to extract meaningful message
 * @param {Response} response - The fetch response
 * @param {string} fallbackMessage - Fallback message if parsing fails
 * @returns {Promise<string>} The error message
 */
async function parseErrorMessage(response, fallbackMessage = 'An error occurred') {
	try {
		const contentType = response.headers.get('content-type');

		if (contentType?.includes('application/json')) {
			const data = await response.json();
			return data.error || data.message || fallbackMessage;
		} else {
			const text = await response.text();
			return text || fallbackMessage;
		}
	} catch (parseError) {
		return fallbackMessage;
	}
}

/**
 * Main API request handler with toast integration
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @param {Object} config - Toast and behavior configuration
 * @returns {Promise<any>} The response data
 */
export async function apiRequest(url, options = {}, config = {}) {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };
	let toastId = null;

	// Show loading toast if enabled
	if (finalConfig.showToast) {
		toastId = toastLoading(finalConfig.loadingMessage, finalConfig.loadingTitle);
	}

	try {
		// Set up default headers
		const headers = {
			'Content-Type': 'application/json',
			...options.headers
		};

		// Create abort controller for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), finalConfig.timeout);

		const fetchOptions = {
			...options,
			headers,
			signal: controller.signal
		};

		// Make the request
		const response = await fetch(url, fetchOptions);
		clearTimeout(timeoutId);

		// Handle non-2xx responses
		if (!response.ok) {
			const errorMessage = await parseErrorMessage(response, 'Request failed');
			throw new ApiError(errorMessage, response.status, response);
		}

		// Parse response
		let data;
		const contentType = response.headers.get('content-type');

		if (contentType?.includes('application/json')) {
			data = await response.json();
		} else {
			data = await response.text();
		}

		// Show success toast if enabled
		if (finalConfig.showToast && toastId) {
			updateToastStatus(
				toastId,
				'success',
				finalConfig.successMessage,
				finalConfig.successTitle,
				3000
			);
		}

		return data;

	} catch (error) {
		// Handle different types of errors
		let errorMessage = 'An unexpected error occurred';

		if (error.name === 'AbortError') {
			errorMessage = 'Request timed out';
		} else if (error instanceof ApiError) {
			errorMessage = error.message;
		} else if (error.message) {
			errorMessage = error.message;
		}

		// Show error toast if enabled
		if (finalConfig.showToast && toastId) {
			updateToastStatus(
				toastId,
				'error',
				errorMessage,
				finalConfig.errorTitle,
				5000
			);
		}

		throw error;
	}
}

/**
 * Convenience method for GET requests
 * @param {string} url - The URL to fetch
 * @param {Object} config - Configuration options
 * @returns {Promise<any>} The response data
 */
export async function apiGet(url, config = {}) {
	return apiRequest(url, { method: 'GET' }, config);
}

/**
 * Convenience method for POST requests
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @param {Object} config - Configuration options
 * @returns {Promise<any>} The response data
 */
export async function apiPost(url, data, config = {}) {
	return apiRequest(
		url,
		{
			method: 'POST',
			body: JSON.stringify(data)
		},
		{
			loadingMessage: 'Saving...',
			successMessage: 'Saved successfully',
			...config
		}
	);
}

/**
 * Convenience method for PUT requests
 * @param {string} url - The URL to fetch
 * @param {Object} data - The data to send
 * @param {Object} config - Configuration options
 * @returns {Promise<any>} The response data
 */
export async function apiPut(url, data, config = {}) {
	return apiRequest(
		url,
		{
			method: 'PUT',
			body: JSON.stringify(data)
		},
		{
			loadingMessage: 'Updating...',
			successMessage: 'Updated successfully',
			...config
		}
	);
}

/**
 * Convenience method for DELETE requests
 * @param {string} url - The URL to fetch
 * @param {Object} config - Configuration options
 * @returns {Promise<any>} The response data
 */
export async function apiDelete(url, config = {}) {
	return apiRequest(
		url,
		{ method: 'DELETE' },
		{
			loadingMessage: 'Deleting...',
			successMessage: 'Deleted successfully',
			...config
		}
	);
}

/**
 * Create a multi-step API workflow handler
 * @param {Array} steps - Array of step configurations
 * @returns {Object} Multi-step handler with methods
 */
export function createMultiStepHandler(steps) {
	let toastId = null;
	let currentStepIndex = 0;

	return {
		start() {
			currentStepIndex = 0;
			toastId = toastMultiStep(steps, false);
			return toastId;
		},

		async executeStep(stepFunction) {
			try {
				const result = await stepFunction();
				if (currentStepIndex < steps.length - 1) {
					toastNextStep(toastId);
					currentStepIndex++;
				}
				return result;
			} catch (error) {
				if (toastId) {
					updateToastStatus(
						toastId,
						'error',
						error.message || 'Step failed',
						'Process Failed',
						5000
					);
				}
				throw error;
			}
		},

		complete(message = null, title = null) {
			if (toastId && currentStepIndex === steps.length - 1) {
				const finalMessage = message || steps[steps.length - 1].message;
				const finalTitle = title || steps[steps.length - 1].title;

				updateToastStatus(
					toastId,
					'success',
					finalMessage,
					finalTitle,
					3000
				);
			}
		}
	};
}

/**
 * Wrapper for Supabase operations with toast integration
 * @param {Function} operation - The Supabase operation function
 * @param {Object} config - Configuration for toasts
 * @returns {Promise<any>} The operation result
 */
export async function supabaseRequest(operation, config = {}) {
	const finalConfig = {
		showToast: true,
		loadingMessage: 'Processing...',
		loadingTitle: 'Loading...',
		successMessage: 'Operation completed',
		successTitle: 'Success!',
		errorTitle: 'Database Error',
		...config
	};

	let toastId = null;

	if (finalConfig.showToast) {
		toastId = toastLoading(finalConfig.loadingMessage, finalConfig.loadingTitle);
	}

	try {
		const result = await operation();

		if (result.error) {
			throw new Error(result.error.message || 'Database operation failed');
		}

		if (finalConfig.showToast && toastId) {
			updateToastStatus(
				toastId,
				'success',
				finalConfig.successMessage,
				finalConfig.successTitle,
				3000
			);
		}

		return result;

	} catch (error) {
		if (finalConfig.showToast && toastId) {
			updateToastStatus(
				toastId,
				'error',
				error.message || 'Database operation failed',
				finalConfig.errorTitle,
				5000
			);
		}
		throw error;
	}
}

/**
 * Form submission handler with validation and toast feedback
 * @param {Function} submitFunction - The function to call for submission
 * @param {Function} validateFunction - Optional validation function
 * @param {Object} config - Configuration options
 * @returns {Function} The wrapped submit handler
 */
export function createFormSubmitHandler(submitFunction, validateFunction = null, config = {}) {
	const finalConfig = {
		showToast: true,
		loadingMessage: 'Submitting...',
		loadingTitle: 'Processing',
		successMessage: 'Form submitted successfully',
		successTitle: 'Success!',
		errorTitle: 'Submission Failed',
		...config
	};

	return async (formData) => {
		// Run validation if provided
		if (validateFunction) {
			try {
				const validationResult = validateFunction(formData);
				if (validationResult !== true) {
					toastError(validationResult, 'Validation Error', 4000);
					return { success: false, error: validationResult };
				}
			} catch (validationError) {
				toastError(validationError.message, 'Validation Error', 4000);
				return { success: false, error: validationError.message };
			}
		}

		let toastId = null;

		if (finalConfig.showToast) {
			toastId = toastLoading(finalConfig.loadingMessage, finalConfig.loadingTitle);
		}

		try {
			const result = await submitFunction(formData);

			if (finalConfig.showToast && toastId) {
				updateToastStatus(
					toastId,
					'success',
					finalConfig.successMessage,
					finalConfig.successTitle,
					3000
				);
			}

			return { success: true, data: result };

		} catch (error) {
			if (finalConfig.showToast && toastId) {
				updateToastStatus(
					toastId,
					'error',
					error.message || 'Form submission failed',
					finalConfig.errorTitle,
					5000
				);
			}

			return { success: false, error: error.message || 'Submission failed' };
		}
	};
}