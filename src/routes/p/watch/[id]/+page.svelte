<script>
	/**
	 * A single video on its own page, for someone a leader has sent the link to.
	 * Dark and bare: the course logo, which session it is, the video, and a link to the
	 * Companion Guide. There is deliberately nothing here to navigate to apart from the
	 * guide itself: no other sessions, no other videos, no menu.
	 */
	import MuxVideoPlayer from '$lib/components/MuxVideoPlayer.svelte';
	import { getPublicGuideDesign } from '$lib/public-guides';
	import { publicPageThemeStyle } from '$lib/public-guides/theme';

	let { data } = $props();

	const theme = $derived(getPublicGuideDesign(data.course.slug).theme);
	const highlight = $derived(theme.vars['--pp-highlight'] ?? '#c9a96e');

	const sessionLabel = $derived(data.session.number === 0 ? 'Start' : `Session ${data.session.number}`);
	const ready = $derived(data.video.status === 'ready' && !!data.video.playbackId);
</script>

<svelte:head>
	<title>{sessionLabel}: {data.session.title} — {data.course.name}</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="color-scheme" content="dark" />
	{#each theme.fontStylesheets as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

<div class="watch" style="{publicPageThemeStyle(theme)}; --hl: {highlight};">
	<main class="col">
		<header class="top">
			{#if data.course.logoUrl}
				<img class="logo" src={data.course.logoUrl} alt={data.course.name} />
			{:else}
				<span class="course">{data.course.name}</span>
			{/if}
		</header>

		<h1 class="session">
			<span class="num">{sessionLabel}</span>
			<span class="title">{data.session.title}</span>
		</h1>

		<div class="video">
			{#if ready}
				<MuxVideoPlayer playbackId={data.video.playbackId} title={data.video.title} status="ready" accentColor={highlight} />
			{:else}
				<div class="not-ready">
					<p>{data.video.status === 'errored' ? 'This video could not be played.' : 'This video is not ready yet. Please try again in a few minutes.'}</p>
				</div>
			{/if}
		</div>

		{#if data.guideUrl}
			<a class="guide" href={data.guideUrl}>Companion Guide</a>
		{/if}
	</main>
</div>

<style>
	.watch {
		--bg: color-mix(in srgb, var(--pp-ink, #1c1917) 45%, #000);
		--font-heading: var(--pp-font-heading, 'Lora', Georgia, serif);
		--font-ui: var(--pp-font-ui, 'Inter', system-ui, sans-serif);

		min-height: 100vh;
		background: var(--bg);
		color: #fff;
		font-family: var(--font-ui);
		line-height: 1.5;
	}

	.col {
		max-width: 52rem;
		margin: 0 auto;
		padding: clamp(1rem, 4vw, 2rem);
	}

	.top {
		margin-bottom: clamp(1.25rem, 4vw, 2rem);
	}
	.logo {
		display: block;
		height: 2.25rem;
		width: auto;
	}
	.course {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.session {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 0.75rem;
		margin: 0 0 0.75rem;
		font-weight: 400;
	}
	.num {
		font-size: 0.8rem;
		color: var(--hl);
	}
	.title {
		font-family: var(--font-heading);
		font-size: 1.05rem;
		color: #fff;
	}

	.video :global(.aspect-video) {
		border-radius: 2px;
		box-shadow: none;
	}
	.not-ready {
		min-height: 12rem;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		text-align: center;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 2px;
	}
	.not-ready p {
		margin: 0;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
	}

	.guide {
		display: inline-block;
		margin-top: 1rem;
		padding: 0.45rem 0.85rem;
		font-size: 0.8rem;
		line-height: 1.2;
		color: var(--hl);
		text-decoration: none;
		border: 1px solid var(--hl);
		border-radius: 2px;
	}
	.guide:hover {
		background: color-mix(in srgb, var(--hl) 14%, transparent);
	}
	.guide:focus-visible {
		outline: 2px solid #fff;
		outline-offset: 2px;
	}
</style>
