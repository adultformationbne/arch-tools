<script>
	import '../app.css';
	import '$lib/styles/tooltip.css';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import NavigationLoader from '$lib/components/NavigationLoader.svelte';
	import PageTransition from '$lib/components/PageTransition.svelte';
	import AppNavigation from '$lib/components/AppNavigation.svelte';
	import AppFooter from '$lib/components/AppFooter.svelte';

	export let data;

	$: ({ supabase, session, userModules = [], userProfile } = data);

	// Routes where we don't show the navigation and footer
	$: hideNav = $page.url.pathname === '/login' ||
	             $page.url.pathname === '/login/setup-password';

	// Only show main nav if user has modules beyond just courses.participant
	// (since courses.participant users can access everything they need via the course sub-nav)
	$: hasOtherModules = userModules.length > 0 &&
	                     !(userModules.length === 1 && userModules[0] === 'courses.participant');

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

<!-- Global navigation loading indicator -->
<NavigationLoader />

<!-- Optional: Uncomment to enable skeleton loading screen during page transitions -->
<!-- <PageTransition /> -->

<div class="min-h-screen bg-gray-50 flex flex-col">
	{#if session && !hideNav && hasOtherModules}
		<AppNavigation {session} modules={userModules} {userProfile} />
	{/if}
	<main class="flex-1">
		<slot />
	</main>
	{#if !hideNav}
		<AppFooter />
	{/if}
</div>

<ToastContainer />
