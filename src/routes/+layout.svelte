<script>
	import '../app.css';
	import '$lib/styles/tooltip.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import AppNavigation from '$lib/components/AppNavigation.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';

	export let data;

	$: ({ supabase, session, userModules = [] } = data);

	// Routes where we don't show the navigation and footer
	$: hideNav = $page.url.pathname === '/auth' ||
	             $page.url.pathname === '/login' ||
	             $page.url.pathname === '/auth/setup-password';

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

<div class="min-h-screen bg-gray-50 flex flex-col">
	{#if session && !hideNav}
		<AppNavigation {session} modules={userModules} />
	{/if}
	<main class="flex-1">
		<slot />
	</main>
	{#if !hideNav}
		<AppFooter />
	{/if}
</div>

<ToastContainer />
