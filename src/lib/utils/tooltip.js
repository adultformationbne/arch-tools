import { computePosition, flip, shift, offset } from '@floating-ui/dom';

/**
 * Svelte action that shows a tooltip on hover using Floating UI.
 * Uses the existing .tippy-box[data-theme~='system'] styles from tooltip.css.
 *
 * @param {HTMLElement} node
 * @param {string} content
 */
export function tooltip(node, content) {
	let el = null;

	async function position() {
		if (!el) return;
		const { x, y } = await computePosition(node, el, {
			placement: 'top',
			middleware: [offset(6), flip(), shift({ padding: 8 })]
		});
		Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
	}

	function show() {
		if (!content) return;
		el = document.createElement('div');
		el.className = 'tippy-box';
		el.setAttribute('data-theme', 'system');
		el.setAttribute('data-state', 'visible');
		el.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;padding:5px 10px;white-space:nowrap;';
		el.textContent = content;
		document.body.appendChild(el);
		position();
	}

	function hide() {
		el?.remove();
		el = null;
	}

	node.addEventListener('mouseenter', show);
	node.addEventListener('mouseleave', hide);
	node.addEventListener('focus', show);
	node.addEventListener('blur', hide);

	return {
		update(newContent) {
			content = newContent;
			if (el) el.textContent = newContent;
		},
		destroy() {
			hide();
			node.removeEventListener('mouseenter', show);
			node.removeEventListener('mouseleave', hide);
			node.removeEventListener('focus', show);
			node.removeEventListener('blur', hide);
		}
	};
}
