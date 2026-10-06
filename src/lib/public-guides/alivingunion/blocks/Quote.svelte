<script>
	let { block } = $props();
</script>

<blockquote class="quote">
	<p>{block.content}</p>
	{#if block.attribution}<cite>{block.attribution}</cite>{/if}
</blockquote>

<style>
	.quote { margin: 1rem 0 2rem; break-inside: avoid; }
	p { font-family: var(--pp-font-heading); font-style: italic; font-size: clamp(1.2rem, 2.4vw, 1.45rem); font-weight: 400; line-height: 1.4; color: var(--pp-ink); margin: 0; }
	cite { display: block; margin-top: 0.75rem; font-family: var(--pp-font-ui); font-style: normal; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--pp-accent); }
</style>
