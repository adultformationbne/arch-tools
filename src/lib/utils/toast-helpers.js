import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';

/**
 * Display a success toast notification
 * @param {string} message - The message to display
 * @param {string} [title='Success'] - The title of the toast
 * @param {number} [duration=3000] - Duration in milliseconds
 * @returns {number} The toast ID for reference
 */
export function toastSuccess(message, title = 'Success', duration = DURATIONS.short) {
	return toast.success({
		title,
		message,
		duration
	});
}

/**
 * Display an error toast notification
 * @param {Error|string} error - The error object or message
 * @param {string} [title='Error'] - The title of the toast
 * @param {number} [duration=5000] - Duration in milliseconds
 * @returns {number} The toast ID for reference
 */
export function toastError(error, title = 'Error', duration = DURATIONS.medium) {
	const message = error instanceof Error ? error.message : error;
	return toast.error({
		title,
		message,
		duration
	});
}

/**
 * Display a warning toast notification
 * @param {string} message - The message to display
 * @param {string} [title='Warning'] - The title of the toast
 * @param {number} [duration=4000] - Duration in milliseconds
 * @returns {number} The toast ID for reference
 */
export function toastWarning(message, title = 'Warning', duration = 4000) {
	return toast.warning({
		title,
		message,
		duration
	});
}

/**
 * Display a loading toast notification (infinite duration by default)
 * @param {string} message - The message to display
 * @param {string} [title='Loading...'] - The title of the toast
 * @returns {number} The toast ID for reference (important for updating)
 */
export function toastLoading(message, title = 'Loading...') {
	return toast.loading({
		title,
		message
	});
}

/**
 * Display an info toast notification
 * @param {string} message - The message to display
 * @param {string} [title='Info'] - The title of the toast
 * @param {number} [duration=5000] - Duration in milliseconds
 * @returns {number} The toast ID for reference
 */
export function toastInfo(message, title = 'Info', duration = DURATIONS.medium) {
	return toast.info({
		title,
		message,
		duration
	});
}

/**
 * Update an existing toast's status and content
 * @param {number} toastId - The ID of the toast to update
 * @param {string} status - The new status type ('success', 'error', 'warning', 'info')
 * @param {string} message - The new message
 * @param {string} [title] - The new title (optional)
 * @param {number} [duration] - Duration for auto-dismiss (optional)
 */
export function updateToastStatus(toastId, status, message, title = null, duration = null) {
	const updates = {
		type: status,
		message
	};

	if (title !== null) {
		updates.title = title;
	}

	if (duration !== null) {
		updates.duration = duration;
	}

	toast.updateToast(toastId, updates);
}

/**
 * Create a multi-step toast for complex workflows
 * @param {Array} steps - Array of step objects with title, message, and type
 * @param {boolean} [closeable=false] - Whether the toast can be manually closed
 * @returns {number} The toast ID for reference
 */
export function toastMultiStep(steps, closeable = false) {
	return toast.multiStep({
		steps,
		closeable
	});
}

/**
 * Progress to the next step in a multi-step toast
 * @param {number} toastId - The ID of the multi-step toast
 */
export function toastNextStep(toastId) {
	toast.nextStep(toastId);
}

/**
 * Dismiss a specific toast
 * @param {number} toastId - The ID of the toast to dismiss
 */
export function dismissToast(toastId) {
	toast.dismiss(toastId);
}

/**
 * Clear all toasts
 */
export function clearToasts() {
	toast.clear();
}

/**
 * Helper for common validation errors
 * @param {string} field - The field that failed validation
 * @param {string} requirement - The requirement that wasn't met
 */
export function toastValidationError(field, requirement) {
	return toast.error({
		title: 'Validation Error',
		message: `${field} ${requirement}`,
		duration: 4000
	});
}

/**
 * Helper for form submission workflows
 * @returns {Object} Object with methods for handling form submission states
 */
export function createFormToastHandler() {
	let currentToastId = null;

	return {
		start(message = 'Processing...', title = 'Submitting') {
			currentToastId = toastLoading(message, title);
			return currentToastId;
		},

		success(message = 'Operation completed successfully', title = 'Success!') {
			if (currentToastId) {
				updateToastStatus(currentToastId, 'success', message, title, DURATIONS.short);
			} else {
				toastSuccess(message, title);
			}
		},

		error(error, title = 'Operation Failed') {
			const message = error instanceof Error ? error.message : error;
			if (currentToastId) {
				updateToastStatus(currentToastId, 'error', message, title, DURATIONS.medium);
			} else {
				toastError(message, title);
			}
		},

		reset() {
			currentToastId = null;
		}
	};
}