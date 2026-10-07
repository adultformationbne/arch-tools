<script>
	/**
	 * Home page of a hub-leader course. A leader opens a session, plays its video
	 * (often to a room), and sends the public guide to their own group. Nothing is
	 * tracked and nothing is gated — see $lib/server/hub-leader-home.ts.
	 *
	 * The look comes from the course's guide design ($lib/public-guides): paper, ink
	 * and highlighter from its --pp-* theme, so the leader side reads as the same
	 * publication as the guide it hands out. The video sits alone in a dark band;
	 * everything else stays on paper.
	 */
	import { page } from '$app/state';
	import { replaceState } from '$app/navigation';
	import MuxVideoPlayer from '$lib/components/MuxVideoPlayer.svelte';
	import GuideArtwork from '$lib/components/GuideArtwork.svelte';
	import { getPublicGuideDesign } from '$lib/public-guides';
	import { publicPageThemeStyle } from '$lib/public-guides/theme';
	import { readableTextOn } from '$lib/utils/theme-contrast';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';

	let { data } = $props();

	const design = $derived(getPublicGuideDesign(data.courseSlug));
	const theme = $derived(design.theme);
	const highlight = $derived(theme.vars['--pp-highlight'] ?? '#c9a96e');
	const onHighlight = $derived(readableTextOn(highlight));

	const sessions = $derived(data.groups.flatMap((g) => g.items));

	// The chosen session lives in the URL (?session=3) so a refresh or a bookmark returns to it.
	const fromUrl = page.url.searchParams.get('session');
	let selectedNumber = $state(fromUrl === null ? null : Number(fromUrl));

	// Open on the first real session; session 0 is the welcome/introduction.
	const current = $derived(
		sessions.find((s) => s.sessionNumber === selectedNumber) ??
			sessions.find((s) => s.sessionNumber >= 1) ??
			sessions[0] ??
			null
	);

	// The first video is the hero; any others, and the links and documents, sit below it.
	const videos = $derived(current?.materials.filter((m) => m.type === 'mux_video') ?? []);
	const hero = $derived(videos.find((v) => v.muxStatus === 'ready' && v.muxPlaybackId) ?? videos[0] ?? null);
	const moreVideos = $derived(videos.filter((v) => v !== hero));
	const files = $derived(current?.materials.filter((m) => m.type !== 'mux_video') ?? []);

	const heroState = $derived(
		!hero ? 'none' : hero.muxStatus === 'ready' && hero.muxPlaybackId ? 'ready' : hero.muxStatus === 'errored' ? 'errored' : 'processing'
	);

	/** @param {{ materials: { type: string }[] }} session */
	const hasVideo = (session) => session.materials.some((m) => m.type === 'mux_video');

	/** @param {number} n */
	const pad = (n) => String(n).padStart(2, '0');

	/** Width that gives an illustration the stated height, since the artwork is sized by width. */
	const artWidth = (art, heightRem) => `${((heightRem * art.width) / art.height).toFixed(2)}rem`;

	/** @param {number} n */
	function select(n) {
		selectedNumber = n;
		const url = new URL(page.url);
		url.searchParams.set('session', String(n));
		replaceState(url, {});
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		document.getElementById('session-top')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
	}

	/** @param {string} url */
	async function copyLink(url) {
		try {
			await navigator.clipboard.writeText(url);
			toastSuccess('Link copied');
		} catch {
			toastError('Could not copy the link');
		}
	}
</script>

<svelte:head>
	{#each theme.fontStylesheets as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

<div class="leader" style="{publicPageThemeStyle(theme)}; --hl: {highlight}; --on-hl: {onHighlight};">
	{#if !current}
		<div class="wrap empty">
			<h1>There are no sessions in this course yet</h1>
			<p>A course admin needs to add them before you can use this page.</p>
		</div>
	{:else}
		{@const art = design.sessionArtwork?.(current.sessionNumber) ?? null}

		<header class="wrap head" id="session-top">
			<div class="head-text">
				<p class="where">
					{#if current.sessionNumber === 0}
						<span class="where-label">Before you start</span>
					{:else}
						<span class="where-number">{pad(current.sessionNumber)}</span>
						{#if current.sectionName}<span class="where-section">{current.sectionName}</span>{/if}
					{/if}
				</p>
				<h1 class="title">{current.title}</h1>
				{#if current.description}
					<p class="lead">{current.description}</p>
				{/if}
			</div>
			{#if art}
				<div class="head-art">
					<GuideArtwork src={art.src} width={art.width} height={art.height} color="var(--pp-ink, #1c1917)" size={artWidth(art, 7.5)} />
				</div>
			{/if}
		</header>

		<section class="screen" aria-label="Session video">
			<div class="screen-inner">
				{#if heroState === 'ready'}
					<MuxVideoPlayer playbackId={hero.muxPlaybackId} title={hero.title} status="ready" accentColor={highlight} pausePoints={hero.pausePoints} />
				{:else}
					<div class="no-video">
						{#if art}
							<div class="no-video-art">
								<GuideArtwork src={art.src} width={art.width} height={art.height} color="var(--hl)" size={artWidth(art, 11)} />
							</div>
						{/if}
						<div class="no-video-text">
							{#if heroState === 'processing'}
								<h2>The video is still processing</h2>
								<p>This can take a few minutes after it has been uploaded. Refresh the page to check.</p>
							{:else if heroState === 'errored'}
								<h2>The video could not be processed</h2>
								<p>Ask a course admin to upload it again.</p>
							{:else}
								<h2>No video for this session yet</h2>
								<p>{data.guideUrl ? 'The Companion Guide is ready to share with your group.' : 'Check back soon.'}</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</section>

		<div class="wrap">
			{#if data.guideUrl}
				<section class="share" aria-labelledby="share-title">
					<div class="share-text">
						<h2 id="share-title">Send the Companion Guide to your group</h2>
						<p>It has every session, and they can read it on any phone. They don't need an account.</p>
					</div>
					<div class="actions">
						<button type="button" class="btn primary" onclick={() => copyLink(data.guideUrl)}>Copy link</button>
						<a class="btn" href={data.guideUrl} target="_blank" rel="noopener noreferrer">Go to Companion Guide</a>
					</div>
				</section>
			{/if}

			{#if moreVideos.length > 0 || files.length > 0}
				<section class="more" aria-labelledby="more-title">
					<h2 id="more-title">More for this session</h2>
					{#each moreVideos as video (video.id)}
						<div class="more-video">
							<h3>{video.title}</h3>
							{#if video.description}<p>{video.description}</p>{/if}
							<MuxVideoPlayer playbackId={video.muxPlaybackId} title={video.title} status={video.muxStatus ?? 'processing'} accentColor={highlight} pausePoints={video.pausePoints} />
						</div>
					{/each}
					{#if files.length > 0}
						<ul class="files">
							{#each files as file (file.id)}
								<li>
									<div>
										<span class="file-title">{file.title}</span>
										{#if file.description}<span class="file-note">{file.description}</span>{/if}
									</div>
									{#if file.url}
										<a class="btn" href={file.url} target="_blank" rel="noopener noreferrer">
											{file.type === 'document' ? 'Open the document' : 'Open the link'}
										</a>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}

			<section class="index" aria-labelledby="index-title">
				<div class="index-head">
					<h2 id="index-title">All sessions</h2>
				</div>

				{#each data.groups as group}
					<div class="group">
						{#if group.label}<h3 class="group-label">{group.label}</h3>{/if}
						<ul class="cards">
							{#each group.items as session (session.sessionNumber)}
								{@const cardArt = design.sessionArtwork?.(session.sessionNumber) ?? null}
								{@const active = session.sessionNumber === current.sessionNumber}
								<li>
									<button
										type="button"
										class="card"
										class:active
										aria-current={active ? 'true' : undefined}
										onclick={() => select(session.sessionNumber)}
									>
										{#if cardArt}
											<span class="card-art">
												<GuideArtwork src={cardArt.src} width={cardArt.width} height={cardArt.height} color="var(--pp-ink, #1c1917)" size={artWidth(cardArt, 4)} />
											</span>
										{/if}
										<span class="card-number">{session.sessionNumber === 0 ? 'Start' : pad(session.sessionNumber)}</span>
										<span class="card-title">{session.title}</span>
										{#if hasVideo(session)}<span class="card-tag">Has video</span>{/if}
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</section>
		</div>
	{/if}
</div>

<style>
	.leader {
		--screen: color-mix(in srgb, var(--pp-ink, #1c1917) 90%, black);
		--rule: var(--pp-muted, #78716c);
		--radius: var(--pp-radius, 2px);
		--font-heading: var(--pp-font-heading, 'Lora', Georgia, serif);
		--font-ui: var(--pp-font-ui, 'Inter', system-ui, sans-serif);

		min-height: calc(100vh - 44px);
		background: var(--pp-bg, #faf8f5);
		color: var(--pp-body, #44403c);
		font-family: var(--pp-font-body, 'Lora', Georgia, serif);
		font-weight: var(--pp-body-weight, 400);
		line-height: 1.6;
		padding-bottom: 5rem;
	}

	.wrap {
		max-width: 64rem;
		margin: 0 auto;
		padding-left: clamp(1rem, 4vw, 2rem);
		padding-right: clamp(1rem, 4vw, 2rem);
	}

	h1, h2, h3 {
		font-family: var(--font-heading);
		font-weight: 400;
		color: var(--pp-ink, #1c1917);
		margin: 0;
	}

	/* Session heading */
	.head {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: 2rem;
		padding-top: clamp(1.75rem, 4vw, 3rem);
		padding-bottom: clamp(1.25rem, 3vw, 2rem);
	}
	.where {
		display: flex;
		align-items: baseline;
		gap: 0.9rem;
		margin: 0 0 0.6rem;
	}
	.where-number {
		font-family: var(--pp-font-display, var(--font-heading));
		font-size: 1.15rem;
		letter-spacing: 0.04em;
		padding: 0.05rem 0.5rem;
		background: var(--hl);
		color: var(--on-hl);
		border-radius: var(--radius);
	}
	.where-section,
	.where-label {
		font-style: italic;
		font-size: 0.95rem;
		color: var(--pp-muted, #78716c);
	}
	.title {
		font-size: clamp(2.1rem, 5vw, 3.4rem);
		line-height: 1.08;
		letter-spacing: -0.01em;
		max-width: 22ch;
	}
	.lead {
		margin: 1rem 0 0;
		max-width: 58ch;
		font-size: 1.05rem;
		color: var(--pp-muted, #78716c);
	}
	.head-art {
		align-self: stretch;
		display: flex;
		align-items: flex-end;
		opacity: 0.9;
	}

	/* The screen: the only dark thing on the page */
	.screen {
		background: var(--screen);
		padding: clamp(0.75rem, 3vw, 2.5rem) clamp(0px, 3vw, 2rem);
	}
	.screen-inner {
		max-width: 72rem;
		margin: 0 auto;
	}
	.screen-inner :global(.aspect-video) {
		border-radius: var(--radius);
		box-shadow: none;
	}
	.no-video {
		min-height: 17rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(1.5rem, 5vw, 4rem);
		padding: 1.5rem;
		border: 1px dotted color-mix(in srgb, var(--pp-card, #fff) 45%, transparent);
		border-radius: var(--radius);
		color: var(--pp-card, #fff);
	}
	.no-video-art {
		display: flex;
		align-items: center;
		opacity: 0.95;
	}
	.no-video-text {
		max-width: 22rem;
	}
	.no-video-text h2 {
		color: var(--pp-card, #fff);
		font-size: clamp(1.4rem, 3vw, 2rem);
		line-height: 1.15;
	}
	.no-video-text p {
		margin: 0.6rem 0 0;
		color: color-mix(in srgb, var(--pp-card, #fff) 75%, transparent);
	}

	/* Sharing */
	.share {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1.25rem 2rem;
		padding: 1.75rem 0;
		border-bottom: 1px dotted var(--rule);
	}
	.share h2,
	.more h2,
	.index h2 {
		font-size: 1.5rem;
		line-height: 1.2;
	}
	.share p {
		margin: 0.35rem 0 0;
		color: var(--pp-muted, #78716c);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
	}

	.btn {
		display: inline-block;
		font-family: var(--font-ui);
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.2;
		padding: 0.65rem 1.1rem;
		color: var(--pp-ink, #1c1917);
		background: transparent;
		border: 1px solid var(--pp-ink, #1c1917);
		border-radius: var(--radius);
		text-decoration: none;
		cursor: pointer;
		transition: background-color 0.15s, color 0.15s;
	}
	.btn:hover {
		background: var(--pp-surface, #f5f5f4);
	}
	.btn.primary {
		background: var(--hl);
		color: var(--on-hl);
		border-color: var(--hl);
	}
	.btn.primary:hover {
		background: color-mix(in srgb, var(--hl) 85%, var(--pp-ink, #1c1917));
	}

	/* Further materials */
	.more {
		padding: 2rem 0;
		border-bottom: 1px dotted var(--rule);
	}
	.more-video {
		margin-top: 1.5rem;
		max-width: 40rem;
	}
	.more-video h3 {
		font-size: 1.15rem;
		margin-bottom: 0.4rem;
	}
	.more-video p {
		margin: 0 0 0.75rem;
		color: var(--pp-muted, #78716c);
	}
	.files {
		list-style: none;
		margin: 1.25rem 0 0;
		padding: 0;
	}
	.files li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 0;
		border-top: 1px dotted var(--rule);
	}
	.file-title {
		display: block;
		font-family: var(--font-heading);
		font-size: 1.1rem;
		color: var(--pp-ink, #1c1917);
	}
	.file-note {
		display: block;
		font-size: 0.9rem;
		color: var(--pp-muted, #78716c);
	}

	/* Index of sessions */
	.index {
		padding-top: 2.25rem;
	}
	.index-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem 2rem;
	}
	.index-head + .group {
		margin-top: 1rem;
	}
	.group {
		margin-top: 1.75rem;
		padding-top: 0.9rem;
		border-top: 1px dotted var(--rule);
	}
	.group-label {
		font-family: var(--font-heading);
		font-style: italic;
		font-size: 1.05rem;
		color: var(--pp-muted, #78716c);
		margin-bottom: 0.9rem;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
		gap: 0.75rem;
	}
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		width: 100%;
		height: 100%;
		min-height: 11.5rem;
		padding: 0.9rem;
		text-align: left;
		background: var(--pp-card, #fff);
		color: var(--pp-ink, #1c1917);
		border: 1px solid var(--pp-border, #e7e5e4);
		border-radius: var(--radius);
		cursor: pointer;
		transition: border-color 0.15s, background-color 0.15s;
	}
	.card:hover {
		border-color: var(--pp-ink, #1c1917);
	}
	.card.active {
		background: var(--hl);
		color: var(--on-hl);
		border-color: var(--hl);
	}
	.card-art {
		display: flex;
		height: 4rem;
		margin-bottom: 0.6rem;
		opacity: 0.85;
	}
	.card.active .card-art :global(.artwork) {
		background-color: var(--on-hl) !important;
	}
	.card-number {
		font-family: var(--pp-font-display, var(--font-heading));
		font-size: 0.95rem;
		letter-spacing: 0.04em;
	}
	.card-title {
		font-family: var(--font-heading);
		font-size: 1.05rem;
		line-height: 1.2;
	}
	.card-tag {
		margin-top: auto;
		padding-top: 0.5rem;
		font-family: var(--font-ui);
		font-size: 0.75rem;
		opacity: 0.8;
	}

	.empty {
		padding-top: 4rem;
	}
	.empty p {
		margin-top: 0.5rem;
		color: var(--pp-muted, #78716c);
	}

	.leader :global(:focus-visible) {
		outline: 2px solid var(--pp-ink, #1c1917);
		outline-offset: 2px;
	}
	.screen :global(:focus-visible) {
		outline-color: var(--hl);
	}

	@media (max-width: 640px) {
		.head {
			grid-template-columns: 1fr;
		}
		.head-art {
			display: none;
		}
		.no-video {
			flex-direction: column;
			text-align: center;
			padding: 2rem 1rem;
		}
		.no-video-art :global(.artwork) {
			width: 3.5rem !important;
		}
		.files li {
			flex-direction: column;
			align-items: flex-start;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.btn,
		.card {
			transition: none;
		}
	}
</style>
