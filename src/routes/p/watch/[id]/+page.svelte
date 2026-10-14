<script>
	/**
	 * A single video on its own page, for someone a leader has sent the link to.
	 * Dressed like the course's Companion Guide (paper, ink, highlighter) so it reads
	 * as part of it, but there is deliberately nothing here to navigate to apart from
	 * the guide itself: no other sessions, no other videos, no menu.
	 */
	import MuxVideoPlayer from '$lib/components/MuxVideoPlayer.svelte';
	import GuideArtwork from '$lib/components/GuideArtwork.svelte';
	import { getPublicGuideDesign } from '$lib/public-guides';
	import { publicPageThemeStyle } from '$lib/public-guides/theme';
	import { readableTextOn } from '$lib/utils/theme-contrast';

	let { data } = $props();

	const design = $derived(getPublicGuideDesign(data.course.slug));
	const theme = $derived(design.theme);
	const highlight = $derived(theme.vars['--pp-highlight'] ?? '#c9a96e');
	const onHighlight = $derived(readableTextOn(highlight));
	const art = $derived(design.sessionArtwork?.(data.session.number) ?? null);

	const sessionLabel = $derived(data.session.number === 0 ? 'Start' : `Session ${data.session.number}`);
	const ready = $derived(data.video.status === 'ready' && !!data.video.playbackId);

	/** Width that gives an illustration the stated height, since the artwork is sized by width. */
	const artWidth = (a, heightRem) => `${((heightRem * a.width) / a.height).toFixed(2)}rem`;
</script>

<svelte:head>
	<title>{sessionLabel}: {data.session.title} — {data.course.name}</title>
	<meta name="robots" content="noindex, nofollow" />
	{#each theme.fontStylesheets as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

<div class="watch" style="{publicPageThemeStyle(theme)}; --hl: {highlight}; --on-hl: {onHighlight};">
	<header class="wrap head">
		<div class="head-text">
			<p class="course">{data.course.name}</p>
			<p class="where">
				<span class="where-number">{sessionLabel}</span>
				{#if data.session.sectionName}<span class="where-section">{data.session.sectionName}</span>{/if}
			</p>
			<h1 class="title">{data.session.title}</h1>
		</div>
		{#if art}
			<div class="head-art" aria-hidden="true">
				<GuideArtwork src={art.src} width={art.width} height={art.height} color="var(--pp-ink, #1c1917)" size={artWidth(art, 7)} />
			</div>
		{/if}
	</header>

	<section class="screen" aria-label="Video">
		<div class="screen-inner">
			{#if ready}
				<MuxVideoPlayer playbackId={data.video.playbackId} title={data.video.title} status="ready" accentColor={highlight} />
			{:else}
				<div class="not-ready">
					<h2>{data.video.status === 'errored' ? 'This video could not be played' : 'This video is not ready yet'}</h2>
					<p>{data.video.status === 'errored' ? 'Please let the person who sent you this link know.' : 'It is still being prepared. Please try again in a few minutes.'}</p>
				</div>
			{/if}
		</div>
	</section>

	{#if data.guideUrl}
		<section class="wrap guide">
			<p>Follow along with the notes and questions for this session.</p>
			<a class="btn" href={data.guideUrl}>Open the Companion Guide</a>
		</section>
	{/if}
</div>

<style>
	.watch {
		--screen: color-mix(in srgb, var(--pp-ink, #1c1917) 90%, black);
		--radius: var(--pp-radius, 2px);
		--font-heading: var(--pp-font-heading, 'Lora', Georgia, serif);
		--font-ui: var(--pp-font-ui, 'Inter', system-ui, sans-serif);

		min-height: 100vh;
		background: var(--pp-bg, #faf8f5);
		color: var(--pp-body, #44403c);
		font-family: var(--pp-font-body, 'Lora', Georgia, serif);
		font-weight: var(--pp-body-weight, 400);
		line-height: 1.6;
		padding-bottom: 4rem;
	}

	.wrap {
		max-width: 64rem;
		margin: 0 auto;
		padding-left: clamp(1rem, 4vw, 2rem);
		padding-right: clamp(1rem, 4vw, 2rem);
	}

	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 2rem;
		padding-top: clamp(1.5rem, 4vw, 2.75rem);
		padding-bottom: clamp(1.25rem, 3vw, 2rem);
	}

	.course {
		margin: 0 0 1rem;
		font-family: var(--font-ui);
		font-size: 0.8rem;
		color: var(--pp-muted, #78716c);
	}

	.where {
		display: flex;
		align-items: baseline;
		gap: 0.9rem;
		margin: 0 0 0.6rem;
	}
	.where-number {
		font-family: var(--pp-font-display, var(--font-heading));
		font-size: 1.1rem;
		letter-spacing: 0.04em;
		padding: 0.05rem 0.5rem;
		background: var(--hl);
		color: var(--on-hl);
		border-radius: var(--radius);
	}
	.where-section {
		font-style: italic;
		font-size: 0.95rem;
		color: var(--pp-muted, #78716c);
	}

	.title {
		margin: 0;
		font-family: var(--font-heading);
		font-weight: 400;
		font-size: clamp(1.9rem, 5vw, 3rem);
		line-height: 1.1;
		letter-spacing: -0.01em;
		color: var(--pp-ink, #1c1917);
		max-width: 24ch;
	}

	.head-art {
		flex-shrink: 0;
		opacity: 0.9;
	}

	.screen {
		background: var(--screen);
		padding: clamp(0.75rem, 3vw, 2.5rem) clamp(0px, 3vw, 2rem);
	}
	.screen-inner {
		max-width: 64rem;
		margin: 0 auto;
	}
	.screen-inner :global(.aspect-video) {
		border-radius: var(--radius);
		box-shadow: none;
	}

	.not-ready {
		min-height: 15rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: 2rem 1rem;
		border: 1px dotted color-mix(in srgb, var(--pp-card, #fff) 45%, transparent);
		border-radius: var(--radius);
		color: var(--pp-card, #fff);
	}
	.not-ready h2 {
		margin: 0;
		font-family: var(--font-heading);
		font-weight: 400;
		font-size: clamp(1.3rem, 3vw, 1.8rem);
		color: var(--pp-card, #fff);
	}
	.not-ready p {
		margin: 0.5rem 0 0;
		color: color-mix(in srgb, var(--pp-card, #fff) 75%, transparent);
	}

	.guide {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem 2rem;
		padding-top: 1.75rem;
	}
	.guide p {
		margin: 0;
		color: var(--pp-muted, #78716c);
	}

	.btn {
		display: inline-block;
		font-family: var(--font-ui);
		font-size: 0.9rem;
		font-weight: 500;
		line-height: 1.2;
		padding: 0.75rem 1.2rem;
		color: var(--on-hl);
		background: var(--hl);
		border: 1px solid var(--hl);
		border-radius: var(--radius);
		text-decoration: none;
	}
	.btn:hover {
		background: color-mix(in srgb, var(--hl) 85%, var(--pp-ink, #1c1917));
	}
	.btn:focus-visible {
		outline: 2px solid var(--pp-ink, #1c1917);
		outline-offset: 2px;
	}

	@media (max-width: 640px) {
		.head-art {
			display: none;
		}
	}
</style>
