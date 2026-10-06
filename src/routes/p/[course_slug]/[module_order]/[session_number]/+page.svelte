<script>
	import { getPublicPageTheme, publicPageThemeStyle } from '$lib/config/public-page-themes';
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, module, sessions, session, pdfUrl } = $derived(data);
	const theme = $derived(getPublicPageTheme(course.slug));

	const prevSession = $derived(sessions.find(s => s.sessionNumber === session.sessionNumber - 1) ?? null);
	const nextSession = $derived(sessions.find(s => s.sessionNumber === session.sessionNumber + 1) ?? null);

	/** @param {number} n */
	const sessionLabel = (n) => (n === 0 ? 'Pre-Start' : `Session ${n}`);
	/** @param {number} n */
	const sessionNum = (n) => (n === 0 ? 'Pre-Start' : String(n));

	// A session left with its default title ("Session 2") shouldn't read "Session 2: Session 2"
	const titleIsLabel = $derived(session.title.trim().toLowerCase() === sessionLabel(session.sessionNumber).toLowerCase());

	let showMobilePicker = $state(false);
</script>

<svelte:head>
	<title>{titleIsLabel ? session.title : `${sessionLabel(session.sessionNumber)}: ${session.title}`} — {module.name}</title>
	{#each theme.fontStylesheets as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

<div class="page" style={publicPageThemeStyle(theme)}>
	<nav class="top-nav">
		<a href="/p/{course.slug}/{module.orderNumber}" class="nav-module">{module.name}</a>
		<button class="mobile-picker-btn" onclick={() => showMobilePicker = !showMobilePicker}>
			{sessionLabel(session.sessionNumber)} <span class="picker-chevron" class:open={showMobilePicker}>▾</span>
		</button>
	</nav>

	{#if showMobilePicker}
		<div class="mobile-picker-overlay" onclick={() => showMobilePicker = false}>
			<div class="mobile-picker" onclick={e => e.stopPropagation()}>
				<a href="/p/{course.slug}/{module.orderNumber}" class="mobile-picker-home" onclick={() => showMobilePicker = false}>← {module.name}</a>
				<div class="mobile-picker-divider"></div>
				{#each sessions as s}
					<a href="/p/{course.slug}/{module.orderNumber}/{s.sessionNumber}"
						class="mobile-picker-item"
						class:active={s.sessionNumber === session.sessionNumber}
						class:dim={!s.hasContent}
						onclick={() => showMobilePicker = false}>
						<span class="mobile-picker-num">{sessionNum(s.sessionNumber)}</span>{s.title}
					</a>
				{/each}
			</div>
		</div>
	{/if}

	<div class="layout">
		<aside class="sidebar">
			<div class="sidebar-inner">
				<a href="/p/{course.slug}/{module.orderNumber}" class="sidebar-home">← {module.name}</a>
				<div class="sidebar-divider"></div>
				{#each sessions as s}
					<a href="/p/{course.slug}/{module.orderNumber}/{s.sessionNumber}"
						class="sidebar-item"
						class:active={s.sessionNumber === session.sessionNumber}
						class:dim={!s.hasContent}>
						<span class="sidebar-num">{sessionNum(s.sessionNumber)}</span>
						<span>{s.title}</span>
					</a>
				{/each}
			</div>
		</aside>

		<main class="main">
			{#if !titleIsLabel}<div class="session-eyebrow">{sessionLabel(session.sessionNumber)}</div>{/if}
			<h1 class="session-title">{session.title}</h1>
			<div class="session-divider"></div>

			{#if session.blocks.length > 0}
				<div class="export-links">
					{#if pdfUrl}
						<a href={pdfUrl} class="export-link"><span class="export-icon">↓</span> Download this session (PDF)</a>
					{/if}
					<a href="/p/{course.slug}/{module.orderNumber}/print?session={session.sessionNumber}" class="export-link">Print version</a>
				</div>
			{/if}

			{#if session.blocks.length > 0}
				<PublicPageBlockRenderer blocks={session.blocks} />
			{:else}
				<p class="empty">Content coming soon.</p>
			{/if}

			<nav class="session-nav">
				{#if prevSession}
					<a href="/p/{course.slug}/{module.orderNumber}/{prevSession.sessionNumber}" class="nav-btn">
						<span class="nav-label">Previous</span>
						<span class="nav-name">← {prevSession.title}</span>
					</a>
				{:else}
					<a href="/p/{course.slug}/{module.orderNumber}" class="nav-btn">
						<span class="nav-label">Back to</span>
						<span class="nav-name">← {module.name}</span>
					</a>
				{/if}
				{#if nextSession && nextSession.hasContent}
					<a href="/p/{course.slug}/{module.orderNumber}/{nextSession.sessionNumber}" class="nav-btn next">
						<span class="nav-label">Next Session</span>
						<span class="nav-name">{nextSession.title} →</span>
					</a>
				{/if}
			</nav>
		</main>
	</div>
</div>

<style>
	.page { min-height: 100vh; background: var(--pp-bg, #faf8f5); color: var(--pp-ink, #292524); font-family: var(--pp-font-ui, 'Inter', sans-serif); font-weight: var(--pp-body-weight, 400); }
	:global(body) { margin: 0; font-family: var(--pp-font-ui, 'Inter', sans-serif); background: var(--pp-bg, #faf8f5); color: var(--pp-ink, #292524); }

	.top-nav { position: sticky; top: 0; z-index: 200; background: var(--pp-card, white); border-bottom: 1px solid var(--pp-border, #e7e5e4); padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; }
	.nav-module { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 1rem; font-weight: 500; color: var(--pp-ink, #292524); text-decoration: none; }
	.nav-module:hover { color: var(--pp-accent, #7c6a52); }
	.mobile-picker-btn { display: none; background: none; border: 1px solid var(--pp-border, #e7e5e4); border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--pp-body, #57534e); cursor: pointer; align-items: center; gap: 0.3rem; }
	.picker-chevron { transition: transform 0.15s; display: inline-block; }
	.picker-chevron.open { transform: rotate(180deg); }

	.mobile-picker-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.3); }
	.mobile-picker { position: absolute; top: 56px; left: 0; right: 0; background: var(--pp-card, white); border-bottom: 1px solid var(--pp-border, #e7e5e4); max-height: 70vh; overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; }
	.mobile-picker-home { font-size: 0.85rem; color: var(--pp-muted, #78716c); text-decoration: none; display: block; padding: 0.4rem 0; }
	.mobile-picker-divider { border-top: 1px solid var(--pp-border, #e7e5e4); margin: 0.5rem 0; }
	.mobile-picker-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0; font-size: 0.9rem; color: var(--pp-body, #44403c); text-decoration: none; border-bottom: 1px solid var(--pp-surface, #f5f5f4); }
	.mobile-picker-item.active { font-weight: 600; }
	.mobile-picker-item.dim { opacity: 0.4; pointer-events: none; }
	.mobile-picker-num { font-size: 0.7rem; color: var(--pp-highlight-text, #c9a96e); min-width: 18px; }

	.layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 56px); max-width: 1200px; margin: 0 auto; }

	.sidebar { border-right: 1px solid var(--pp-border, #e7e5e4); padding: 2rem 1.25rem; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; }
	.sidebar-inner { display: flex; flex-direction: column; gap: 0.15rem; }
	.sidebar-home { font-size: 0.8rem; color: var(--pp-muted, #78716c); text-decoration: none; padding: 0.3rem 0.5rem; display: block; }
	.sidebar-home:hover { color: var(--pp-accent, #7c6a52); }
	.sidebar-divider { border-top: 1px solid var(--pp-border, #e7e5e4); margin: 0.5rem 0; }
	.sidebar-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border-radius: 6px; font-size: 0.85rem; color: var(--pp-body, #57534e); text-decoration: none; transition: all 0.15s; }
	.sidebar-item:hover { background: var(--pp-surface, #f5f5f4); color: var(--pp-ink, #1c1917); }
	.sidebar-item.active { background: var(--pp-surface, #f5f5f4); color: var(--pp-ink, #1c1917); font-weight: 500; }
	.sidebar-item.dim { opacity: 0.35; pointer-events: none; }
	.sidebar-num { font-size: 0.7rem; color: var(--pp-muted, #a8a29e); min-width: 18px; white-space: nowrap; }
	.sidebar-item.active .sidebar-num { color: var(--pp-highlight-text, #c9a96e); }

	.main { padding: 3rem 4rem; max-width: 780px; min-width: 0; }
	.session-eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent, #a8926e); margin-bottom: 0.5rem; }
	.session-title { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 2.4rem; font-weight: 500; color: var(--pp-ink, #1c1917); line-height: 1.25; margin-bottom: 1rem; }
	.session-divider { width: 48px; height: 2px; background: var(--pp-highlight, #c9a96e); margin-bottom: 2.5rem; }
	.empty { font-family: var(--pp-font-body, 'Lora', Georgia, serif); color: var(--pp-muted, #a8a29e); font-style: italic; }

	.session-nav { display: flex; justify-content: space-between; gap: 1rem; padding: 2rem 0; margin-top: 2rem; border-top: 1px solid var(--pp-border, #e7e5e4); }
	.nav-btn { min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.75rem 1.25rem; border: 1px solid var(--pp-border, #e7e5e4); border-radius: 8px; background: var(--pp-card, white); text-decoration: none; color: var(--pp-body, #44403c); transition: all 0.15s; }
	.nav-btn:hover { border-color: var(--pp-accent, #a8926e); }
	.nav-btn.next { text-align: right; margin-left: auto; }
	.nav-label { font-size: 0.7rem; color: var(--pp-muted, #a8a29e); }
	.nav-name { font-size: 0.875rem; font-weight: 500; color: var(--pp-ink, #292524); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	@media (max-width: 768px) {
		.layout { grid-template-columns: 1fr; }
		.sidebar { display: none; }
		.mobile-picker-btn { display: flex; }
		.main { padding: 1.5rem 1.25rem; }
		.session-title { font-size: 1.8rem; }
	}
	.export-links { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 2rem; }
	.export-link { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.9rem; background: var(--pp-card, white); border: 1px solid var(--pp-border, #e7e5e4); border-radius: 8px; font-size: 0.8rem; font-weight: 500; color: var(--pp-body, #57534e); text-decoration: none; transition: all 0.15s; }
	.export-link:hover { border-color: var(--pp-highlight, #c9a96e); color: var(--pp-ink, #1c1917); }
	.export-icon { color: var(--pp-highlight-text, #c9a96e); }
</style>
