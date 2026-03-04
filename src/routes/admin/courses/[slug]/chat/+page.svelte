<script>
	import ChatRoom from '$lib/components/ChatRoom.svelte';
	import { MessageCircle } from '$lib/icons';
	import { page } from '$app/stores';

	let { data } = $props();

	const supabase = $derived(data.supabase);
	const courseSlug = $derived($page.params.slug);
</script>

{#if data.noCohortSelected}
	<div class="empty-state">
		<MessageCircle size="40" class="text-white/20" />
		<p class="text-white/50 mt-3 text-sm">Select a cohort to view chat</p>
		<p class="text-white/30 text-xs mt-1">Use the sidebar to choose a cohort</p>
	</div>
{:else if data.cohortId && data.userMeta}
	{#key data.cohortId}
		<div class="chat-page">
			<ChatRoom
				messages={data.messages}
				cohortId={data.cohortId}
				userMeta={data.userMeta}
				{courseSlug}
				{supabase}
			/>
		</div>
	{/key}
{/if}

<style>
	.chat-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 16px;
		height: calc(100vh - 16px);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60vh;
	}

	@media (max-width: 1024px) {
		.chat-page {
			padding: 0;
			height: calc(100vh - 52px);
		}
	}
</style>
