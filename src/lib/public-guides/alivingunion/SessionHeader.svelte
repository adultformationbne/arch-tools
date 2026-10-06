<script>
	// A ruled band, like a book's chapter opener: where you are on the left, the title
	// in the middle, the session's flower as a small ink drawing on the right.
	import GuideArtwork from '$lib/components/GuideArtwork.svelte';
	import { flowerForSession } from './flowers';

	let { session, print = false } = $props();
	const flower = $derived(flowerForSession(session.sessionNumber));
	const isPreStart = $derived(session.sessionNumber === 0);
</script>

<header class="band" class:print>
	<div class="where">
		{#if isPreStart}
			<span class="kicker">Pre-Start</span>
		{:else}
			<span class="kicker">Session</span>
			<span class="number">{String(session.sessionNumber).padStart(2, '0')}</span>
		{/if}
		{#if session.sectionName}<span class="section">{session.sectionName}</span>{/if}
	</div>
	<h1 class="title">{session.title}</h1>
	{#if flower}
		<div class="flower">
			<GuideArtwork src={flower.src} width={flower.width} height={flower.height} color="var(--pp-ink)" />
		</div>
	{/if}
</header>

<style>
	.band {
		display: grid;
		grid-template-columns: 8.5rem 1fr 5.5rem;
		align-items: center;
		gap: 1.5rem;
		padding: 1.5rem 0;
		margin-bottom: 2rem;
		border-top: 1px dotted var(--pp-muted);
		border-bottom: 1px dotted var(--pp-muted);
		break-inside: avoid;
	}
	.where { display: flex; flex-direction: column; align-self: stretch; justify-content: center; padding-right: 1.5rem; border-right: 1px dotted var(--pp-muted); }
	.kicker { font-family: var(--pp-font-ui); font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent); }
	.number { font-family: var(--pp-font-heading); font-size: 2.6rem; font-weight: 400; line-height: 1.05; color: var(--pp-ink); }
	.section { margin-top: 0.4rem; font-family: var(--pp-font-body); font-style: italic; font-size: 0.82rem; line-height: 1.3; color: var(--pp-muted); }
	.title { font-family: var(--pp-font-heading); font-size: clamp(1.9rem, 4vw, 2.7rem); font-weight: 400; line-height: 1.1; letter-spacing: -0.01em; color: var(--pp-ink); margin: 0; }
	.band.print .title { font-size: 2.1rem; }

	@media (max-width: 640px) {
		.band { grid-template-columns: 1fr 4rem; gap: 0.75rem 1rem; }
		.where { grid-column: 1 / -1; flex-direction: row; align-items: baseline; gap: 0.5rem; padding: 0 0 0.75rem; border-right: 0; border-bottom: 1px dotted var(--pp-muted); }
		.number { font-size: 1.1rem; }
		.section { margin: 0 0 0 auto; text-align: right; }
	}
</style>
