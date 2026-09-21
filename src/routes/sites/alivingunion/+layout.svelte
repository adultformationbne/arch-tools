<script lang="ts">
	import { page } from '$app/state';
	import { SITE } from './site';

	let { children } = $props();

	let menuOpen = $state(false);

	// Reroute keeps the typed URL, so "/" and "/privacy" compare directly
	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="site">
	<header class="site-header">
		<div class="container header-inner">
			<a href="/" class="brand">{SITE.name}</a>

			<nav class="nav" class:open={menuOpen}>
				{#each SITE.nav as item (item.href)}
					<a href={item.href} class:active={isActive(item.href)} onclick={() => (menuOpen = false)}>
						{item.label}
					</a>
				{/each}
				<a href={SITE.signInPath} class="nav-signin">Sign in</a>
				<a href={SITE.enrolPath} class="btn btn-primary">Enrol</a>
			</nav>

			<button
				type="button"
				class="menu-toggle"
				aria-label="Toggle menu"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span></span><span></span><span></span>
			</button>
		</div>
	</header>

	<main class="site-main">
		{@render children()}
	</main>

	<footer class="site-footer">
		<div class="container footer-inner">
			<div>&copy; {new Date().getFullYear()} {SITE.name} &middot; Archdiocesan Ministries</div>
			<div class="footer-links">
				<a href="/privacy">Privacy</a>
				<a href="mailto:{SITE.contactEmail}">Contact</a>
				<a href={SITE.signInPath}>Participant sign in</a>
			</div>
		</div>
	</footer>
</div>

<style>
	/* Standalone styling: this site does not use the platform theme. Edit freely. */
	.site {
		--accent: #334642;
		--accent-dark: #1e2322;
		--gold: #c59a6b;
		--surface: #f6f1ea;
		--ink: #1e2322;
		--muted: #6b6f6d;
		--serif: 'Lora', Georgia, serif;
		--sans: 'Inter', system-ui, sans-serif;

		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--surface);
		color: var(--ink);
		font-family: var(--sans);
	}

	.container {
		max-width: 72rem;
		margin: 0 auto;
		padding: 0 1.25rem;
	}

	/* Header */
	.site-header {
		position: sticky;
		top: 0;
		z-index: 20;
		background: rgba(246, 241, 234, 0.92);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid rgba(51, 70, 66, 0.12);
	}
	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 4.25rem;
	}
	.brand {
		font-family: var(--serif);
		font-size: 1.35rem;
		font-weight: 600;
		color: var(--accent);
		text-decoration: none;
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 1.75rem;
	}
	.nav a {
		color: var(--ink);
		text-decoration: none;
		font-size: 0.95rem;
	}
	.nav a.active {
		color: var(--accent);
		font-weight: 600;
	}
	.nav-signin {
		color: var(--muted) !important;
	}
	.menu-toggle {
		display: none;
		flex-direction: column;
		gap: 5px;
		background: none;
		border: 0;
		padding: 0.5rem;
		cursor: pointer;
	}
	.menu-toggle span {
		display: block;
		width: 22px;
		height: 2px;
		background: var(--accent);
	}

	/* Buttons (shared with pages via :global) */
	:global(.site .btn) {
		display: inline-block;
		padding: 0.6rem 1.25rem;
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		transition: background 0.15s, color 0.15s;
	}
	:global(.site .btn-primary) {
		background: var(--accent);
		color: #fff !important;
	}
	:global(.site .btn-primary:hover) {
		background: var(--accent-dark);
	}
	:global(.site .btn-outline) {
		border: 1.5px solid var(--accent);
		color: var(--accent) !important;
	}
	:global(.site .btn-outline:hover) {
		background: rgba(51, 70, 66, 0.08);
	}

	.site-main {
		flex: 1;
	}

	/* Footer */
	.site-footer {
		background: var(--accent-dark);
		color: rgba(255, 255, 255, 0.75);
		font-size: 0.85rem;
	}
	.footer-inner {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		justify-content: space-between;
		padding-top: 1.5rem;
		padding-bottom: 1.5rem;
	}
	.footer-links {
		display: flex;
		gap: 1.25rem;
	}
	.footer-links a {
		color: inherit;
		text-decoration: none;
	}
	.footer-links a:hover {
		color: #fff;
	}

	@media (max-width: 720px) {
		.menu-toggle {
			display: flex;
		}
		.nav {
			display: none;
			position: absolute;
			left: 0;
			right: 0;
			top: 4.25rem;
			flex-direction: column;
			align-items: stretch;
			gap: 0;
			background: var(--surface);
			border-bottom: 1px solid rgba(51, 70, 66, 0.12);
		}
		.nav.open {
			display: flex;
		}
		.nav a {
			padding: 0.9rem 1.25rem;
			border-top: 1px solid rgba(51, 70, 66, 0.08);
		}
		:global(.site .nav .btn) {
			border-radius: 0;
			text-align: center;
		}
	}
</style>
