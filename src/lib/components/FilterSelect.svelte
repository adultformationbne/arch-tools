<script>
	import { createDropdown } from '$lib/utils/dropdown.js';
	import { ChevronDown } from '$lib/icons';

	let { value = $bindable('all'), options = [], icon: Icon = null } = $props();

	/** @type {HTMLButtonElement | null} */
	let buttonEl = $state(null);
	/** @type {HTMLDivElement | null} */
	let menuEl = $state(null);
	/** @type {{ show(): void; hide(): void; toggle(): void; destroy(): void; isOpen: boolean } | null} */
	let controller = $state(null);
	let isOpen = $state(false);

	const currentLabel = $derived(options.find(o => o.value === value)?.label ?? options[0]?.label ?? '');
	const isActive = $derived(options.length > 0 && value !== options[0].value);

	$effect(() => {
		if (buttonEl && menuEl) {
			const ctrl = createDropdown(buttonEl, menuEl, {
				placement: 'bottom-start',
				offset: 4,
				onShow: () => { isOpen = true; },
				onHide: () => { isOpen = false; }
			});
			controller = ctrl;
			return () => ctrl.destroy();
		}
	});

	function select(v) {
		value = v;
		controller?.hide();
	}
</script>

<div class="relative">
	<button
		bind:this={buttonEl}
		type="button"
		onclick={() => controller?.toggle()}
		class="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border shadow-sm transition-colors cursor-pointer {isActive ? 'text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}"
		style={isActive ? 'background-color: var(--course-accent-light); border-color: var(--course-accent-light);' : ''}
	>
		{#if Icon}
			<Icon size={13} class="flex-shrink-0 {isActive ? 'opacity-80' : 'text-gray-400'}" />
		{/if}
		{currentLabel}
		<ChevronDown size={12} class="flex-shrink-0 transition-transform {isOpen ? 'rotate-180' : ''} {isActive ? 'opacity-70' : 'text-gray-400'}" />
	</button>

	<div
		bind:this={menuEl}
		style="display: none;"
		class="bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[160px] w-max max-w-[280px]"
	>
		{#each options as opt}
			<button
				type="button"
				onclick={() => select(opt.value)}
				class="w-full text-left px-3 py-1.5 text-sm transition-colors {value === opt.value ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'}"
			>
				{opt.label}
			</button>
		{/each}
	</div>
</div>
