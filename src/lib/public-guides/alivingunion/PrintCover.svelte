<script>
	import GuideArtwork from '$lib/components/GuideArtwork.svelte';
	import { COVER_FLOWER, getFlower } from './flowers';

	let { module } = $props();
	const flower = getFlower(COVER_FLOWER);
</script>

<header class="cover">
	<div class="text">
		<div class="eyebrow">Companion Guide</div>
		<h1 class="wordmark">
			<img src="/sites/alivingunion/wordmark.webp" alt={module.name} width="1096" height="538" />
		</h1>
		{#if module.description}<p class="desc">{module.description}</p>{/if}
	</div>
	{#if flower}
		<div class="flower"><GuideArtwork src={flower.src} width={flower.width} height={flower.height} /></div>
	{/if}
</header>

<style>
	.cover { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; padding-bottom: 1.5rem; margin-bottom: 1.75rem; border-bottom: 1px dotted var(--pp-muted); }
	.eyebrow { font-family: var(--pp-font-ui); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent); margin-bottom: 0.5rem; }
	.wordmark { margin: 0.75rem 0 1.25rem; }
	.wordmark img { display: block; width: 18rem; height: auto; }
	.desc { font-family: var(--pp-font-body); font-style: italic; font-size: 1.1rem; color: var(--pp-muted); }
	.flower { flex: 0 0 11rem; }
</style>
