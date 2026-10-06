<script>
	import PublicSessionNumber from '$lib/components/PublicSessionNumber.svelte';
	import { getPublicGuideDesign } from '$lib/public-guides';
	import { publicPageThemeStyle } from '$lib/public-guides/theme';
	import { groupSessionsBySection } from '$lib/public-guides/sections';
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, module, sessions, single } = $derived(data);
	const design = $derived(getPublicGuideDesign(course.slug));
	const theme = $derived(design.theme);
	const groups = $derived(groupSessionsBySection(sessions));

	const sameName = $derived(module.name.trim().toLowerCase() === course.name.trim().toLowerCase());

	/** @param {number} n */
	const sessionLabel = (n) => (n === 0 ? 'Pre-Start' : `Session ${n}`);

	/** @param {{ sessionNumber: number; title: string }} s */
	const titleIsLabel = (s) => s.title.trim().toLowerCase() === sessionLabel(s.sessionNumber).toLowerCase();
</script>

<svelte:head>
	<title>{single ? `${sessions[0].title} — ${module.name}` : module.name}</title>
	<meta name="robots" content="noindex" />
	{#each theme.fontStylesheets as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

<div class="print-doc" style={publicPageThemeStyle(theme, { print: true })}>
	<div class="toolbar">
		<a href="/p/{course.slug}/{module.orderNumber}{single ? `/${sessions[0].sessionNumber}` : ''}" class="toolbar-back">← Back</a>
		<button class="toolbar-print" onclick={() => window.print()}>Print / Save as PDF</button>
	</div>

	{#if !single}
		{#if design.components.PrintCover}
			{@const PrintCover = design.components.PrintCover}
			<PrintCover {course} {module} {sessions} />
		{:else}
			<header class="cover">
				<div class="eyebrow">{sameName ? 'Companion Guide' : course.name}</div>
				<h1 class="cover-title">{module.name}</h1>
				{#if module.description}<p class="cover-desc">{module.description}</p>{/if}
				<div class="rule"></div>
			</header>
		{/if}

		{#if module.blocks.length > 0}
			<PublicPageBlockRenderer blocks={module.blocks} overrides={design.blocks} print />
		{/if}

		{#if sessions.length > 0}
			<section class="contents">
				<h2 class="contents-heading">Contents</h2>
				<ol class="contents-list">
					{#each groups as group}
						{#if group.label}<li class="contents-section">{group.label}</li>{/if}
						{#each group.items as s}
							<li>
								<span class="contents-num"><PublicSessionNumber n={s.sessionNumber} /></span>
								<span>{s.title}</span>
							</li>
						{/each}
					{/each}
				</ol>
			</section>
		{/if}
	{/if}

	{#each sessions as s}
		<section class="session" class:new-page={!single}>
			{#if design.components.SessionHeader}
				{@const SessionHeader = design.components.SessionHeader}
				<SessionHeader {course} {module} session={s} print />
			{:else}
				<div class="eyebrow">{[module.name, titleIsLabel(s) ? null : sessionLabel(s.sessionNumber), s.sectionName].filter(Boolean).join(' · ')}</div>
				<h1 class="session-title">{s.title}</h1>
				<div class="rule"></div>
			{/if}
			<PublicPageBlockRenderer blocks={s.blocks} overrides={design.blocks} print />
		</section>
	{/each}
</div>

<style>
	/* The app footer belongs to the site, not the document */
	:global(body:has(.print-doc) footer) { display: none; }
	:global(body:has(.print-doc) .min-h-screen) { background: var(--pp-card, white); min-height: 0; }

	.print-doc { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.5rem 4rem; background: var(--pp-card, white); color: var(--pp-ink, #292524); font-family: var(--pp-font-ui, 'Inter', sans-serif); font-weight: var(--pp-body-weight, 400); }

	.toolbar { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; margin-bottom: 2rem; border-bottom: 1px solid var(--pp-border, #e7e5e4); }
	.toolbar-back { font-size: 0.85rem; color: var(--pp-muted, #78716c); text-decoration: none; }
	.toolbar-back:hover { color: var(--pp-ink, #1c1917); }
	.toolbar-print { font-family: var(--pp-font-ui, 'Inter', sans-serif); font-size: 0.85rem; font-weight: 500; color: var(--pp-body, #44403c); background: var(--pp-surface, #f5f5f4); border: 1px solid var(--pp-border, #e7e5e4); border-radius: var(--pp-radius, 8px); padding: 0.5rem 1rem; cursor: pointer; }
	.toolbar-print:hover { background: var(--pp-surface, #ece9e6); border-color: var(--pp-highlight, #c9a96e); }

	.eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent, #a8926e); margin-bottom: 0.5rem; }
	.cover-title { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 2.6rem; font-weight: 500; color: var(--pp-ink, #1c1917); line-height: 1.15; }
	.cover-desc { font-family: var(--pp-font-body, 'Lora', Georgia, serif); font-style: italic; font-size: 1.1rem; color: var(--pp-muted, #78716c); margin-top: 0.75rem; }
	.session-title { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 2rem; font-weight: 500; color: var(--pp-ink, #1c1917); line-height: 1.2; }
	.rule { width: 48px; height: 2px; background: var(--pp-highlight, #c9a96e); margin: 1.25rem 0 1.75rem; }

	.contents { margin-top: 2.5rem; break-inside: avoid; }
	.contents-heading { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent, #7c6a52); padding-bottom: 0.5rem; border-bottom: 1px solid var(--pp-border, #e7e5e4); margin-bottom: 0.5rem; }
	.contents-list { list-style: none; padding: 0; }
	.contents-list li { display: flex; gap: 1rem; padding: 0.45rem 0; border-bottom: 1px solid var(--pp-surface, #f5f5f4); font-family: var(--pp-font-body, 'Lora', Georgia, serif); font-size: 0.95rem; color: var(--pp-body, #44403c); }
	.contents-num { font-family: var(--pp-font-ui, 'Inter', sans-serif); font-size: 0.75rem; color: var(--pp-highlight-text, #c9a96e); min-width: 2rem; padding-top: 2px; }

	.session { margin-top: 4rem; }
	.session:first-child, .toolbar + .session { margin-top: 0; }

	@media print {
		.toolbar { display: none; }
		.print-doc { max-width: none; margin: 0; padding: 0; }
		.session { margin-top: 0; }
		.session.new-page { break-before: page; }
	}
	.contents-list li.contents-section { display: block; border-bottom: none; padding: 0.9rem 0 0.2rem; font-style: italic; font-size: 0.9rem; color: var(--pp-muted, #78716c); }
</style>
