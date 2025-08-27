<script>
	import { onMount } from 'svelte';
	import tippy from 'tippy.js';
	import 'tippy.js/dist/tippy.css';
	import 'tippy.js/themes/light.css';
	import { HelpCircle, Info } from 'lucide-svelte';

	let {
		content = '',
		placement = 'top',
		theme = 'light',
		trigger = 'mouseenter focus',
		interactive = false,
		allowHTML = true,
		maxWidth = 350,
		delay = [100, 50],
		duration = [200, 150],
		offset = [0, 8],
		arrow = true,
		appendTo = () => document.body, // Always append to body for proper positioning
		mode = 'hover', // 'hover', 'always', or 'icon'
		icon = 'help', // 'help' or 'info'
		iconSize = 'w-4 h-4',
		iconClass = '',
		anchorSelector = '', // CSS selector to anchor the tooltip to
		alwaysVisibleClass = 'bg-blue-50 text-blue-700 border border-blue-200 px-3 py-2 rounded-lg text-sm',
		children
	} = $props();

	let triggerElement;
	let tippyInstance;

	onMount(() => {
		if (mode === 'always') {
			// Always visible mode - position absolutely over anchor element
			if (anchorSelector) {
				const anchorElement = document.querySelector(anchorSelector);
				if (anchorElement && triggerElement) {
					// Position the always-visible tooltip over the anchor element
					const rect = anchorElement.getBoundingClientRect();
					triggerElement.style.position = 'fixed';
					triggerElement.style.top = `${rect.top - 10}px`; // Slightly above
					triggerElement.style.left = `${rect.right + 10}px`; // To the right
					triggerElement.style.zIndex = '9999';
				}
			}
			return;
		}

		// For anchored tooltips, find the target element
		const targetElement = anchorSelector ? document.querySelector(anchorSelector) : triggerElement;

		if (!targetElement) return;

		// Initialize Tippy on the target element
		tippyInstance = tippy(targetElement, {
			content,
			placement,
			theme,
			trigger,
			interactive,
			allowHTML,
			maxWidth,
			delay,
			duration,
			offset,
			arrow,
			appendTo,
			zIndex: 9999,
			popperOptions: {
				strategy: 'fixed', // Helps with container constraints
				modifiers: [
					{
						name: 'preventOverflow',
						options: {
							boundary: document.body,
							rootBoundary: 'viewport'
						}
					},
					{
						name: 'flip',
						options: {
							fallbackPlacements: ['top', 'bottom', 'left', 'right']
						}
					}
				]
			}
		});

		return () => {
			if (tippyInstance) {
				tippyInstance.destroy();
			}
		};
	});

	// Update content dynamically
	$effect(() => {
		if (tippyInstance && content) {
			tippyInstance.setContent(content);
		}
	});
</script>

{#if mode === 'always'}
	<!-- Always visible tooltip -->
	<div class={`inline-flex items-center gap-2 ${alwaysVisibleClass}`}>
		{#if icon === 'help'}
			<HelpCircle class={iconSize} />
		{:else if icon === 'info'}
			<Info class={iconSize} />
		{/if}
		<span>{@html content}</span>
	</div>
{:else if mode === 'icon'}
	<!-- Icon trigger mode -->
	<button
		bind:this={triggerElement}
		type="button"
		class={`inline-flex items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none ${iconClass}`}
		aria-label="Help"
	>
		{#if icon === 'help'}
			<HelpCircle class={`${iconSize} text-gray-400 hover:text-gray-600`} />
		{:else if icon === 'info'}
			<Info class={`${iconSize} text-gray-400 hover:text-gray-600`} />
		{/if}
	</button>
{:else}
	<!-- Hover mode - wraps children -->
	<span bind:this={triggerElement} class="inline-block">
		{@render children?.()}
	</span>
{/if}
