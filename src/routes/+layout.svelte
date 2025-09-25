<script>
	import '../app.css';
	import '$lib/styles/tooltip.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import AppNavigation from '$lib/components/AppNavigation.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	export let data;

	$: ({ supabase, session } = data);

	onMount(() => {
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

<div class="min-h-screen bg-gray-100 flex flex-col">
	{#if session}
		<AppNavigation {session} />
	{/if}
	<main class="flex-1">
		<slot />
	</main>
	{#if session}
		<footer class="bg-white border-t border-gray-200 py-4">
			<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div class="flex justify-center items-center text-sm text-gray-500">
					<span>© 2025 Archdiocese of Brisbane</span>
					<span class="mx-2">•</span>
					<a href="/data-policy" class="hover:text-gray-700 transition-colors">Data Policy</a>
				</div>
			</div>
		</footer>
	{/if}
</div>

<ToastContainer />
