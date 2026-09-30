<script lang="ts">
	import { SITE } from './site';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap"
		rel="stylesheet"
	/>
	<link rel="icon" href="{SITE.assets}/wordmark.png" />
</svelte:head>

<div class="site">
	<main class="site-main">
		{@render children()}
	</main>

	<footer class="site-footer">
		<div class="container footer-inner">
			<span class="launch">{SITE.launch}</span>
			<a href="/" class="domain">alivingunion.com</a>
			<a href="https://archdiocesanministries.org.au" class="org" aria-label="Archdiocesan Ministries">
				<img src="{SITE.assets}/archmin-mono.png" alt="Archdiocesan Ministries" width="800" height="194" />
			</a>
		</div>
		<div class="container footer-meta">
			<span>&copy; {new Date().getFullYear()} Archdiocesan Ministries</span>
			<a href={SITE.privacyUrl}>Privacy</a>
			<a href="mailto:{SITE.contactEmail}">Contact</a>
		</div>
	</footer>
</div>

<style>
	/* Standalone styling: this site does not use the platform theme. Colours follow the print poster. */
	.site {
		--paper: #ece6d4;
		--paper-deep: #e2dbc6;
		--ink: #3a342b;
		--ink-soft: #5d564a;
		--lime: #d6e173;
		--lime-deep: #c4d15a;
		--serif: 'Source Serif 4', Georgia, 'Times New Roman', serif;

		min-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--paper);
		color: var(--ink);
		font-family: var(--serif);
	}

	:global(.site .container) {
		max-width: 68rem;
		margin: 0 auto;
		padding: 0 1.25rem;
	}

	.site-main {
		flex: 1;
	}

	.site-footer {
		background: var(--lime);
		color: var(--ink);
	}
	.footer-inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem 2rem;
		padding-top: 1.75rem;
		padding-bottom: 1.25rem;
		font-size: 1.35rem;
	}
	.domain {
		font-weight: 700;
		color: inherit;
		text-decoration: none;
	}
	.org img {
		display: block;
		height: 3rem;
		width: auto;
	}
	.footer-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		padding-bottom: 1.25rem;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}
	.footer-meta a {
		color: inherit;
	}

	@media (max-width: 640px) {
		.footer-inner {
			flex-direction: column;
			align-items: flex-start;
			font-size: 1.15rem;
		}
	}
</style>
