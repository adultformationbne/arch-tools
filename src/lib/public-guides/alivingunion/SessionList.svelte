<script>
	// The landing page's list of sessions, set like a contents page: section tags,
	// then a ruled row per session.
	import PublicSessionNumber from '$lib/components/PublicSessionNumber.svelte';

	let { course, module, groups } = $props();
</script>

<div class="contents">
	{#each groups as group}
		{#if group.label}<h3 class="tag"><span>{group.label}</span></h3>{/if}
		<ol class="rows">
			{#each group.items as s}
				<li>
					{#if s.hasContent}
						<a class="row" href="/p/{course.slug}/{module.orderNumber}/{s.sessionNumber}">
							<span class="num"><PublicSessionNumber n={s.sessionNumber} /></span>
							<span class="name">{s.title}</span>
							<span class="arrow" aria-hidden="true">→</span>
						</a>
					{:else}
						<span class="row dim">
							<span class="num"><PublicSessionNumber n={s.sessionNumber} /></span>
							<span class="name">{s.title}</span>
						</span>
					{/if}
				</li>
			{/each}
		</ol>
	{/each}
</div>

<style>
	.tag { margin: 2rem 0 0.6rem; }
	.tag span { display: inline-block; padding: 0.3rem 0.55rem; background: var(--pp-summary-bg); color: var(--pp-ink); font-family: var(--pp-font-ui); font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
	.rows { list-style: none; margin: 0; padding: 0; border-bottom: 1px dotted var(--pp-muted); }
	.row { display: grid; grid-template-columns: 2.25rem 1fr auto; align-items: baseline; gap: 0.5rem; padding: 0.85rem 0; border-top: 1px dotted var(--pp-muted); color: var(--pp-ink); text-decoration: none; }
	.num { font-family: var(--pp-font-ui); font-size: 0.8rem; font-weight: 600; color: var(--pp-highlight-text); }
	.name { font-family: var(--pp-font-heading); font-size: 1.3rem; font-weight: 400; line-height: 1.25; }
	.arrow { color: var(--pp-muted); transition: transform 0.15s; }
	a.row:hover .arrow { transform: translateX(4px); color: var(--pp-ink); }
	a.row:hover .name { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 0.2em; }
	.row.dim { opacity: 0.4; }
</style>
