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

	const next = $derived.by(() => {
		const i = sessions.findIndex((s) => s.sessionNumber === current?.sessionNumber);
		return i >= 0 ? (sessions[i + 1] ?? null) : null;
	});

	let pickerOpen = $state(false);

	/** @param {number} n */
	const pad = (n) => String(n).padStart(2, '0');

	/** Width that gives an illustration the stated height, since the artwork is sized by width. */
	const artWidth = (art, heightRem) => `${((heightRem * art.width) / art.height).toFixed(2)}rem`;

	/** @param {number} n */
	function select(n) {
		selectedNumber = n;
		pickerOpen = false;
		const url = new URL(page.url);
		url.searchParams.set('session', String(n));
		replaceState(url, {});
		const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		document.getElementById('session-top')?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
	}

	/** @param {KeyboardEvent} e */
	function onKeydown(e) {
		if (e.key === 'Escape') pickerOpen = false;
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

<svelte:window onkeydown={onKeydown} />

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

		<div class="top" id="session-top">
			<div class="picker">
				<button type="button" class="tab" aria-haspopup="listbox" aria-expanded={pickerOpen} onclick={() => (pickerOpen = !pickerOpen)}>
					<svg class="chev" class:open={pickerOpen} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
					<span>{current.sessionNumber === 0 ? 'Start' : `Session ${current.sessionNumber}`}</span>
				</button>
				{#if pickerOpen}
					<button type="button" class="picker-scrim" aria-label="Close session list" onclick={() => (pickerOpen = false)}></button>
					<div class="menu" role="listbox" aria-label="Choose a session">
						<div class="menu-head">
							<span class="menu-title">Sessions</span>
							<button type="button" class="menu-close" aria-label="Close session list" onclick={() => (pickerOpen = false)}>
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
							</button>
						</div>
						{#each data.groups as group}
							{#if group.label}<p class="menu-group">{group.label}</p>{/if}
							{#each group.items as session (session.sessionNumber)}
								<button
									type="button"
									role="option"
									class="menu-item"
									class:active={session.sessionNumber === current.sessionNumber}
									aria-selected={session.sessionNumber === current.sessionNumber}
									onclick={() => select(session.sessionNumber)}
								>
									<span class="menu-number">{session.sessionNumber === 0 ? 'Start' : pad(session.sessionNumber)}</span>
									<span>{session.title}</span>
								</button>
							{/each}
						{/each}
					</div>
				{/if}
			</div>

			<header class="wrap head">
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
			</header>
			{#if art}
				<div class="art-clip">
					<div class="head-art">
						<GuideArtwork src={art.src} width={art.width} height={art.height} color="var(--pp-ink, #1c1917)" size={artWidth(art, 20)} />
					</div>
				</div>
			{/if}
		</div>

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
						<h2 id="share-title">Companion Guide</h2>
						<p>Send the Companion Guide to your group.<br />It has every session, and they can read it on any device without an account.</p>
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
		</div>

		{#if next}
			{@const nextArt = design.sessionArtwork?.(next.sessionNumber) ?? null}
			<button type="button" class="progress" onclick={() => select(next.sessionNumber)}>
				{#if nextArt}
					<span class="progress-art">
						<GuideArtwork src={nextArt.src} width={nextArt.width} height={nextArt.height} color="var(--pp-ink, #1c1917)" size={artWidth(nextArt, 14)} />
					</span>
				{/if}
				<span class="progress-text">
					<span class="progress-kicker">Progress to</span>
					<span class="progress-title">{next.sessionNumber === 0 ? 'Start' : `Session ${next.sessionNumber}`}</span>
				</span>
				<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
			</button>
		{/if}
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
		padding-bottom: 0;
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

	/* Session picker tab and heading */
	.top {
		position: relative;
		min-height: 24rem;
	}
	.art-clip {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.picker {
		position: relative;
		z-index: 5;
		display: inline-block;
	}
	.tab {
		display: flex;
		align-items: center;
		gap: 1.1rem;
		padding: 0.7rem 3.5rem 0.7rem 1.5rem;
		background: var(--hl);
		color: var(--on-hl);
		border: 0;
		border-bottom-right-radius: 1.6rem;
		font-family: var(--pp-font-display, var(--font-heading));
		font-size: 1.3rem;
		cursor: pointer;
	}
	.chev {
		transition: transform 0.15s;
	}
	.chev.open {
		transform: rotate(180deg);
	}
	.picker-scrim {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgb(0 0 0 / 0.4);
		border: 0;
		cursor: default;
	}
	.menu {
		position: fixed;
		z-index: 61;
		top: 0;
		left: 0;
		bottom: 0;
		width: min(24rem, 90vw);
		overflow-y: auto;
		padding: 0 0 2rem;
		background: var(--pp-card, #fff);
		box-shadow: 0 0 40px rgb(0 0 0 / 0.3);
		animation: slide-in 0.2s ease-out;
	}
	.menu-head {
		position: sticky;
		top: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem 1.25rem;
		background: var(--hl);
		color: var(--on-hl);
	}
	.menu-title {
		font-family: var(--pp-font-display, var(--font-heading));
		font-size: 1.3rem;
	}
	.menu-close {
		display: flex;
		padding: 0.25rem;
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
	}
	@keyframes slide-in {
		from { transform: translateX(-100%); }
		to { transform: none; }
	}
	.menu-group {
		margin: 0.75rem 1.25rem 0.25rem;
		font-style: italic;
		font-size: 0.9rem;
		color: var(--pp-muted, #78716c);
	}
	.menu-item {
		display: flex;
		gap: 0.9rem;
		align-items: baseline;
		width: 100%;
		padding: 0.55rem 1.25rem;
		text-align: left;
		background: transparent;
		border: 0;
		color: var(--pp-ink, #1c1917);
		font-family: var(--font-heading);
		font-size: 1.05rem;
		cursor: pointer;
	}
	.menu-item:hover {
		background: var(--pp-surface, #f5f5f4);
	}
	.menu-item.active {
		background: var(--hl);
		color: var(--on-hl);
	}
	.menu-number {
		min-width: 2.2rem;
		font-family: var(--pp-font-display, var(--font-heading));
		font-size: 0.95rem;
	}
	.head {
		position: relative;
		z-index: 1;
		padding-top: clamp(1.5rem, 4vw, 3rem);
		padding-bottom: clamp(2.5rem, 6vw, 5rem);
	}
	.head-text {
		max-width: 38rem;
	}
	.head-art {
		position: absolute;
		right: clamp(-3rem, -2vw, 0rem);
		bottom: -2.5rem;
		width: min(40vw, 30rem);
		display: flex;
		justify-content: flex-end;
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
		max-width: 18ch;
	}
	.lead {
		margin: 1rem 0 0;
		max-width: 58ch;
		font-size: 1.05rem;
		color: var(--pp-muted, #78716c);
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
		padding: 4rem 0;
	}
	.share h2,
	.more h2 {
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

	/* Progress band */
	.progress {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 1.25rem;
		width: 100%;
		min-height: 14rem;
		padding: 2rem clamp(1.5rem, 8vw, 7rem);
		overflow: hidden;
		background: var(--hl);
		color: var(--on-hl);
		border: 0;
		text-align: right;
		cursor: pointer;
	}
	.progress-art {
		position: absolute;
		left: 0;
		bottom: -3rem;
		display: flex;
	}
	.progress-text {
		position: relative;
		display: flex;
		flex-direction: column;
		font-family: var(--font-heading);
	}
	.progress-kicker {
		font-size: 1.6rem;
		line-height: 1.2;
	}
	.progress-title {
		font-size: clamp(2.2rem, 5vw, 3.2rem);
		line-height: 1.1;
	}
	.progress svg {
		position: relative;
		flex: none;
	}
	.progress:hover svg {
		transform: translateX(4px);
	}
	.progress svg {
		transition: transform 0.15s;
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
		.head-art {
			width: 9rem;
			opacity: 0.35;
		}
		.progress-art {
			opacity: 0.4;
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
		.menu {
			animation: none;
		}
		.btn,
		.chev,
		.progress svg {
			transition: none;
		}
	}
</style>
