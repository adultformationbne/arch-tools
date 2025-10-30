<script>
	import { invalidate } from '$app/navigation';
	import AppNavigation from '$lib/components/AppNavigation.svelte';

let { data, children } = $props();

	let supabase = $derived(data.supabase);
	let session = $derived(data.session);
	let userRole = $derived(data.userRole);

	$effect(() => {
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		return () => subscription.unsubscribe();
	});
</script>

<div class="min-h-screen bg-gray-50 flex flex-col">
	{#if session}
		<AppNavigation {session} {userRole} />
	{/if}
	<main class="flex-1">
		{@render children()}
	</main>
</div>
