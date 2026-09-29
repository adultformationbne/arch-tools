<script lang="ts">
	import { enhance } from '$app/forms';
	import { SITE } from './site';

	let { form } = $props();

	let submitting = $state(false);

	const photos = [
		{ src: 'caleb.jpg', alt: 'Caleb, co-host of A Living Union' },
		{ src: 'story.jpg', alt: 'A faith story shared in the course' },
		{ src: 'vanessa.jpg', alt: 'Vanessa, co-host of A Living Union' },
		{ src: 'frjosh.jpg', alt: 'Fr Josh, who leads the weekly practices' }
	];

	const expect = [
		{
			title: 'Teaching',
			text: 'Eight sessions exploring who we are in Christ and who God is in Christ, grounded in Scripture and the tradition of the Church.'
		},
		{
			title: 'Discussion',
			text: 'Designed for small groups, so parishioners and friends can share life and faith together.'
		},
		{
			title: 'Practical application',
			text: 'Prayer and a simple weekly practice to carry what you learn from your head to your heart.'
		}
	];
</script>

<svelte:head>
	<title>{SITE.name} · {SITE.launch}</title>
	<meta name="description" content={SITE.tagline} />
	<meta property="og:title" content={SITE.name} />
	<meta property="og:description" content={SITE.tagline} />
	<meta property="og:image" content="https://alivingunion.com{SITE.assets}/caleb.jpg" />
</svelte:head>

<!-- Hero -->
<section class="hero">
	<img class="tansy" src="{SITE.assets}/tansy.webp" alt="" aria-hidden="true" />
	<div class="container hero-inner">
		<h1>
			<img src="{SITE.assets}/wordmark.webp" alt={SITE.name} width="1096" height="538" />
		</h1>
		<p class="blurb">
			A <strong>small-group resource</strong> designed to help Christians move beyond simply practising
			the Catholic faith to living it more deeply. Through teaching, discussion and practical application,
			participants will explore the logic of God’s love and come to understand our true identity in Christ,
			as people called to live in union with the Trinity.
		</p>
		<div class="hero-actions">
			<a href="#interest" class="btn">Register your interest</a>
			<span class="launch">{SITE.launch}</span>
		</div>
	</div>
</section>

<!-- Presenters -->
<section class="photos" aria-label="From the course">
	{#each photos as photo (photo.src)}
		<img src="{SITE.assets}/{photo.src}" alt={photo.alt} loading="lazy" width="880" height="484" />
	{/each}
</section>

<!-- What to expect -->
<section class="section">
	<div class="container">
		<h2>What to expect</h2>
		<div class="expect">
			{#each expect as item (item.title)}
				<div>
					<h3>{item.title}</h3>
					<p>{item.text}</p>
				</div>
			{/each}
		</div>
		<p class="hosts">
			Hosted by Vanessa and Caleb from the Adult Formation team, with weekly practices from Fr Josh.
		</p>
	</div>
</section>

<!-- Register interest -->
<section id="interest" class="section interest">
	<div class="container interest-inner">
		<div class="interest-copy">
			<h2>Be the first to hear</h2>
			<p>
				<em>A Living Union</em> launches in 2027. Leave your details and we’ll let you know when it’s
				ready, and how your parish or group can take part.
			</p>
		</div>

		{#if form?.success}
			<div class="card thanks" role="status">
				<h3>Thank you!</h3>
				<p>We’ve received your details and will be in touch as <em>A Living Union</em> gets closer.</p>
			</div>
		{:else}
			<form
				method="POST"
				action="?/interest"
				class="card"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				<label>
					<span>Name</span>
					<input name="name" autocomplete="name" required value={form?.values?.name ?? ''} />
				</label>
				<label>
					<span>Email</span>
					<input
						name="email"
						type="email"
						autocomplete="email"
						required
						value={form?.values?.email ?? ''}
					/>
				</label>
				<label>
					<span>Parish or community <small>(optional)</small></span>
					<input name="parish" value={form?.values?.parish ?? ''} />
				</label>
				<label>
					<span>Anything you’d like us to know? <small>(optional)</small></span>
					<textarea name="message" rows="3">{form?.values?.message ?? ''}</textarea>
				</label>
				<!-- Honeypot: hidden from people, filled by bots -->
				<label class="hp" aria-hidden="true">
					Website <input name="website" tabindex="-1" autocomplete="off" />
				</label>

				{#if form?.error}
					<p class="error" role="alert">{form.error}</p>
				{/if}

				<button type="submit" class="btn" disabled={submitting}>
					{submitting ? 'Sending…' : 'Register interest'}
				</button>
			</form>
		{/if}
	</div>
</section>

<style>
	h2,
	h3 {
		margin: 0 0 0.75rem;
		font-weight: 600;
		line-height: 1.2;
	}
	h2 {
		font-size: clamp(1.8rem, 4vw, 2.5rem);
	}
	h3 {
		font-size: 1.25rem;
	}
	p {
		line-height: 1.6;
		margin: 0 0 1rem;
	}

	.btn {
		display: inline-block;
		padding: 0.8rem 1.6rem;
		border: 0;
		border-radius: 999px;
		background: var(--ink);
		color: var(--paper);
		font: inherit;
		font-weight: 600;
		font-size: 1.05rem;
		text-decoration: none;
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn:hover {
		background: #221e18;
	}
	.btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	/* Hero */
	.hero {
		position: relative;
		overflow: hidden;
		padding: 4.5rem 0 4rem;
		background:
			radial-gradient(ellipse at 20% 0%, rgba(255, 255, 255, 0.45), transparent 60%),
			var(--paper);
	}
	.tansy {
		position: absolute;
		right: -6rem;
		bottom: -8rem;
		width: min(46rem, 90vw);
		opacity: 0.55;
		pointer-events: none;
	}
	.hero-inner {
		position: relative;
		max-width: 46rem !important;
	}
	h1 {
		margin: 0 0 2rem;
	}
	h1 img {
		display: block;
		width: min(100%, 36rem);
		height: auto;
	}
	.blurb {
		font-size: clamp(1.15rem, 2.2vw, 1.4rem);
		line-height: 1.55;
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem 1.5rem;
		margin-top: 2rem;
	}
	.launch {
		font-size: 1.2rem;
		font-style: italic;
		color: var(--ink-soft);
	}

	/* Photos: full-bleed strip, 2×2 on small screens like the poster */
	.photos {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
	}
	.photos img {
		display: block;
		width: 100%;
		height: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
	}
	@media (max-width: 860px) {
		.photos {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.section {
		padding: 4.5rem 0;
	}

	/* What to expect */
	.expect {
		display: grid;
		gap: 1.5rem 2.5rem;
		grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
		margin-top: 1.5rem;
	}
	.expect > div {
		padding-top: 1rem;
		border-top: 2px solid var(--lime-deep);
	}
	.expect p {
		color: var(--ink-soft);
	}
	.hosts {
		margin-top: 1.5rem;
		font-style: italic;
		color: var(--ink-soft);
	}

	/* Register interest */
	.interest {
		background: var(--paper-deep);
	}
	.interest-inner {
		display: grid;
		gap: 2rem 3.5rem;
		grid-template-columns: 1fr;
		align-items: start;
	}
	.interest-copy p {
		font-size: 1.15rem;
	}
	@media (min-width: 860px) {
		.interest-inner {
			grid-template-columns: 1fr 1.2fr;
		}
	}
	.card {
		padding: 1.75rem;
		border-radius: 1.25rem;
		background: #f7f3e8;
		box-shadow: 0 1px 0 rgba(58, 52, 43, 0.08);
	}
	form {
		display: grid;
		gap: 1rem;
	}
	label {
		display: grid;
		gap: 0.35rem;
		font-weight: 600;
		font-size: 0.95rem;
	}
	small {
		font-weight: 400;
		color: var(--ink-soft);
	}
	input,
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 0.7rem 0.85rem;
		border: 1.5px solid rgba(58, 52, 43, 0.25);
		border-radius: 0.6rem;
		background: #fff;
		color: var(--ink);
		font: inherit;
		font-weight: 400;
		font-size: 1rem;
	}
	input:focus,
	textarea:focus {
		outline: 2px solid var(--lime-deep);
		outline-offset: 1px;
		border-color: var(--ink);
	}
	textarea {
		resize: vertical;
	}
	form .btn {
		justify-self: start;
		margin-top: 0.25rem;
	}
	.hp {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	.error {
		margin: 0;
		padding: 0.7rem 0.9rem;
		border-radius: 0.6rem;
		background: #f6dcd4;
		color: #7a2a17;
	}
	.thanks {
		border-left: 6px solid var(--lime-deep);
	}
	.thanks p {
		margin: 0;
	}
</style>
