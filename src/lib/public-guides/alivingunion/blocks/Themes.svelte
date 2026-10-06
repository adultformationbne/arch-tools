<script>
	// Key themes ("accordion" blocks) as flat cards, all open: nothing to click, and
	// the same on paper as on screen. Ode is kept for these headings only.
	let { block } = $props();

	/** "1. The Gospel as Good News" → ["1", "The Gospel as Good News"] */
	const split = (title) => {
		const m = /^(\d+)[.)]\s+(.*)$/.exec(title ?? '');
		return m ? [m[1], m[2]] : [null, title ?? ''];
	};
</script>

<div class="themes">
	{#each block.items ?? [] as item}
		{@const [num, name] = split(item.title)}
		<section class="card">
			{#if num}<span class="num">{num.padStart(2, '0')}</span>{/if}
			<h3>{name}</h3>
			<ul>
				{#each item.points ?? (item.content ? [item.content] : []) as point}
					<li>{point}</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.themes { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.75rem; }
	.card { padding: 1.25rem 1.25rem 1rem; background: var(--pp-surface); break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	.num { display: block; font-family: var(--pp-font-ui); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; color: var(--pp-accent); margin-bottom: 0.4rem; }
	h3 { font-family: var(--pp-font-display); font-size: 1.45rem; font-weight: 400; line-height: 1.15; color: var(--pp-ink); margin: 0 0 0.75rem; }
	ul { list-style: none; margin: 0; padding: 0; }
	li { padding: 0.5rem 0; border-top: 1px dotted var(--pp-muted); font-family: var(--pp-font-body); font-size: 0.92rem; line-height: 1.5; color: var(--pp-body); }
	@media (max-width: 640px) {
		.themes { grid-template-columns: 1fr; }
	}
</style>
