<script lang="ts">
	import { SITE } from './site';
</script>

<svelte:head>
	<title>{SITE.name}</title>
	<meta name="description" content={SITE.tagline} />
</svelte:head>

<!-- Hero -->
<section class="hero">
	<div class="container hero-inner">
		<p class="eyebrow">Archdiocesan Centre for Catholic Formation</p>
		<h1>{SITE.name}</h1>
		<p class="lead">{SITE.tagline}</p>
		<div class="actions">
			<a href={SITE.enrolPath} class="btn btn-primary">Enrol now</a>
			<a href="#about" class="btn btn-outline">Learn more</a>
		</div>
	</div>
</section>

<!-- About -->
<section id="about" class="section">
	<div class="container">
		<h2>What the course is</h2>
		<p>
			Replace this with the course overview: who it is for, what participants will experience,
			and how the sessions run. Keep it to two or three short paragraphs.
		</p>
		<p>
			Sessions are held in local hubs with a coordinator, with online materials, reflections and
			community available through the participant portal between sessions.
		</p>
	</div>
</section>

<!-- Highlights -->
<section class="section section-alt">
	<div class="container">
		<div class="grid">
			<div class="card">
				<h3>Weekly sessions</h3>
				<p>Placeholder: describe the rhythm of the course and what a typical week looks like.</p>
			</div>
			<div class="card">
				<h3>Local hubs</h3>
				<p>Placeholder: explain hubs, coordinators, and how people gather in their parish.</p>
			</div>
			<div class="card">
				<h3>Online portal</h3>
				<p>Placeholder: videos, readings, and reflections available between sessions.</p>
			</div>
		</div>
	</div>
</section>

<!-- CTA -->
<section class="section cta">
	<div class="container cta-inner">
		<h2>Ready to begin?</h2>
		<p>Enrolment is open for the next cohort.</p>
		<div class="actions">
			<a href={SITE.enrolPath} class="btn btn-primary">Enrol now</a>
			<a href={SITE.signInPath} class="btn btn-outline">Already enrolled? Sign in</a>
		</div>
	</div>
</section>

<style>
	.container {
		max-width: 72rem;
		margin: 0 auto;
		padding: 0 1.25rem;
	}
	h1,
	h2,
	h3 {
		font-family: var(--serif);
		color: var(--accent);
		margin: 0 0 0.75rem;
	}
	h1 {
		font-size: clamp(2.4rem, 6vw, 4rem);
		line-height: 1.05;
	}
	h2 {
		font-size: clamp(1.6rem, 3vw, 2.2rem);
	}
	h3 {
		font-size: 1.2rem;
	}
	p {
		line-height: 1.65;
		margin: 0 0 1rem;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-size: 0.75rem;
		color: var(--gold);
		font-weight: 600;
	}
	.lead {
		font-size: 1.2rem;
		color: var(--muted);
		max-width: 38rem;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.hero {
		padding: 5rem 0 4rem;
	}
	.section {
		padding: 4rem 0;
	}
	.section-alt {
		background: #fff;
	}
	.grid {
		display: grid;
		gap: 1.5rem;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
	}
	.card {
		padding: 1.5rem;
		border-radius: 1rem;
		background: var(--surface);
	}
	.cta {
		background: var(--accent);
		color: #fff;
	}
	.cta h2 {
		color: #fff;
	}
	.cta-inner {
		text-align: center;
	}
	.cta .actions {
		justify-content: center;
	}
	:global(.site .cta .btn-outline) {
		border-color: rgba(255, 255, 255, 0.7);
		color: #fff !important;
	}
</style>
