<script>
	import { MessageCircle } from '$lib/icons';

	let {
		totalSessions = 8,
		selectedSession = 0,
		sessionReflectionsEnabled = {}, // Object mapping session number to enabled status
		onSessionChange = () => {}
	} = $props();

	const selectSession = (session) => {
		if (session !== selectedSession) {
			onSessionChange(session);
		}
	};

	// Check if reflections are enabled for a session (defaults to true)
	const hasReflections = (sessionNum) => {
		return sessionReflectionsEnabled[sessionNum] ?? true;
	};
</script>

<div class="flex gap-2 overflow-x-auto pb-2">
	<!-- Pre-Start button -->
	<button
		onclick={() => selectSession(0)}
		class="flex-shrink-0 px-6 py-3 rounded-xl font-semibold transition-all {selectedSession === 0 ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}"
	>
		Pre-Start
	</button>

	<!-- Regular sessions 1-8 -->
	{#each Array(totalSessions).fill(0) as _, i}
		{@const sessionNum = i + 1}
		{@const hasReflection = hasReflections(sessionNum)}
		<button
			onclick={() => selectSession(sessionNum)}
			class="relative flex-shrink-0 px-6 py-3 rounded-xl font-semibold transition-all {selectedSession === sessionNum ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}"
		>
			<span class="flex items-center gap-1.5">
				Session {sessionNum}
				{#if hasReflection}
					<MessageCircle
						size="14"
						class={selectedSession === sessionNum ? 'text-blue-600' : 'text-blue-300'}
					/>
				{/if}
			</span>
		</button>
	{/each}
</div>