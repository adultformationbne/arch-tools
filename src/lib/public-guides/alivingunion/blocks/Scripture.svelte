<script>
	// Scripture references as a plain run of text between rules
	let { block } = $props();
</script>

<div class="scripture">
	<span class="label">Scripture</span>
	<p>{(block.items ?? []).join('  ·  ')}</p>
</div>

<style>
	.scripture { display: grid; grid-template-columns: 6.5rem 1fr; gap: 1rem; padding: 0.9rem 0; margin-bottom: 1.75rem; border-top: 1px dotted var(--pp-muted); border-bottom: 1px dotted var(--pp-muted); break-inside: avoid; }
	.label { font-family: var(--pp-font-ui); font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--pp-accent); padding-top: 0.25rem; }
	p { margin: 0; white-space: pre-wrap; font-family: var(--pp-font-body); font-size: 0.92rem; line-height: 1.7; color: var(--pp-body); }
	@media (max-width: 640px) {
		.scripture { grid-template-columns: 1fr; gap: 0.3rem; }
	}
</style>
