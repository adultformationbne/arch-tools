import { toastLoading, toastError, updateToastStatus } from './toast-helpers.js';

const DEFAULT_CONFIG = {
	showToast: true,
	loadingMessage: 'Processing...',
	loadingTitle: 'Loading...',
	successMessage: 'Operation completed successfully',
	successTitle: 'Success!',
	errorTitle: 'Operation Failed',
	timeout: 30000
};

export class ApiError extends Error {
	constructor(message, status, response) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.response = response;
	}
}

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

/** Main API request handler with toast integration */
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
			signal: controller.signal,
			credentials: 'include' // Send cookies for auth
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

export async function apiGet(url, config = {}) {
	return apiRequest(url, { method: 'GET' }, config);
}

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

export async function apiPatch(url, data, config = {}) {
	return apiRequest(
		url,
		{
			method: 'PATCH',
			body: JSON.stringify(data)
		},
		{
			loadingMessage: 'Processing...',
			successMessage: 'Operation completed',
			...config
		}
	);
}

export async function apiDelete(url, data = null, config = {}) {
	const options = { method: 'DELETE' };

	if (data) {
		options.body = JSON.stringify(data);
	}

	return apiRequest(
		url,
		options,
		{
			loadingMessage: 'Deleting...',
			successMessage: 'Deleted successfully',
			...config
		}
	);
}

/** Wrapper for Supabase operations with toast integration */
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

/** Form submission handler with validation and toast feedback */
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