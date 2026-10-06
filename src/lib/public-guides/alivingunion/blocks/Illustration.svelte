<script>
	// Content block: { "type": "illustration", "name": "common-tansy", "align": "right", "size": "md", "caption": "…" }
	// `name` is a key from artwork.ts. align: left | center | right (default center). size: sm | md | lg (default md).
	import GuideArtwork from '$lib/components/GuideArtwork.svelte';
	import { getFlower } from '../flowers';

	let { block } = $props();
	const flower = $derived(getFlower(block.name));
	const width = $derived({ sm: '8rem', md: '13rem', lg: '20rem' }[block.size] ?? '13rem');
</script>

{#if flower}
	<figure class="illustration {block.align ?? 'center'}">
		<GuideArtwork src={flower.src} width={flower.width} height={flower.height} size={width} label={block.caption ? '' : flower.name} />
		{#if block.caption}<figcaption>{block.caption}</figcaption>{/if}
	</figure>
{/if}

<style>
	.illustration { margin: 1.5rem 0; display: flex; flex-direction: column; break-inside: avoid; }
	.illustration.center { align-items: center; }
	.illustration.left { align-items: flex-start; }
	.illustration.right { align-items: flex-end; }
	figcaption { margin-top: 0.5rem; font-family: var(--pp-font-body); font-style: italic; font-size: 0.8rem; color: var(--pp-muted); }
</style>
