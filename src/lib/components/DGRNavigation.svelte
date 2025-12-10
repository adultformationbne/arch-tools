<script>
	import { Calendar, Users, BookOpen, PenTool, ChevronDown, FileEdit } from 'lucide-svelte';

	let { activeSection = 'schedule', activeSubSection = 'schedule', contributorToken = null } = $props();
	let navRoot = $state(null);

	// Define the navigation structure with subsections and routes
	const sections = [
		{
			id: 'schedule',
			name: 'Schedule & Publishing',
			icon: Calendar,
			subsections: [
				{ id: 'schedule', name: 'Schedule', path: '/dgr' },
				{ id: 'submissions', name: 'Submissions', path: '/dgr/submissions' }
			]
		},
		{
			id: 'people',
			name: 'People & Rules',
			icon: Users,
			subsections: [
				{ id: 'contributors', name: 'Contributors', path: '/dgr/contributors' },
				{ id: 'rules', name: 'Assignment Rules', path: '/dgr/rules' }
			]
		},
		{
			id: 'content',
			name: 'Content & Data',
			icon: BookOpen,
			subsections: [
				{ id: 'calendar', name: 'Liturgical Calendar', path: '/dgr/liturgical-calendar' },
				{ id: 'templates', name: 'Templates', path: '/dgr/templates' },
				{ id: 'promo', name: 'Promo Tiles', path: '/dgr/promo' }
			]
		}
	];

	// Quick publish link
	const quickPublishLink = { name: 'Quick Publish', path: '/dgr/publish', icon: PenTool };
	const QuickIcon = quickPublishLink.icon;

	// State for dropdown visibility
	let openDropdown = $state(null);

	function handleSectionClick(section) {
		// Toggle dropdown
		if (openDropdown === section.id) {
			openDropdown = null;
		} else {
			openDropdown = section.id;
		}
	}

	function focusFirstItem(menuId) {
		const menu = document.getElementById(menuId);
		if (!menu) return;
		const focusableItem = menu.querySelector('a, button, [tabindex]:not([tabindex="-1"])');
		if (focusableItem) {
			focusableItem.focus();
		}
	}

	function handleSectionKeydown(event, section, menuId) {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			openDropdown = section.id;
			focusFirstItem(menuId);
			return;
		}

		if (event.key === 'Escape' && openDropdown === section.id) {
			openDropdown = null;
			event.currentTarget.focus();
		}
	}
</script>

<nav class="bg-gray-50 border-b border-gray-200 sticky top-0 z-30" bind:this={navRoot} data-nav-root>
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-14 items-center justify-center relative">
			<!-- Center: Section Navigation -->
			<div class="flex items-center space-x-1">
				{#each sections as section}
					{@const Icon = section.icon}
					{@const menuId = `dgr-nav-${section.id}-menu`}
					<div class="relative">
						<button
							type="button"
							onclick={() => handleSectionClick(section)}
							onkeydown={(event) => handleSectionKeydown(event, section, menuId)}
							class="flex items-center gap-2 rounded-full px-2 sm:px-4 py-2 text-sm font-semibold transition-colors {activeSection === section.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
							aria-haspopup="true"
							aria-expanded={openDropdown === section.id}
							aria-controls={section.subsections && section.subsections.length > 0 ? menuId : undefined}
							id={`dgr-nav-${section.id}-button`}
							title={section.name}
						>
							<Icon class="h-4 w-4" aria-hidden="true" />
							<span class="hidden sm:inline">{section.name}</span>
							{#if section.subsections && section.subsections.length > 0}
								<ChevronDown class="h-3 w-3 transition-transform {openDropdown === section.id ? 'rotate-180' : ''} hidden sm:inline" aria-hidden="true" />
							{/if}
						</button>

						<!-- Dropdown menu for subsections -->
						{#if section.subsections && section.subsections.length > 0 && openDropdown === section.id}
							<div
								id={menuId}
								role="menu"
								aria-labelledby={`dgr-nav-${section.id}-button`}
								class="absolute left-0 sm:left-0 top-full mt-1 w-full sm:w-48 rounded-lg bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 z-50 focus:outline-none"
								tabindex="-1"
							>
								<div class="py-1">
									{#each section.subsections as subsection}
										<a
											href={subsection.path}
											onclick={() => openDropdown = null}
											class="block w-full px-4 py-2 text-left text-sm transition-colors {activeSubSection === subsection.id ? 'bg-gray-800 text-white font-medium' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}"
											role="menuitem"
										>
											{subsection.name}
										</a>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/each}

				<!-- Quick Publish Link (in the center with other nav items) -->
				<a
					href={quickPublishLink.path}
					class="flex items-center gap-2 rounded-full px-2 sm:px-4 py-2 text-sm font-semibold transition-colors {activeSection === 'publish' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					title={quickPublishLink.name}
				>
					<QuickIcon class="h-4 w-4" aria-hidden="true" />
					<span class="hidden sm:inline">{quickPublishLink.name}</span>
				</a>

				<!-- My Reflections Link (only shown if user is a contributor) -->
				{#if contributorToken}
					<a
						href="/dgr/write/{contributorToken}"
						class="flex items-center gap-2 rounded-full px-2 sm:px-4 py-2 text-sm font-semibold transition-colors {activeSection === 'my-reflections' ? 'bg-[#009199] text-white' : 'text-[#009199] hover:bg-[#009199]/10'}"
						title="My Reflections"
					>
						<FileEdit class="h-4 w-4" aria-hidden="true" />
						<span class="hidden sm:inline">My Reflections</span>
					</a>
				{/if}
			</div>
		</div>
	</div>
</nav>

<!-- Click outside to close dropdown -->
<svelte:window
	on:click={(event) => {
		if (!openDropdown || !navRoot) return;
		if (event.target instanceof Node && !navRoot.contains(event.target)) {
			openDropdown = null;
		}
	}}
	on:keydown={(event) => {
		if (event.key === 'Escape' && openDropdown) {
			openDropdown = null;
		}
	}}
/>
