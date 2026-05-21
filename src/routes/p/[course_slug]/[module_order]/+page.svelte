<script>
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, module, sessions, allModules } = $derived(data);

	// Group all modules by section for sidebar
	const sidebarGroups = $derived(() => {
		const groups = [];
		let currentGroup = null;
		for (const mod of allModules) {
			if (mod.sectionName !== currentGroup?.label) {
				currentGroup = { label: mod.sectionName, items: [] };
				groups.push(currentGroup);
			}
			currentGroup.items.push(mod);
		}
		return groups;
	});

	let showMobilePicker = $state(false);
</script>

<svelte:head>
	<title>{module.name} — {course.name}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="page">
	<nav class="top-nav">
		<a href="/p/{course.slug}" class="nav-course">{course.name}</a>
		<button class="mobile-picker-btn" onclick={() => showMobilePicker = !showMobilePicker}>
			{module.name} <span class="picker-chevron" class:open={showMobilePicker}>▾</span>
		</button>
	</nav>

	{#if showMobilePicker}
		<div class="mobile-picker-overlay" onclick={() => showMobilePicker = false}>
			<div class="mobile-picker" onclick={e => e.stopPropagation()}>
				<a href="/p/{course.slug}" class="mobile-picker-home" onclick={() => showMobilePicker = false}>← Course home</a>
				<div class="mobile-picker-divider"></div>
				{#each sidebarGroups() as group}
					{#if group.label}<p class="mobile-picker-section">{group.label}</p>{/if}
					{#each group.items as mod}
						<a href="/p/{course.slug}/{mod.orderNumber}" class="mobile-picker-item"
							class:active={mod.orderNumber === module.orderNumber}
							onclick={() => showMobilePicker = false}>
							<span class="mobile-picker-num">{mod.orderNumber}</span>{mod.name}
						</a>
					{/each}
				{/each}
			</div>
		</div>
	{/if}

	<div class="layout">
		<aside class="sidebar">
			<div class="sidebar-inner">
				<a href="/p/{course.slug}" class="sidebar-home">← Course Home</a>
				<div class="sidebar-divider"></div>
				{#each sidebarGroups() as group}
					{#if group.label}<p class="sidebar-section-label">{group.label}</p>{/if}
					{#each group.items as mod}
						<a href="/p/{course.slug}/{mod.orderNumber}" class="sidebar-module"
							class:active={mod.orderNumber === module.orderNumber}>
							{mod.name}
						</a>
					{/each}
				{/each}
			</div>
		</aside>

		<main class="main">
			<div class="module-eyebrow">Course Module</div>
			<h1 class="module-title">{module.name}</h1>
			<div class="title-divider"></div>

			{#if module.blocks.length > 0}
				<PublicPageBlockRenderer blocks={module.blocks} />
				<hr class="section-break" />
			{/if}

			<h2 class="sessions-heading">Sessions</h2>
			<div class="session-list">
				{#each sessions as session}
					{#if session.hasContent}
						<a href="/p/{course.slug}/{module.orderNumber}/{session.sessionNumber}" class="session-card">
							<span class="session-num">{session.sessionNumber}</span>
							<div class="session-text">
								<p class="session-title">{session.title}</p>
								{#if session.description}<p class="session-desc">{session.description}</p>{/if}
							</div>
							<span class="session-arrow">→</span>
						</a>
					{:else}
						<div class="session-card dim">
							<span class="session-num">{session.sessionNumber}</span>
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
	:global(body) { margin: 0; font-family: 'Inter', sans-serif; background: #faf8f5; color: #292524; }

	.top-nav { position: sticky; top: 0; z-index: 200; background: white; border-bottom: 1px solid #e7e5e4; padding: 0 1.5rem; height: 56px; display: flex; align-items: center; justify-content: space-between; }
	.nav-course { font-family: 'Lora', Georgia, serif; font-size: 1rem; font-weight: 500; color: #292524; text-decoration: none; }
	.nav-course:hover { color: #7c6a52; }
	.mobile-picker-btn { display: none; background: none; border: 1px solid #e7e5e4; border-radius: 6px; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #57534e; cursor: pointer; align-items: center; gap: 0.3rem; }
	.picker-chevron { transition: transform 0.15s; display: inline-block; }
	.picker-chevron.open { transform: rotate(180deg); }

	.mobile-picker-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.3); }
	.mobile-picker { position: absolute; top: 56px; left: 0; right: 0; background: white; border-bottom: 1px solid #e7e5e4; max-height: 70vh; overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; }
	.mobile-picker-home { font-size: 0.85rem; color: #78716c; text-decoration: none; display: block; padding: 0.4rem 0; }
	.mobile-picker-divider { border-top: 1px solid #e7e5e4; margin: 0.5rem 0; }
	.mobile-picker-section { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #a8a29e; padding: 0.5rem 0 0.2rem; }
	.mobile-picker-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0; font-size: 0.9rem; color: #44403c; text-decoration: none; border-bottom: 1px solid #f5f5f4; }
	.mobile-picker-item.active { font-weight: 600; }
	.mobile-picker-num { font-size: 0.7rem; color: #c9a96e; min-width: 18px; }

	.layout { display: grid; grid-template-columns: 260px 1fr; min-height: calc(100vh - 56px); max-width: 1200px; margin: 0 auto; }

	.sidebar { border-right: 1px solid #e7e5e4; padding: 2rem 1.25rem; position: sticky; top: 56px; height: calc(100vh - 56px); overflow-y: auto; }
	.sidebar-inner { display: flex; flex-direction: column; gap: 0.15rem; }
	.sidebar-home { font-size: 0.8rem; color: #78716c; text-decoration: none; padding: 0.3rem 0.5rem; display: block; }
	.sidebar-home:hover { color: #7c6a52; }
	.sidebar-divider { border-top: 1px solid #e7e5e4; margin: 0.5rem 0; }
	.sidebar-section-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: #a8a29e; padding: 0.6rem 0.5rem 0.3rem; }
	.sidebar-module { display: block; padding: 0.4rem 0.5rem; border-radius: 6px; font-size: 0.875rem; color: #57534e; text-decoration: none; transition: all 0.15s; }
	.sidebar-module:hover { background: #f5f5f4; color: #1c1917; }
	.sidebar-module.active { background: #f5f5f4; color: #1c1917; font-weight: 500; }

	.main { padding: 3rem 4rem; max-width: 780px; }
	.module-eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #a8926e; margin-bottom: 0.5rem; }
	.module-title { font-family: 'Lora', Georgia, serif; font-size: 2.4rem; font-weight: 500; color: #1c1917; line-height: 1.25; margin-bottom: 1rem; }
	.title-divider { width: 48px; height: 2px; background: #c9a96e; margin-bottom: 2.5rem; }
	.section-break { border: none; border-top: 1px solid #e7e5e4; margin: 2.5rem 0; }

	.sessions-heading { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #7c6a52; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e7e5e4; }
	.session-list { display: flex; flex-direction: column; gap: 0.6rem; }
	.session-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; background: white; border: 1px solid #e7e5e4; border-radius: 10px; text-decoration: none; color: inherit; transition: all 0.15s; }
	.session-card:not(.dim):hover { border-color: #a8926e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
	.session-card.dim { opacity: 0.45; }
	.session-num { font-size: 0.75rem; font-weight: 600; color: #c9a96e; min-width: 24px; flex-shrink: 0; }
	.session-text { flex: 1; min-width: 0; }
	.session-title { font-size: 0.95rem; font-weight: 500; color: #1c1917; margin-bottom: 0.1rem; }
	.session-desc { font-size: 0.8rem; color: #78716c; line-height: 1.5; }
	.session-arrow { color: #a8a29e; flex-shrink: 0; }

	@media (max-width: 768px) {
		.layout { grid-template-columns: 1fr; }
		.sidebar { display: none; }
		.mobile-picker-btn { display: flex; }
		.main { padding: 1.5rem 1.25rem; }
		.module-title { font-size: 1.8rem; }
	}
</style>
