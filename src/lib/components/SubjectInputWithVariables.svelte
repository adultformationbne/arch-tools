<script>
	import { ChevronDown } from '$lib/icons';
	import { createDropdown } from '$lib/utils/dropdown.js';
	import { onDestroy } from 'svelte';

	let {
		value = $bindable(''),
		placeholder = 'Enter subject...',
		availableVariables = [],
		onchange = () => {},
		class: className = ''
	} = $props();

	let inputEl = $state(null);
	let varButtonEl = $state(null);
	let varMenuEl = $state(null);
	let dropdown = $state(null);

	// Initialize dropdown when elements are ready
	$effect(() => {
		if (varButtonEl && varMenuEl && !dropdown) {
			dropdown = createDropdown(varButtonEl, varMenuEl, {
				placement: 'bottom-end',
				offset: 4
			});
		}
	});

	onDestroy(() => {
		if (dropdown) dropdown.destroy();
	});

	function insertVariable(variableName) {
		if (!inputEl) return;

		const start = inputEl.selectionStart || 0;
		const end = inputEl.selectionEnd || 0;
		const varText = `{{${variableName}}}`;

		// Insert at cursor position
		value = value.substring(0, start) + varText + value.substring(end);
		onchange(value);

		// Close dropdown
		if (dropdown) dropdown.hide();

		// Restore focus and set cursor after inserted variable
		setTimeout(() => {
			inputEl.focus();
			const newPos = start + varText.length;
			inputEl.setSelectionRange(newPos, newPos);
		}, 0);
	}

	function handleInput(e) {
		value = e.target.value;
		onchange(value);
	}
</script>

<div class="relative {className}">
	<input
		type="text"
		bind:this={inputEl}
		{value}
		oninput={handleInput}
		{placeholder}
		class="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg text-sm"
	/>

	{#if availableVariables.length > 0}
		<!-- Variable Insert Button -->
		<button
			type="button"
			bind:this={varButtonEl}
			onclick={() => dropdown?.toggle()}
			class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
		>
			<span class="font-mono text-[10px]">{'{}'}</span>
			<ChevronDown size={10} />
		</button>

		<!-- Variable Dropdown Menu (NO hidden class - controlled by dropdown.js) -->
		<div
			bind:this={varMenuEl}
			style="display: none;"
			class="w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1 max-h-64 overflow-y-auto"
		>
			{#each availableVariables as variable}
				<button
					type="button"
					onclick={() => insertVariable(variable.name)}
					class="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-xs"
				>
					<span class="font-medium text-gray-900 font-mono">{variable.name}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
