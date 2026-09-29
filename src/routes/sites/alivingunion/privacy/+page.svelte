<script lang="ts">
	import { SITE } from '../site';
	import { platformSiteUrl } from '$lib/config/course-domains';

	const PLATFORM = platformSiteUrl();
</script>

<svelte:head>
	<title>Privacy Policy · {SITE.name}</title>
</svelte:head>

<article class="prose-page">
	<div class="container">
		<a href="/" class="back">← {SITE.name}</a>
		<h1>Privacy Policy</h1>
		<p class="updated">Last updated: 29 September 2026</p>

		<h2>What we collect</h2>
		<p>
			When you register your interest on this site we collect the details you enter: your name, email
			address, and optionally your parish or community and a message.
		</p>

		<h2>How we use it</h2>
		<p>
			Your details are sent to the Archdiocesan Ministries formation team so we can let you know when
			{SITE.name} is available and answer any questions you have asked. We don’t add you to other
			mailing lists or sell or share your details with anyone else.
		</p>

		<h2>How it is handled</h2>
		<p>
			Submissions are delivered by email through our email provider and kept only as long as they are
			needed for this purpose. You can ask us to remove your details at any time.
		</p>

		<h2>Contact</h2>
		<p>Questions about this policy: <a href="mailto:{SITE.contactEmail}">{SITE.contactEmail}</a>.</p>
		<p>The platform-wide <a href="{PLATFORM}/data-policy">data policy</a> also applies.</p>
	</div>
</article>

<style>
	.container {
		max-width: 44rem;
		margin: 0 auto;
		padding: 0 1.25rem;
	}
	.prose-page {
		padding: 3.5rem 0 4rem;
	}
	h1,
	h2 {
		color: var(--ink);
		font-weight: 600;
	}
	h1 {
		font-size: 2.4rem;
		margin: 0 0 0.25rem;
	}
	h2 {
		font-size: 1.3rem;
		margin: 2rem 0 0.5rem;
	}
	.back {
		display: inline-block;
		margin-bottom: 1.5rem;
		color: var(--ink-soft);
		text-decoration: none;
	}
	.updated {
		color: var(--ink-soft);
		font-size: 0.9rem;
		margin-bottom: 2rem;
	}
	p {
		line-height: 1.7;
	}
	a {
		color: var(--ink);
	}
</style>
