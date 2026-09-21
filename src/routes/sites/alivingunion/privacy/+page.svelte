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
		<h1>Privacy Policy</h1>
		<p class="updated">Last updated: {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

		<h2>What we collect</h2>
		<p>
			Placeholder. Describe the information collected at enrolment (name, email, phone, parish,
			mailing address) and during the course (reflections, attendance).
		</p>

		<h2>How we use it</h2>
		<p>Placeholder. Running the course, contacting participants, hub coordination, payments.</p>

		<h2>Who we share it with</h2>
		<p>Placeholder. Hub coordinators, payment processor (Stripe), email provider.</p>

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
		font-family: var(--serif);
		color: var(--accent);
	}
	h1 {
		font-size: 2.4rem;
		margin: 0 0 0.25rem;
	}
	h2 {
		font-size: 1.3rem;
		margin: 2rem 0 0.5rem;
	}
	.updated {
		color: var(--muted);
		font-size: 0.9rem;
		margin-bottom: 2rem;
	}
	p {
		line-height: 1.7;
	}
	a {
		color: var(--accent);
	}
</style>
