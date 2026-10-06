<script>
	// Section label as a highlighter tag
	let { block } = $props();
</script>

<h2 class="tag" id={block.anchor}><span>{block.content}</span></h2>

<style>
	.tag { margin: 2.75rem 0 1rem; break-after: avoid; scroll-margin-top: 80px; }
	.tag span { display: inline-block; padding: 0.3rem 0.55rem; background: var(--pp-summary-bg); color: var(--pp-ink); font-family: var(--pp-font-ui); font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
