<script>
	// Questions as ruled rows; the print version leaves room to write
	let { block, print = false } = $props();
</script>

<ol class="questions" class:print>
	{#each block.items ?? [] as q, i}
		<li>
			<span class="num">{i + 1}</span>
			<span class="text">{q}</span>
			{#if print}<span class="lines" aria-hidden="true"><span></span><span></span><span></span></span>{/if}
		</li>
	{/each}
</ol>

<style>
	.questions { list-style: none; margin: 0 0 1.75rem; padding: 0; border-bottom: 1px dotted var(--pp-muted); }
	li { display: grid; grid-template-columns: 2rem 1fr; gap: 0 0.5rem; padding: 0.9rem 0; border-top: 1px dotted var(--pp-muted); break-inside: avoid; }
	.num { font-family: var(--pp-font-ui); font-size: 0.8rem; font-weight: 600; color: var(--pp-highlight-text); padding-top: 0.2rem; }
	.text { font-family: var(--pp-font-body); font-size: 1.05rem; line-height: 1.55; color: var(--pp-ink); }
	.lines { grid-column: 2; display: block; }
	.lines span { display: block; height: 1.8rem; border-bottom: 1px solid var(--pp-border); }
	.questions.print { border-bottom: 0; }
</style>
