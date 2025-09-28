<script>
	// Svelte 5 syntax with runes
	let {
		currentWeek = $bindable(),
		totalWeeks = 8,
		availableWeeks = 8,
		onWeekChange = () => {}
	} = $props();

	// Derived state for tab styling
	const isWeekAvailable = (weekNum) => weekNum <= availableWeeks;
	const isCurrentWeek = (weekNum) => weekNum === currentWeek;
	const isCompletedWeek = (weekNum) => weekNum < currentWeek;

	const handleWeekClick = (weekNum) => {
		if (isWeekAvailable(weekNum)) {
			currentWeek = weekNum;
			onWeekChange(weekNum);
		}
	};
</script>

<div class="flex min-h-[600px]">
	<!-- Week Navigation Tabs -->
	<div class="flex flex-col rounded-l-3xl overflow-hidden min-h-full">
		{#each Array.from({ length: totalWeeks }, (_, i) => i + 1) as weekNum}
			<button
				class="w-20 flex-1 flex items-center justify-center text-2xl font-bold cursor-pointer transition-colors duration-200"
				class:current={isCurrentWeek(weekNum)}
				class:completed={isCompletedWeek(weekNum)}
				class:available={isWeekAvailable(weekNum) && !isCurrentWeek(weekNum) && !isCompletedWeek(weekNum)}
				class:locked={!isWeekAvailable(weekNum)}
				on:click={() => handleWeekClick(weekNum)}
				disabled={!isWeekAvailable(weekNum)}
			>
				{weekNum}
			</button>
		{/each}
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 rounded-r-3xl" style="background-color: #eae2d9;">
		<slot />
	</div>
</div>

<style>
	button {
		position: relative;
		border-bottom: 1px solid rgba(0, 0, 0, 0.1);
	}

	button:last-child {
		border-bottom: none;
	}

	/* Current week - matches central area */
	button.current {
		background-color: #eae2d9;
		color: #1e2322;
		box-shadow: inset 2px 0 4px rgba(0, 0, 0, 0.1);
		z-index: 2;
	}

	/* Completed weeks - darker brown */
	button.completed {
		background-color: #c59a6b;
		color: #1e2322;
		box-shadow: inset 1px 0 2px rgba(0, 0, 0, 0.2);
	}
	button.completed:hover {
		background-color: #d4a574;
	}

	/* Available weeks - medium brown */
	button.available {
		background-color: #d4a574;
		color: #2c3938;
		box-shadow: inset 1px 0 2px rgba(0, 0, 0, 0.15);
	}
	button.available:hover {
		background-color: #c59a6b;
	}

	/* Locked weeks - lightest brown and disabled */
	button.locked {
		background-color: #e8d5c4;
		color: #999;
		cursor: not-allowed;
		opacity: 0.7;
		box-shadow: inset 1px 0 2px rgba(0, 0, 0, 0.1);
	}

	/* Book tab effect - subtle drop shadows */
	button:not(.current) {
		box-shadow:
			inset 1px 0 2px rgba(0, 0, 0, 0.15),
			0 2px 4px rgba(0, 0, 0, 0.1);
	}

	/* Remove any transform effects - keep it flat like book tabs */
	button:hover {
		box-shadow:
			inset 1px 0 3px rgba(0, 0, 0, 0.2),
			0 2px 6px rgba(0, 0, 0, 0.15);
	}
</style>