<script>
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, module, sessions, single } = $derived(data);

	const sameName = $derived(module.name.trim().toLowerCase() === course.name.trim().toLowerCase());

	/** @param {number} n */
	const sessionLabel = (n) => (n === 0 ? 'Pre-Start' : `Session ${n}`);

	/** @param {{ sessionNumber: number; title: string }} s */
	const titleIsLabel = (s) => s.title.trim().toLowerCase() === sessionLabel(s.sessionNumber).toLowerCase();
</script>

<svelte:head>
	<title>{single ? `${sessions[0].title} — ${module.name}` : module.name}</title>
	<meta name="robots" content="noindex" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="print-doc">
	<div class="toolbar">
		<a href="/p/{course.slug}/{module.orderNumber}{single ? `/${sessions[0].sessionNumber}` : ''}" class="toolbar-back">← Back</a>
		<button class="toolbar-print" onclick={() => window.print()}>Print / Save as PDF</button>
	</div>

	{#if !single}
		<header class="cover">
			<div class="eyebrow">{sameName ? 'Companion Guide' : course.name}</div>
			<h1 class="cover-title">{module.name}</h1>
			{#if module.description}<p class="cover-desc">{module.description}</p>{/if}
			<div class="rule"></div>
		</header>

		{#if module.blocks.length > 0}
			<PublicPageBlockRenderer blocks={module.blocks} print />
		{/if}

		{#if sessions.length > 0}
			<section class="contents">
				<h2 class="contents-heading">Contents</h2>
				<ol class="contents-list">
					{#each sessions as s}
						<li>
							<span class="contents-num">{s.sessionNumber === 0 ? 'Pre-Start' : s.sessionNumber}</span>
							<span>{s.title}</span>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/if}

	{#each sessions as s}
		<section class="session" class:new-page={!single}>
			<div class="eyebrow">{titleIsLabel(s) ? module.name : `${module.name} · ${sessionLabel(s.sessionNumber)}`}</div>
			<h1 class="session-title">{s.title}</h1>
			<div class="rule"></div>
			<PublicPageBlockRenderer blocks={s.blocks} print />
		</section>
	{/each}
</div>

<style>
	/* The app footer belongs to the site, not the document */
	:global(body:has(.print-doc) footer) { display: none; }
	:global(body:has(.print-doc) .min-h-screen) { background: white; min-height: 0; }

	.print-doc { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.5rem 4rem; background: white; font-family: 'Inter', sans-serif; }

	.toolbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; margin-bottom: 2rem; border-bottom: 1px solid #e7e5e4; }
	.toolbar-back { font-size: 0.85rem; color: #78716c; text-decoration: none; }
	.toolbar-back:hover { color: #1c1917; }
	.toolbar-print { font-family: 'Inter', sans-serif; font-size: 0.85rem; font-weight: 500; color: #44403c; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 8px; padding: 0.5rem 1rem; cursor: pointer; }
	.toolbar-print:hover { background: #ece9e6; border-color: #c9a96e; }

	.eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #a8926e; margin-bottom: 0.5rem; }
	.cover-title { font-family: 'Lora', Georgia, serif; font-size: 2.6rem; font-weight: 500; color: #1c1917; line-height: 1.15; }
	.cover-desc { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 1.1rem; color: #78716c; margin-top: 0.75rem; }
	.session-title { font-family: 'Lora', Georgia, serif; font-size: 2rem; font-weight: 500; color: #1c1917; line-height: 1.2; }
	.rule { width: 48px; height: 2px; background: #c9a96e; margin: 1.25rem 0 1.75rem; }

	.contents { margin-top: 2.5rem; break-inside: avoid; }
	.contents-heading { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #7c6a52; padding-bottom: 0.5rem; border-bottom: 1px solid #e7e5e4; margin-bottom: 0.5rem; }
	.contents-list { list-style: none; padding: 0; }
	.contents-list li { display: flex; gap: 1rem; padding: 0.45rem 0; border-bottom: 1px solid #f5f5f4; font-family: 'Lora', Georgia, serif; font-size: 0.95rem; color: #44403c; }
	.contents-num { font-family: 'Inter', sans-serif; font-size: 0.75rem; color: #c9a96e; min-width: 4.5rem; padding-top: 2px; }

	.session { margin-top: 4rem; }
	.session:first-child, .toolbar + .session { margin-top: 0; }

	@media print {
		.toolbar { display: none; }
		.print-doc { max-width: none; margin: 0; padding: 0; }
		.session { margin-top: 0; }
		.session.new-page { break-before: page; }
	}
</style>
