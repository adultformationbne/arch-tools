<script>
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	// Svelte 5 syntax with runes
	let {
		currentSession = $bindable(),
		totalSessions = 8,
		availableSessions = 8,
		onSessionChange = () => {},
		children
	} = $props();

	// Derived state for tab styling
	const isSessionAvailable = (sessionNum) => sessionNum <= availableSessions;
	const isCurrentSession = (sessionNum) => sessionNum === currentSession;
	const isCompletedSession = (sessionNum) => sessionNum < currentSession;

	const handleSessionClick = (sessionNum) => {
		if (isSessionAvailable(sessionNum)) {
			currentSession = sessionNum;
			onSessionChange(sessionNum);
		}
	};

	// Navigation helpers
	const canGoPrevious = $derived(currentSession > 1);
	const canGoNext = $derived(currentSession < availableSessions);

	const goToPrevious = () => {
		if (canGoPrevious) {
			handleSessionClick(currentSession - 1);
		}
	};

	const goToNext = () => {
		if (canGoNext) {
			handleSessionClick(currentSession + 1);
		}
	};
</script>

<div class="flex min-h-[600px]">
		<!-- Session Navigation Tabs -->
		<div class="flex flex-col rounded-l-3xl overflow-hidden min-h-full">
			{#each Array.from({ length: totalSessions }, (_, i) => i + 1) as sessionNum}
				<button
					class="w-20 flex-1 flex items-center justify-center text-2xl font-bold cursor-pointer transition-colors duration-200"
					class:current={isCurrentSession(sessionNum)}
					class:completed={isCompletedSession(sessionNum)}
					class:available={isSessionAvailable(sessionNum) && !isCurrentSession(sessionNum) && !isCompletedSession(sessionNum)}
					class:locked={!isSessionAvailable(sessionNum)}
					onclick={() => handleSessionClick(sessionNum)}
					disabled={!isSessionAvailable(sessionNum)}
				>
					{sessionNum}
				</button>
			{/each}
		</div>

		<!-- Main Content Area -->
		<div class="flex-1 rounded-r-3xl" style="background-color: #eae2d9;">
			{@render children()}
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

	/* Current session - matches central area */
	button.current {
		background-color: #eae2d9;
		color: #1e2322;
		box-shadow: inset 2px 0 4px rgba(0, 0, 0, 0.1);
		z-index: 2;
	}

	/* Completed sessions - darker brown */
	button.completed {
		background-color: #c59a6b;
		color: #1e2322;
		box-shadow: inset 1px 0 2px rgba(0, 0, 0, 0.2);
	}
	button.completed:hover {
		background-color: #d4a574;
	}

	/* Available sessions - medium brown */
	button.available {
		background-color: #d4a574;
		color: #2c3938;
		box-shadow: inset 1px 0 2px rgba(0, 0, 0, 0.15);
	}
	button.available:hover {
		background-color: #c59a6b;
	}

	/* Locked sessions - lightest brown and disabled */
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