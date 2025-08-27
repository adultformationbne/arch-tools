import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/themes/light.css';

export function initTooltips() {
	// Helper function to create tooltips
	const createTooltip = (selector, options) => {
		const element = document.querySelector(selector);
		if (element) {
			return tippy(element, {
				allowHTML: true,
				appendTo: document.body,
				zIndex: 9999,
				...options
			});
		}
		return null;
	};

	// Initialize all tooltips
	return {
		createTooltip
	};
}
