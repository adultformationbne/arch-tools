<script>
	import ChatRoom from '$lib/components/ChatRoom.svelte';
	import { page } from '$app/stores';

	let { data } = $props();

	const supabase = $derived(data.supabase);
	const courseSlug = $derived($page.params.slug);
</script>

<div class="chat-page">
	<ChatRoom
		messages={data.messages}
		cohortId={data.cohortId}
		userMeta={data.userMeta}
		chatEnabled={data.chatEnabled !== false}
		{courseSlug}
		{supabase}
	/>
</div>

<style>
	.chat-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 16px;
		height: calc(100vh - 60px);
	}

	@media (max-width: 768px) {
		.chat-page {
			padding: 0;
			height: calc(100vh - 50px);
		}
	}
</style>
