<script>
	// The teaching summary as one large statement
	let { block } = $props();
</script>

<p class="statement">{block.content}</p>

<style>
	.statement { margin: 0 0 1.75rem; font-family: var(--pp-font-heading); font-size: clamp(1.3rem, 2.6vw, 1.6rem); font-weight: 400; line-height: 1.35; letter-spacing: -0.005em; color: var(--pp-ink); break-inside: avoid; }
</style>
