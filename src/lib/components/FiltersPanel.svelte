<script>
	import { createDropdown } from '$lib/utils/dropdown.js';
	import { Filter, ChevronDown } from '$lib/icons';

	let {
		filterSession = $bindable('all'),
		filterAttendance = $bindable('all'),
		filterReflections = $bindable('all'),
		sessionOptions = [],
		attendanceOptions = [],
		reflectionOptions = []
	} = $props();

	/** @type {HTMLButtonElement | null} */
	let buttonEl = $state(null);
	/** @type {HTMLDivElement | null} */
	let menuEl = $state(null);
	/** @type {{ show(): void; hide(): void; toggle(): void; destroy(): void; isOpen: boolean } | null} */
	let controller = $state(null);
	let isOpen = $state(false);

	const activeCount = $derived(
		(filterSession !== 'all' ? 1 : 0) +
		(filterAttendance !== 'all' ? 1 : 0) +
		(filterReflections !== 'all' ? 1 : 0)
	);

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

	function clearAll() {
		filterSession = 'all';
		filterAttendance = 'all';
		filterReflections = 'all';
	}
</script>

<div class="relative">
	<button
		bind:this={buttonEl}
		type="button"
		onclick={() => controller?.toggle()}
		class="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg border shadow-sm transition-colors cursor-pointer {activeCount > 0 ? 'text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}"
		style={activeCount > 0 ? 'background-color: var(--course-accent-light); border-color: var(--course-accent-light);' : ''}
	>
		<Filter size={13} class="flex-shrink-0 {activeCount > 0 ? 'opacity-80' : 'text-gray-400'}" />
		Filters
		{#if activeCount > 0}
			<span class="flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-[10px] font-bold leading-none flex-shrink-0">{activeCount}</span>
		{/if}
		<ChevronDown size={12} class="flex-shrink-0 transition-transform {isOpen ? 'rotate-180' : ''} {activeCount > 0 ? 'opacity-70' : 'text-gray-400'}" />
	</button>

	<div
		bind:this={menuEl}
		style="display: none;"
		class="bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-[280px]"
	>
		<div class="mb-4">
			<p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Session Progress</p>
			<div class="flex flex-wrap gap-1.5">
				{#each sessionOptions as opt}
					<button
						type="button"
						onclick={() => { filterSession = opt.value; }}
						class="px-2.5 py-1 text-xs rounded-full border transition-colors {filterSession === opt.value ? 'text-white' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}"
						style={filterSession === opt.value ? 'background-color: var(--course-accent-light); border-color: var(--course-accent-light);' : ''}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="mb-4">
			<p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Attendance</p>
			<div class="flex flex-wrap gap-1.5">
				{#each attendanceOptions as opt}
					<button
						type="button"
						onclick={() => { filterAttendance = opt.value; }}
						class="px-2.5 py-1 text-xs rounded-full border transition-colors {filterAttendance === opt.value ? 'text-white' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}"
						style={filterAttendance === opt.value ? 'background-color: var(--course-accent-light); border-color: var(--course-accent-light);' : ''}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="mb-3">
			<p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Reflections</p>
			<div class="flex flex-wrap gap-1.5">
				{#each reflectionOptions as opt}
					<button
						type="button"
						onclick={() => { filterReflections = opt.value; }}
						class="px-2.5 py-1 text-xs rounded-full border transition-colors {filterReflections === opt.value ? 'text-white' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}"
						style={filterReflections === opt.value ? 'background-color: var(--course-accent-light); border-color: var(--course-accent-light);' : ''}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		{#if activeCount > 0}
			<div class="border-t border-gray-100 pt-3">
				<button
					type="button"
					onclick={clearAll}
					class="text-xs text-gray-500 hover:text-gray-800 transition-colors"
				>
					Clear filters
				</button>
			</div>
		{/if}
	</div>
</div>
