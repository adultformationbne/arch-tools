<script>
import DGRNavigation from '$lib/components/DGRNavigation.svelte';
import { page } from '$app/stores';

let { children } = $props();

	// Check if this is the public write page (no admin nav needed)
	let isPublicWritePage = $derived($page.url.pathname.startsWith('/dgr/write/'));

	// Determine active section and subsection based on current route
	let activeSection = $derived.by(() => {
		const path = $page.url.pathname;
		if (path === '/dgr' || path === '/dgr/schedule') return 'schedule';
		if (path === '/dgr/submissions') return 'schedule';
		if (path === '/dgr/contributors') return 'people';
		if (path === '/dgr/rules') return 'people';
		if (path.includes('/dgr/liturgical-calendar')) return 'content';
		if (path.includes('/dgr/templates')) return 'content';
		if (path === '/dgr/promo') return 'content';
		if (path.includes('/dgr/publish')) return 'publish';
		return 'schedule';
	});

	let activeSubSection = $derived.by(() => {
		const path = $page.url.pathname;
		if (path === '/dgr' || path === '/dgr/schedule') return 'schedule';
		if (path === '/dgr/submissions') return 'submissions';
		if (path === '/dgr/contributors') return 'contributors';
		if (path === '/dgr/rules') return 'rules';
		if (path.includes('/dgr/liturgical-calendar')) return 'calendar';
		if (path.includes('/dgr/templates')) return 'templates';
		if (path === '/dgr/promo') return 'promo';
		return 'schedule';
	});
</script>

<!-- DGR Navigation (hidden for public write page) -->
{#if !isPublicWritePage}
	<DGRNavigation {activeSection} {activeSubSection} />
{/if}

<!-- Page Content -->
{@render children()}
