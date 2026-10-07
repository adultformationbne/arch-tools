<script>
	import { getPublicGuideDesign } from '$lib/public-guides';
	import { publicPageThemeStyle } from '$lib/public-guides/theme';
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, module, sessions, session, pdfUrl } = $derived(data);
	// A course can bring its own theme, components and block overrides — see $lib/public-guides
	const design = $derived(getPublicGuideDesign(course.slug));
	const theme = $derived(design.theme);

	const prevSession = $derived(sessions.find(s => s.sessionNumber === session.sessionNumber - 1) ?? null);
	const nextSession = $derived(sessions.find(s => s.sessionNumber === session.sessionNumber + 1) ?? null);

	/** @param {number} n */
	const sessionLabel = (n) => (n === 0 ? 'Pre-Start' : `Session ${n}`);

	// A session left with its default title ("Session 2") shouldn't read "Session 2: Session 2"
	const titleIsLabel = $derived(session.title.trim().toLowerCase() === sessionLabel(session.sessionNumber).toLowerCase());

	// The side navigation lists the parts of this session — its section headings — and
	// the way back to the list of sessions. Each heading block gets an anchor to jump to.
	const blocks = $derived.by(() => {
		const used = new Set();
		return session.blocks.map((block) => {
			if (block.type !== 'title' || !block.content) return block;
			const base = 'part-' + block.content.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
			let anchor = base;
			for (let n = 2; used.has(anchor); n++) anchor = `${base}-${n}`;
			used.add(anchor);
			return { ...block, anchor };
		});
	});
	const parts = $derived(blocks.filter((b) => b.anchor).map((b) => ({ anchor: b.anchor, label: b.content })));

	// Highlight the part being read: the last heading to have passed the top of the screen
	let activePart = $state('');
	$effect(() => {
		const anchors = parts.map((p) => p.anchor);
		const update = () => {
			let current = '';
			for (const anchor of anchors) {
				const el = document.getElementById(anchor);
				if (el && el.getBoundingClientRect().top <= 120) current = anchor;
			}
			activePart = current;
		};
		update();
		window.addEventListener('scroll', update, { passive: true });
		return () => window.removeEventListener('scroll', update);
	});

	let showMobilePicker = $state(false);
</script>

<svelte:head>
	<title>{titleIsLabel ? session.title : `${sessionLabel(session.sessionNumber)}: ${session.title}`} — {module.name}</title>
	{#each theme.fontStylesheets as href (href)}
		<link rel="stylesheet" {href} />
	{/each}
</svelte:head>

<div class="page" style={publicPageThemeStyle(theme)}>
	{#if design.components.Backdrop}
		{@const Backdrop = design.components.Backdrop}
		<Backdrop {course} {module} {session} />
	{/if}
	<nav class="top-nav">
		<a href="/p/{course.slug}/{module.orderNumber}" class="nav-module">{module.name}</a>
		<button class="mobile-picker-btn" onclick={() => showMobilePicker = !showMobilePicker}>
			{parts.length > 0 ? 'In this session' : 'Menu'} <span class="picker-chevron" class:open={showMobilePicker}>▾</span>
		</button>
	</nav>

	{#if showMobilePicker}
		<div class="mobile-picker-overlay" onclick={() => showMobilePicker = false}>
			<div class="mobile-picker" onclick={e => e.stopPropagation()}>
				<a href="/p/{course.slug}/{module.orderNumber}" class="mobile-picker-home" onclick={() => showMobilePicker = false}>← All sessions</a>
				{#if parts.length > 0}
					<div class="mobile-picker-divider"></div>
					<p class="mobile-picker-section">In this session</p>
					{#each parts as part}
						<a href="#{part.anchor}"
							class="mobile-picker-item"
							class:active={part.anchor === activePart}
							onclick={() => showMobilePicker = false}>
							{part.label}
						</a>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<div class="layout">
		<aside class="sidebar">
			<div class="sidebar-inner">
				<a href="/p/{course.slug}/{module.orderNumber}" class="sidebar-home">← All sessions</a>
				{#if parts.length > 0}
					<div class="sidebar-divider"></div>
					<p class="sidebar-section-label">In this session</p>
					{#each parts as part}
						<a href="#{part.anchor}" class="sidebar-item" class:active={part.anchor === activePart}>{part.label}</a>
					{/each}
				{/if}
			</div>
		</aside>

		<main class="main">
			{#if design.components.SessionHeader}
				{@const SessionHeader = design.components.SessionHeader}
				<SessionHeader {course} {module} {session} />
			{:else}
				{#if !titleIsLabel || session.sectionName}
					<div class="session-eyebrow">{[titleIsLabel ? null : sessionLabel(session.sessionNumber), session.sectionName].filter(Boolean).join(' · ')}</div>
				{/if}
				<h1 class="session-title">{session.title}</h1>
				<div class="session-divider"></div>
			{/if}

			{#if session.blocks.length > 0}
				<div class="export-links">
					{#if pdfUrl}
						<a href={pdfUrl} class="export-link"><span class="export-icon">↓</span> Download this session (PDF)</a>
					{/if}
					<a href="/p/{course.slug}/{module.orderNumber}/print?session={session.sessionNumber}" class="export-link">Print version</a>
				</div>
			{/if}

			{#if session.blocks.length > 0}
				<PublicPageBlockRenderer {blocks} overrides={design.blocks} />
			{:else}
				<p class="empty">Content coming soon.</p>
			{/if}

			{#if design.surveyUrl}
				<div class="survey">
					<a href={design.surveyUrl} class="survey-btn" target="_blank" rel="noopener noreferrer">Fill In Survey</a>
				</div>
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
	.sidebar-section-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--pp-muted, #a8a29e); padding: 0.9rem 0.5rem 0.3rem; }
	.mobile-picker-section { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--pp-muted, #a8a29e); padding: 0.75rem 0 0.2rem; }
	.page { min-height: 100vh; background: var(--pp-bg, #faf8f5); color: var(--pp-ink, #292524); font-family: var(--pp-font-ui, 'Inter', sans-serif); font-weight: var(--pp-body-weight, 400); }
	:global(body) { margin: 0; font-family: var(--pp-font-ui, 'Inter', sans-serif); background: var(--pp-bg, #faf8f5); color: var(--pp-ink, #292524); }

	.top-nav { position: sticky; top: 0; z-index: 200; background: var(--pp-card, white); border-bottom: 1px solid var(--pp-border, #e7e5e4); padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; }
	.nav-module { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 1rem; font-weight: 500; color: var(--pp-ink, #292524); text-decoration: none; }
	.nav-module:hover { color: var(--pp-accent, #7c6a52); }
	.mobile-picker-btn { display: none; background: none; border: 1px solid var(--pp-border, #e7e5e4); border-radius: var(--pp-radius, 6px); padding: 0.35rem 0.75rem; font-size: 0.8rem; color: var(--pp-body, #57534e); cursor: pointer; align-items: center; gap: 0.3rem; }
	.picker-chevron { transition: transform 0.15s; display: inline-block; }
	.picker-chevron.open { transform: rotate(180deg); }

	.mobile-picker-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.3); }
	.mobile-picker { position: absolute; top: 56px; left: 0; right: 0; background: var(--pp-card, white); border-bottom: 1px solid var(--pp-border, #e7e5e4); max-height: 70vh; overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; }
	.mobile-picker-home { font-size: 0.85rem; color: var(--pp-muted, #78716c); text-decoration: none; display: block; padding: 0.4rem 0; }
	.mobile-picker-divider { border-top: 1px solid var(--pp-border, #e7e5e4); margin: 0.5rem 0; }
	.mobile-picker-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0; font-size: 0.9rem; color: var(--pp-body, #44403c); text-decoration: none; border-bottom: 1px solid var(--pp-surface, #f5f5f4); }
	.mobile-picker-item.active { font-weight: 600; }

	.layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 56px); max-width: 1200px; margin: 0 auto; }

	.sidebar { border-right: 1px solid var(--pp-border, #e7e5e4); padding: 2rem 1.25rem; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; }
	.sidebar-inner { display: flex; flex-direction: column; gap: 0.15rem; }
	.sidebar-home { font-size: 0.8rem; color: var(--pp-muted, #78716c); text-decoration: none; padding: 0.3rem 0.5rem; display: block; }
	.sidebar-home:hover { color: var(--pp-accent, #7c6a52); }
	.sidebar-divider { border-top: 1px solid var(--pp-border, #e7e5e4); margin: 0.5rem 0; }
	.sidebar-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border-radius: var(--pp-radius, 6px); font-size: 0.85rem; color: var(--pp-body, #57534e); text-decoration: none; transition: all 0.15s; }
	.sidebar-item:hover { background: var(--pp-surface, #f5f5f4); color: var(--pp-ink, #1c1917); }
	.sidebar-item.active { background: var(--pp-surface, #f5f5f4); color: var(--pp-ink, #1c1917); font-weight: 500; }

	.main { padding: 3rem 4rem; max-width: 780px; min-width: 0; }
	.session-eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent, #a8926e); margin-bottom: 0.5rem; }
	.session-title { font-family: var(--pp-font-heading, 'Lora', Georgia, serif); font-size: 2.4rem; font-weight: 500; color: var(--pp-ink, #1c1917); line-height: 1.25; margin-bottom: 1rem; }
	.session-divider { width: 48px; height: 2px; background: var(--pp-highlight, #c9a96e); margin-bottom: 2.5rem; }
	.empty { font-family: var(--pp-font-body, 'Lora', Georgia, serif); color: var(--pp-muted, #a8a29e); font-style: italic; }

	.survey { display: flex; justify-content: center; margin-top: 2.5rem; }
	.survey-btn { display: inline-block; padding: 0.7rem 1.6rem; background: var(--pp-ink, #1c1917); color: var(--pp-bg, #faf8f5); border-radius: var(--pp-radius, 8px); font-size: 0.9rem; font-weight: 600; text-decoration: none; transition: opacity 0.15s; }
	.survey-btn:hover { opacity: 0.88; }
	.session-nav { display: flex; justify-content: space-between; gap: 1rem; padding: 2rem 0; margin-top: 2rem; border-top: 1px solid var(--pp-border, #e7e5e4); }
	.nav-btn { min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; padding: 0.75rem 1.25rem; border: 1px solid var(--pp-border, #e7e5e4); border-radius: var(--pp-radius, 8px); background: var(--pp-card, white); text-decoration: none; color: var(--pp-body, #44403c); transition: all 0.15s; }
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
	.export-link { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.9rem; background: var(--pp-card, white); border: 1px solid var(--pp-border, #e7e5e4); border-radius: var(--pp-radius, 8px); font-size: 0.8rem; font-weight: 500; color: var(--pp-body, #57534e); text-decoration: none; transition: all 0.15s; }
	.export-link:hover { border-color: var(--pp-highlight, #c9a96e); color: var(--pp-ink, #1c1917); }
	.export-icon { color: var(--pp-highlight-text, #c9a96e); }
	.page { position: relative; overflow-x: clip; }
	.layout { position: relative; z-index: 1; }
</style>
