<script>
	// The cover flower in the open margin beside the landing page, as on alivingunion.com.
	// Session pages carry their flower in the header instead. Only shown where the
	// screen is wide enough to have a margin.
	import GuideArtwork from '$lib/components/GuideArtwork.svelte';
	import { COVER_FLOWER, getFlower } from './flowers';

	let { session = null } = $props();
	const flower = getFlower(COVER_FLOWER);
</script>

{#if flower && !session}
	<div class="backdrop">
		<GuideArtwork src={flower.src} width={flower.width} height={flower.height} opacity={0.75} />
	</div>
{/if}

<style>
	/* Starts just past the reading column (the layout is 1200px wide and centred) and
	   is allowed to run off the right edge of the screen */
	.backdrop { display: none; position: absolute; top: 8rem; left: calc(50% + 400px); width: 27rem; pointer-events: none; }
	@media (min-width: 1280px) {
		.backdrop { display: block; }
	}
</style>
