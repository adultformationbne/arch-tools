/**
 * Dropdown Positioning Utility using Floating UI
 *
 * Solves the common problem of dropdowns being clipped by overflow:hidden containers.
 * Uses fixed positioning and auto-updates on scroll/resize to keep dropdown anchored.
 *
 * @example
 * import { createDropdown } from '$lib/utils/dropdown.js';
 *
 * const dropdown = createDropdown(buttonElement, menuElement, {
 *   placement: 'bottom-end',
 *   offset: 8,
 *   onShow: () => console.log('opened'),
 *   onHide: () => console.log('closed')
 * });
 *
 * // Later...
 * dropdown.destroy();
 */

import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom';

/**
 * Creates a dropdown menu that breaks out of clipping containers
 *
 * @param {HTMLElement} referenceElement - The button/trigger element
 * @param {HTMLElement} floatingElement - The dropdown menu element
 * @param {Object} options - Configuration options
 * @param {string} [options.placement='bottom-start'] - Preferred placement
 * @param {number} [options.offset=4] - Gap between trigger and menu (px)
 * @param {number} [options.padding=8] - Minimum distance from viewport edge (px)
 * @param {boolean} [options.autoClose=true] - Close on click outside
 * @param {boolean} [options.closeOnEscape=true] - Close on Escape key
 * @param {Function} [options.onShow] - Callback when dropdown opens
 * @param {Function} [options.onHide] - Callback when dropdown closes
 * @returns {Object} Dropdown controller with show(), hide(), toggle(), destroy()
 */
export function createDropdown(referenceElement, floatingElement, options = {}) {
	const {
		placement = 'bottom-start',
		offset: offsetValue = 4,
		padding = 8,
		autoClose = true,
		closeOnEscape = true,
		onShow,
		onHide
	} = options;

	let cleanupAutoUpdate = null;
	let isOpen = false;

	// Set up required CSS (position only - let component control width via classes)
	Object.assign(floatingElement.style, {
		position: 'fixed',
		top: '0',
		left: '0',
		zIndex: '50'
	});

	/**
	 * Update dropdown position
	 */
	async function updatePosition() {
		const { x, y } = await computePosition(referenceElement, floatingElement, {
			placement,
			strategy: 'fixed', // This breaks out of clipping containers!
			middleware: [
				offset(offsetValue), // Gap between trigger and menu
				flip(), // Flip to opposite side if clipped
				shift({ padding }) // Shift to stay visible within viewport
			]
		});

		Object.assign(floatingElement.style, {
			left: `${x}px`,
			top: `${y}px`
		});
	}

	/**
	 * Show the dropdown
	 */
	function show() {
		if (isOpen) return;

		isOpen = true;
		floatingElement.style.display = 'block';

		// Start auto-updating position on scroll/resize
		cleanupAutoUpdate = autoUpdate(referenceElement, floatingElement, updatePosition);

		// Call onShow callback
		if (onShow) onShow();

		// Set up auto-close handlers
		if (autoClose) {
			// Close on click outside (next tick to avoid immediate close)
			setTimeout(() => {
				document.addEventListener('click', handleClickOutside);
			}, 0);
		}

		if (closeOnEscape) {
			document.addEventListener('keydown', handleEscape);
		}
	}

	/**
	 * Hide the dropdown
	 */
	function hide() {
		if (!isOpen) return;

		isOpen = false;
		floatingElement.style.display = 'none';

		// Stop auto-updating
		if (cleanupAutoUpdate) {
			cleanupAutoUpdate();
			cleanupAutoUpdate = null;
		}

		// Remove event listeners
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleEscape);

		// Call onHide callback
		if (onHide) onHide();
	}

	/**
	 * Toggle dropdown visibility
	 */
	function toggle() {
		if (isOpen) {
			hide();
		} else {
			show();
		}
	}

	/**
	 * Handle click outside to close
	 */
	function handleClickOutside(event) {
		if (
			!referenceElement.contains(event.target) &&
			!floatingElement.contains(event.target)
		) {
			hide();
		}
	}

	/**
	 * Handle Escape key to close
	 */
	function handleEscape(event) {
		if (event.key === 'Escape') {
			hide();
		}
	}

	/**
	 * Cleanup all event listeners and watchers
	 */
	function destroy() {
		hide();
		// Remove any lingering listeners
		document.removeEventListener('click', handleClickOutside);
		document.removeEventListener('keydown', handleEscape);
	}

	// Return controller
	return {
		show,
		hide,
		toggle,
		destroy,
		get isOpen() {
			return isOpen;
		}
	};
}

