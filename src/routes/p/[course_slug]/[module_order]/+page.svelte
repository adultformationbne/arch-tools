<script>
	import { getPublicPageTheme, publicPageThemeStyle } from '$lib/config/public-page-themes';
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, module, sessions, pdfUrl } = $derived(data);
	const theme = $derived(getPublicPageTheme(course.slug));

	// The module is the whole experience: no links out to other modules or a course
	// home. A one-module course usually shares its name with the module, so only
	// show the course name when it adds something.
	const sameName = $derived(module.name.trim().toLowerCase() === course.name.trim().toLowerCase());

	/** @param {number} n */
	const sessionLabel = (n) => (n === 0 ? 'Pre-Start' : String(n));

	let showMobilePicker = $state(false);
</script>

<svelte:head>
	<title>{sameName ? module.name : `${module.name} — ${course.name}`}</title>
	{#each theme.fontStylesheets as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

<div class="page" style={publicPageThemeStyle(theme)}>
	<nav class="top-nav">
		<span class="nav-course">{module.name}</span>
		<button class="mobile-picker-btn" onclick={() => showMobilePicker = !showMobilePicker}>
			Sessions <span class="picker-chevron" class:open={showMobilePicker}>▾</span>
		</button>
	</nav>

	{#if showMobilePicker}
		<div class="mobile-picker-overlay" onclick={() => showMobilePicker = false}>
			<div class="mobile-picker" onclick={e => e.stopPropagation()}>
				{#each sessions as s}
					<a href="/p/{course.slug}/{module.orderNumber}/{s.sessionNumber}" class="mobile-picker-item"
						class:dim={!s.hasContent}
						onclick={() => showMobilePicker = false}>
						<span class="mobile-picker-num">{sessionLabel(s.sessionNumber)}</span>{s.title}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<div class="layout">
		<aside class="sidebar">
			<div class="sidebar-inner">
				<p class="sidebar-section-label">Sessions</p>
				{#each sessions as s}
					<a href="/p/{course.slug}/{module.orderNumber}/{s.sessionNumber}" class="sidebar-item" class:dim={!s.hasContent}>
						<span class="sidebar-num">{sessionLabel(s.sessionNumber)}</span>
						<span>{s.title}</span>
					</a>
				{/each}
			</div>
		</aside>

		<main class="main">
			<div class="module-eyebrow">{sameName ? 'Course Guide' : course.name}</div>
			{#if theme.wordmark && sameName}
				<h1 class="module-wordmark">
					<img src={theme.wordmark.src} alt={module.name} width={theme.wordmark.width} height={theme.wordmark.height} />
				</h1>
			{:else}
				<h1 class="module-title">{module.name}</h1>
			{/if}
			<div class="title-divider"></div>

			<div class="export-links">
				{#if pdfUrl}
					<a href={pdfUrl} class="export-link"><span class="export-icon">↓</span> Download the full guide (PDF)</a>
				{/if}
				<a href="/p/{course.slug}/{module.orderNumber}/print" class="export-link">Print version</a>
			</div>

			{#if module.blocks.length > 0}
				<PublicPageBlockRenderer blocks={module.blocks} />
				<hr class="section-break" />
			{/if}

			<h2 class="sessions-heading">Sessions</h2>
			<div class="session-list">
				{#each sessions as session}
					{#if session.hasContent}
						<a href="/p/{course.slug}/{module.orderNumber}/{session.sessionNumber}" class="session-card">
							<span class="session-num">{sessionLabel(session.sessionNumber)}</span>
							<div class="session-text">
								<p class="session-title">{session.title}</p>
								{#if session.description}<p class="session-desc">{session.description}</p>{/if}
							</div>
							<span class="session-arrow">→</span>
						</a>
					{:else}
						<div class="session-card dim">
							<span class="session-num">{sessionLabel(session.sessionNumber)}</span>
							<div class="session-text">
								<p class="session-title">{session.title}</p>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</main>
	</div>
</div>

<style>
	.page { min-height: 100vh; background: var(--pp-bg, #faf8f5); color: var(--pp-ink, #292524); font-family: var(--pp-font-ui, 'Inter', sans-serif); font-weight: var(--pp-body-weight, 400); }
	:global(body) { margin: 0; font-family: var(--pp-font-ui, 'Inter', sans-serif); background: var(--pp-bg, #faf8f5); color: var(--pp-ink, #292524); }

	.top-nav { position: sticky; top: 0; z-index: 200; background: var(--pp-card, white); border-bottom: 1px solid var(--pp-border, #e7e5e4); padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; }
	.nav-course { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 1rem; font-weight: 500; color: var(--pp-ink, #292524); text-decoration: none; }
	.nav-course:hover { color: var(--pp-accent, #7c6a52); }
	.mobile-picker-btn { display: none; background: none; border: 1px solid var(--pp-border, #e7e5e4); border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--pp-body, #57534e); cursor: pointer; align-items: center; gap: 0.3rem; }
	.picker-chevron { transition: transform 0.15s; display: inline-block; }
	.picker-chevron.open { transform: rotate(180deg); }

	.mobile-picker-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.3); }
	.mobile-picker { position: absolute; top: 56px; left: 0; right: 0; background: var(--pp-card, white); border-bottom: 1px solid var(--pp-border, #e7e5e4); max-height: 70vh; overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; }
	.mobile-picker-home { font-size: 0.85rem; color: var(--pp-muted, #78716c); text-decoration: none; display: block; padding: 0.4rem 0; }
	.mobile-picker-divider { border-top: 1px solid var(--pp-border, #e7e5e4); margin: 0.5rem 0; }
	.mobile-picker-section { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--pp-muted, #a8a29e); padding: 0.5rem 0 0.2rem; }
	.mobile-picker-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0; font-size: 0.9rem; color: var(--pp-body, #44403c); text-decoration: none; border-bottom: 1px solid var(--pp-surface, #f5f5f4); }
	.mobile-picker-item.dim { opacity: 0.35; pointer-events: none; }
	.mobile-picker-num { font-size: 0.7rem; color: var(--pp-highlight-text, #c9a96e); min-width: 18px; }

	.layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 56px); max-width: 1200px; margin: 0 auto; }

	.sidebar { border-right: 1px solid var(--pp-border, #e7e5e4); padding: 2rem 1.25rem; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; }
	.sidebar-inner { display: flex; flex-direction: column; gap: 0.15rem; }
	.sidebar-home { font-size: 0.8rem; color: var(--pp-muted, #78716c); text-decoration: none; padding: 0.3rem 0.5rem; display: block; }
	.sidebar-home:hover { color: var(--pp-accent, #7c6a52); }
	.sidebar-divider { border-top: 1px solid var(--pp-border, #e7e5e4); margin: 0.5rem 0; }
	.sidebar-section-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--pp-muted, #a8a29e); padding: 0.6rem 0.5rem 0.3rem; }
	.sidebar-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border-radius: 6px; font-size: 0.85rem; color: var(--pp-body, #57534e); text-decoration: none; transition: all 0.15s; }
	.sidebar-item:hover { background: var(--pp-surface, #f5f5f4); color: var(--pp-ink, #1c1917); }
	.sidebar-item.dim { opacity: 0.35; pointer-events: none; }
	.sidebar-num { font-size: 0.7rem; color: var(--pp-muted, #a8a29e); min-width: 18px; white-space: nowrap; }

	.main { padding: 3rem 4rem; max-width: 780px; }
	.module-eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent, #a8926e); margin-bottom: 0.5rem; }
	.module-title { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 2.4rem; font-weight: 500; color: var(--pp-ink, #1c1917); line-height: 1.25; margin-bottom: 1rem; }
	.title-divider { width: 48px; height: 2px; background: var(--pp-highlight, #c9a96e); margin-bottom: 2.5rem; }
	.section-break { border: none; border-top: 1px solid var(--pp-border, #e7e5e4); margin: 2.5rem 0; }

	.sessions-heading { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent, #7c6a52); margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--pp-border, #e7e5e4); }
	.session-list { display: flex; flex-direction: column; gap: 0.6rem; }
	.session-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; background: var(--pp-card, white); border: 1px solid var(--pp-border, #e7e5e4); border-radius: 10px; text-decoration: none; color: inherit; transition: all 0.15s; }
	.session-card:not(.dim):hover { border-color: var(--pp-accent, #a8926e); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
	.session-card.dim { opacity: 0.45; }
	.session-num { font-size: 0.75rem; font-weight: 600; color: var(--pp-highlight-text, #c9a96e); min-width: 24px; flex-shrink: 0; }
	.session-text { flex: 1; min-width: 0; }
	.session-title { font-size: 0.95rem; font-weight: 500; color: var(--pp-ink, #1c1917); margin-bottom: 0.1rem; }
	.session-desc { font-size: 0.8rem; color: var(--pp-muted, #78716c); line-height: 1.5; }
	.session-arrow { color: var(--pp-muted, #a8a29e); flex-shrink: 0; }

	@media (max-width: 768px) {
		.layout { grid-template-columns: 1fr; }
		.sidebar { display: none; }
		.mobile-picker-btn { display: flex; }
		.main { padding: 1.5rem 1.25rem; }
		.module-title { font-size: 1.8rem; }
	}
	.export-links { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 2rem; }
	.export-link { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.9rem; background: var(--pp-card, white); border: 1px solid var(--pp-border, #e7e5e4); border-radius: 8px; font-size: 0.8rem; font-weight: 500; color: var(--pp-body, #57534e); text-decoration: none; transition: all 0.15s; }
	.export-link:hover { border-color: var(--pp-highlight, #c9a96e); color: var(--pp-ink, #1c1917); }
	.export-icon { color: var(--pp-highlight-text, #c9a96e); }
	.module-wordmark { margin: 0.75rem 0 1.5rem; }
	.module-wordmark img { display: block; width: min(100%, 22rem); height: auto; }
</style>
