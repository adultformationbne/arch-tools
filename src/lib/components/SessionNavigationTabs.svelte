<script>
	let {
		totalSessions = 8,
		selectedSession = 1,
		onSessionChange = () => {}
	} = $props();

	const selectSession = (session) => {
		if (session !== selectedSession) {
			onSessionChange(session);
		}
	};
</script>

<div class="flex gap-2 overflow-x-auto pb-2">
	{#each Array(totalSessions).fill(0) as _, i}
		<button
			onclick={() => selectSession(i + 1)}
			class="flex-shrink-0 px-6 py-3 rounded-xl font-semibold transition-all {selectedSession === i + 1 ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}"
		>
			Session {i + 1}
		</button>
	{/each}
</div>