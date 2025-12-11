<script>
	import { DAY_NAMES, getOrdinalSuffix } from '$lib/utils/dgr-helpers';

	let {
		patternType = $bindable(null),
		patternValues = $bindable([]),
		mode = 'multi'
	} = $props();

	function toggleValue(value) {
		if (mode === 'single') {
			patternValues = [value];
		} else {
			const idx = patternValues.indexOf(value);
			if (idx === -1) {
				patternValues = [...patternValues, value].sort((a, b) => a - b);
			} else {
				patternValues = patternValues.filter(v => v !== value);
			}
		}
	}

	function handlePatternTypeChange() {
		patternValues = [];
	}
</script>

<div>
	<label for="pattern-type" class="mb-1 block text-sm font-medium text-gray-700">
		Schedule Pattern
	</label>
	<select
		id="pattern-type"
		bind:value={patternType}
		onchange={handlePatternTypeChange}
		class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
	>
		<option value={null}>Manual assignment only</option>
		<option value="day_of_month">Day of Month</option>
		<option value="day_of_week">Day of Week</option>
	</select>

	{#if patternType === 'day_of_month'}
		<div class="mt-3">
			<p class="mb-2 text-sm text-gray-600">Select day{mode === 'multi' ? '(s)' : ''} of month:</p>
			<div class="grid grid-cols-7 gap-1">
				{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
					<button
						type="button"
						onclick={() => toggleValue(day)}
						class="h-9 w-full rounded text-sm font-medium transition-colors {patternValues.includes(day)
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						{day}
					</button>
				{/each}
			</div>
			{#if patternValues.length > 0}
				<p class="mt-2 text-sm text-blue-600">
					Selected: {patternValues.map(v => `${v}${getOrdinalSuffix(v)}`).join(', ')}
				</p>
			{/if}
		</div>
	{:else if patternType === 'day_of_week'}
		<div class="mt-3">
			<p class="mb-2 text-sm text-gray-600">Select day{mode === 'multi' ? '(s)' : ''} of week:</p>
			<div class="flex flex-wrap gap-2">
				{#each DAY_NAMES as day, index}
					<button
						type="button"
						onclick={() => toggleValue(index)}
						class="rounded-full px-4 py-2 text-sm font-medium transition-colors {patternValues.includes(index)
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						{day}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<p class="mt-2 text-xs text-gray-500">
		Set a recurring schedule pattern, or leave as manual for ad-hoc assignments
	</p>
</div>
