<script>
	import PublicPageBlockRenderer from '$lib/components/PublicPageBlockRenderer.svelte';

	let { data } = $props();
	const { course, modules } = $derived(data);

	// Group modules by section_name for sidebar
	const sidebarGroups = $derived(() => {
		const groups = [];
		let currentGroup = null;
		for (const mod of modules) {
			if (mod.sectionName !== currentGroup?.label) {
				currentGroup = { label: mod.sectionName, items: [] };
				groups.push(currentGroup);
			}
			currentGroup.items.push(mod);
		}
		return groups;
	});
</script>

<svelte:head>
	<title>{course.name}</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
</svelte:head>

<div class="page">
	<nav class="top-nav">
		<span class="nav-course">{course.name}</span>
	</nav>

	<div class="layout">
		<aside class="sidebar">
			<div class="sidebar-inner">
				{#each sidebarGroups() as group}
					{#if group.label}
						<p class="sidebar-section-label">{group.label}</p>
					{:else}
						<p class="sidebar-section-label">Sessions</p>
					{/if}
					{#each group.items as mod}
						<a
							href="/p/{course.slug}/{mod.orderNumber}"
							class="sidebar-item"
							class:dim={!mod.hasContent}
						>
							<span class="sidebar-num">{mod.orderNumber}</span>
							<span>{mod.name}</span>
						</a>
					{/each}
				{/each}
			</div>
		</aside>

		<main class="main">
			<div class="hero">
				<p class="eyebrow">Course Guide</p>
				<h1 class="course-title">{course.name}</h1>
				{#if course.shortName && course.shortName !== course.name}
					<p class="course-subtitle">{course.shortName}</p>
				{/if}
				<div class="title-divider"></div>
				{#if course.description}
					<p class="course-desc">{course.description}</p>
				{/if}
			</div>

			{#if course.titlePage}
				<div class="title-page-blocks">
					<PublicPageBlockRenderer blocks={course.titlePage} />
				</div>
			{/if}

			<!-- Session grid grouped by section -->
			{#each sidebarGroups() as group}
				{#if group.items.some(m => m.hasContent)}
					{#if group.label}
						<h2 class="sessions-heading">{group.label}</h2>
					{:else}
						<h2 class="sessions-heading">Sessions</h2>
					{/if}
					<div class="session-grid">
						{#each group.items as mod}
							{#if mod.hasContent}
								<a href="/p/{course.slug}/{mod.orderNumber}" class="session-card">
									<span class="session-num">{mod.orderNumber}</span>
									<div class="session-text">
										<p class="session-name">{mod.name}</p>
										{#if mod.description}
											<p class="session-desc">{mod.description}</p>
										{/if}
									</div>
									<span class="session-arrow">→</span>
								</a>
							{/if}
						{/each}
					</div>
				{/if}
			{/each}
		</main>
	</div>
</div>

<style>
	:global(body) { margin: 0; font-family: 'Inter', sans-serif; background: #faf8f5; color: #292524; }

	.top-nav {
		position: sticky; top: 0; z-index: 100;
		background: white; border-bottom: 1px solid #e7e5e4;
		padding: 0 1.5rem; height: 56px;
		display: flex; align-items: center;
	}
	.nav-course { font-family: 'Lora', Georgia, serif; font-size: 1rem; font-weight: 500; }

	.layout {
		display: grid;
		grid-template-columns: 260px 1fr;
		min-height: calc(100vh - 56px);
		max-width: 1200px;
		margin: 0 auto;
	}

	.sidebar {
		border-right: 1px solid #e7e5e4;
		padding: 2rem 1.25rem;
		position: sticky; top: 56px;
		height: calc(100vh - 56px);
		overflow-y: auto;
	}
	.sidebar-inner { display: flex; flex-direction: column; gap: 0.15rem; }
	.sidebar-section-label {
		font-size: 0.65rem; font-weight: 600;
		text-transform: uppercase; letter-spacing: 0.1em;
		color: #a8a29e; padding: 0.6rem 0.5rem 0.3rem;
		margin-top: 0.25rem;
	}
	.sidebar-item {
		display: flex; align-items: center; gap: 0.6rem;
		padding: 0.4rem 0.5rem; border-radius: 6px;
		font-size: 0.85rem; color: #57534e;
		text-decoration: none; transition: all 0.15s;
	}
	.sidebar-item:hover { background: #f5f5f4; color: #1c1917; }
	.sidebar-item.dim { opacity: 0.35; pointer-events: none; }
	.sidebar-num { font-size: 0.7rem; color: #a8a29e; min-width: 18px; }

	.main { padding: 3rem 4rem; max-width: 780px; }

	.hero { margin-bottom: 3rem; }
	.eyebrow { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #a8926e; margin-bottom: 0.6rem; }
	.course-title { font-family: 'Lora', Georgia, serif; font-size: 2.6rem; font-weight: 500; color: #1c1917; line-height: 1.2; margin-bottom: 0.4rem; }
	.course-subtitle { font-family: 'Lora', Georgia, serif; font-size: 1.1rem; color: #78716c; margin-bottom: 1rem; }
	.title-divider { width: 48px; height: 2px; background: #c9a96e; margin: 1rem 0; }
	.course-desc { font-family: 'Lora', Georgia, serif; font-size: 1rem; color: #57534e; line-height: 1.8; }
	.title-page-blocks { margin-bottom: 2rem; }

	.sessions-heading { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #7c6a52; margin-top: 2rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e7e5e4; }
	.session-grid { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
	.session-card { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; background: white; border: 1px solid #e7e5e4; border-radius: 10px; text-decoration: none; color: inherit; transition: all 0.15s; }
	.session-card:hover { border-color: #a8926e; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
	.session-num { font-size: 0.75rem; font-weight: 600; color: #c9a96e; min-width: 24px; }
	.session-text { flex: 1; min-width: 0; }
	.session-name { font-size: 0.95rem; font-weight: 500; color: #1c1917; margin-bottom: 0.1rem; }
	.session-desc { font-size: 0.8rem; color: #78716c; line-height: 1.5; }
	.session-arrow { color: #a8a29e; flex-shrink: 0; }

	@media (max-width: 768px) {
		.layout { grid-template-columns: 1fr; }
		.sidebar { display: none; }
		.main { padding: 1.5rem 1.25rem; }
		.course-title { font-size: 1.8rem; }
	}
</style>
