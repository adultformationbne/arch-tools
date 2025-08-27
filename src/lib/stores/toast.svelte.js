// Toast store using Svelte 5 runes
let toastId = 0;

// Default durations in milliseconds
export const DURATIONS = {
	short: 3000,
	medium: 5000,
	long: 8000,
	infinite: -1
};

// Toast types for styling
export const TYPES = {
	success: 'success',
	error: 'error',
	warning: 'warning',
	info: 'info',
	loading: 'loading'
};

class ToastStore {
	toasts = $state([]);

	add(options) {
		const id = ++toastId;
		const toast = {
			id,
			type: options.type || TYPES.info,
			title: options.title || '',
			message: options.message || '',
			duration: options.duration !== undefined ? options.duration : DURATIONS.medium,
			closeable: options.closeable !== false,
			steps: options.steps || null,
			currentStep: 0,
			totalSteps: options.steps ? options.steps.length : 0,
			onClose: options.onClose || null,
			timestamp: Date.now()
		};

		this.toasts = [...this.toasts, toast];

		// Auto-dismiss if duration is set
		if (toast.duration > 0) {
			setTimeout(() => {
				this.dismiss(id);
			}, toast.duration);
		}

		return id;
	}

	dismiss(id) {
		const toast = this.toasts.find((t) => t.id === id);
		if (toast?.onClose) {
			toast.onClose();
		}
		this.toasts = this.toasts.filter((t) => t.id !== id);
	}

	clear() {
		this.toasts = [];
	}

	updateStep(id, stepIndex) {
		this.toasts = this.toasts.map((toast) => {
			if (toast.id === id && toast.steps) {
				const step = toast.steps[stepIndex];
				return {
					...toast,
					currentStep: Math.min(stepIndex, toast.totalSteps - 1),
					title: step?.title || toast.title,
					message: step?.message || toast.message,
					type: step?.type || toast.type
				};
			}
			return toast;
		});
	}

	nextStep(id) {
		const toast = this.toasts.find((t) => t.id === id);
		if (toast?.steps && toast.currentStep < toast.totalSteps - 1) {
			this.updateStep(id, toast.currentStep + 1);
		}
	}

	updateToast(id, updates) {
		this.toasts = this.toasts.map((toast) => {
			if (toast.id === id) {
				return { ...toast, ...updates };
			}
			return toast;
		});
	}

	// Convenience methods
	success(options) {
		return this.add({ ...options, type: TYPES.success });
	}

	error(options) {
		return this.add({ ...options, type: TYPES.error });
	}

	warning(options) {
		return this.add({ ...options, type: TYPES.warning });
	}

	info(options) {
		return this.add({ ...options, type: TYPES.info });
	}

	loading(options) {
		return this.add({ ...options, type: TYPES.loading, duration: DURATIONS.infinite });
	}

	multiStep(options) {
		const firstStep = options.steps?.[0];
		return this.add({
			...options,
			steps: options.steps,
			title: firstStep?.title || options.title,
			message: firstStep?.message || options.message,
			type: firstStep?.type || options.type || TYPES.info,
			duration: options.duration || DURATIONS.infinite
		});
	}
}

export const toast = new ToastStore();
