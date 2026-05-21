<script>
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, module, sessions, session } = $derived(data);

	const prevSession = $derived(sessions.find(s => s.sessionNumber === session.sessionNumber - 1) ?? null);
	const nextSession = $derived(sessions.find(s => s.sessionNumber === session.sessionNumber + 1) ?? null);

	let showMobilePicker = $state(false);
</script>

<svelte:head>
	<title>Session {session.sessionNumber}: {session.title} — {course.name}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="page">
	<nav class="top-nav">
		<a href="/p/{course.slug}/{module.orderNumber}" class="nav-module">{module.name}</a>
		<button class="mobile-picker-btn" onclick={() => showMobilePicker = !showMobilePicker}>
			Session {session.sessionNumber} <span class="picker-chevron" class:open={showMobilePicker}>▾</span>
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
						<span class="mobile-picker-num">{s.sessionNumber}</span>{s.title}
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
						<span class="sidebar-num">{s.sessionNumber}</span>
						<span>{s.title}</span>
					</a>
				{/each}
			</div>
		</aside>

		<main class="main">
			<div class="session-eyebrow">Session {session.sessionNumber}</div>
			<h1 class="session-title">{session.title}</h1>
			<div class="session-divider"></div>

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
	:global(body) { margin: 0; font-family: 'Inter', sans-serif; background: #faf8f5; color: #292524; }

	.top-nav { position: sticky; top: 0; z-index: 200; background: white; border-bottom: 1px solid #e7e5e4; padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; }
	.nav-module { font-family: 'Lora', Georgia, serif; font-size: 1rem; font-weight: 500; color: #292524; text-decoration: none; }
	.nav-module:hover { color: #7c6a52; }
	.mobile-picker-btn { display: none; background: none; border: 1px solid #e7e5e4; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #57534e; cursor: pointer; align-items: center; gap: 0.3rem; }
	.picker-chevron { transition: transform 0.15s; display: inline-block; }
	.picker-chevron.open { transform: rotate(180deg); }

	.mobile-picker-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.3); }
	.mobile-picker { position: absolute; top: 56px; left: 0; right: 0; background: white; border-bottom: 1px solid #e7e5e4; max-height: 70vh; overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; }
	.mobile-picker-home { font-size: 0.85rem; color: #78716c; text-decoration: none; display: block; padding: 0.4rem 0; }
	.mobile-picker-divider { border-top: 1px solid #e7e5e4; margin: 0.5rem 0; }
	.mobile-picker-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0; font-size: 0.9rem; color: #44403c; text-decoration: none; border-bottom: 1px solid #f5f5f4; }
	.mobile-picker-item.active { font-weight: 600; }
	.mobile-picker-item.dim { opacity: 0.4; pointer-events: none; }
	.mobile-picker-num { font-size: 0.7rem; color: #c9a96e; min-width: 18px; }

	.layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 56px); max-width: 1200px; margin: 0 auto; }

	.sidebar { border-right: 1px solid #e7e5e4; padding: 2rem 1.25rem; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; }
	.sidebar-inner { display: flex; flex-direction: column; gap: 0.15rem; }
	.sidebar-home { font-size: 0.8rem; color: #78716c; text-decoration: none; padding: 0.3rem 0.5rem; display: block; }
	.sidebar-home:hover { color: #7c6a52; }
	.sidebar-divider { border-top: 1px solid #e7e5e4; margin: 0.5rem 0; }
	.sidebar-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.5rem; border-radius: 6px; font-size: 0.85rem; color: #57534e; text-decoration: none; transition: all 0.15s; }
	.sidebar-item:hover { background: #f5f5f4; color: #1c1917; }
	.sidebar-item.active { background: #f5f5f4; color: #1c1917; font-weight: 500; }
	.sidebar-item.dim { opacity: 0.35; pointer-events: none; }
	.sidebar-num { font-size: 0.7rem; color: #a8a29e; min-width: 18px; }
	.sidebar-item.active .sidebar-num { color: #c9a96e; }

	.main { padding: 3rem 4rem; max-width: 780px; }
	.session-eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #a8926e; margin-bottom: 0.5rem; }
	.session-title { font-family: 'Lora', Georgia, serif; font-size: 2.4rem; font-weight: 500; color: #1c1917; line-height: 1.25; margin-bottom: 1rem; }
	.session-divider { width: 48px; height: 2px; background: #c9a96e; margin-bottom: 2.5rem; }
	.empty { font-family: 'Lora', Georgia, serif; color: #a8a29e; font-style: italic; }

	.session-nav { display: flex; justify-content: space-between; gap: 1rem; padding: 2rem 0; margin-top: 2rem; border-top: 1px solid #e7e5e4; }
	.nav-btn { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.75rem 1.25rem; border: 1px solid #e7e5e4; border-radius: 8px; background: white; text-decoration: none; color: #44403c; transition: all 0.15s; }
	.nav-btn:hover { border-color: #a8926e; }
	.nav-btn.next { text-align: right; margin-left: auto; }
	.nav-label { font-size: 0.7rem; color: #a8a29e; }
	.nav-name { font-size: 0.875rem; font-weight: 500; color: #292524; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	@media (max-width: 768px) {
		.layout { grid-template-columns: 1fr; }
		.sidebar { display: none; }
		.mobile-picker-btn { display: flex; }
		.main { padding: 1.5rem 1.25rem; }
		.session-title { font-size: 1.8rem; }
	}
</style>
