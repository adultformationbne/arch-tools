<script>
	import { Calendar, Users, BookOpen, PenTool, ChevronDown } from 'lucide-svelte';

	let { activeSection = 'schedule', activeSubSection = 'schedule' } = $props();

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

	// State for dropdown visibility
	let openDropdown = $state(null);

	function toggleDropdown(sectionId) {
		openDropdown = openDropdown === sectionId ? null : sectionId;
	}

	function handleSectionClick(section, event) {
		// Toggle dropdown
		if (openDropdown === section.id) {
			openDropdown = null;
		} else {
			openDropdown = section.id;
		}
	}
</script>

<nav class="bg-white border-b border-gray-200">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-14 items-center justify-center relative">
			<!-- Center: Section Navigation -->
			<div class="flex items-center space-x-1">
				{#each sections as section}
					<div class="relative">
						<button
							onclick={(e) => handleSectionClick(section, e)}
							class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors {activeSection === section.id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						>
							<svelte:component this={section.icon} class="h-4 w-4" />
							{section.name}
							{#if section.subsections && section.subsections.length > 0}
								<ChevronDown class="h-3 w-3 transition-transform {openDropdown === section.id ? 'rotate-180' : ''}" />
							{/if}
						</button>

						<!-- Dropdown menu for subsections -->
						{#if section.subsections && section.subsections.length > 0 && openDropdown === section.id}
							<div class="absolute left-0 top-full mt-1 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
								<div class="py-1">
									{#each section.subsections as subsection}
										<a
											href={subsection.path}
											onclick={() => openDropdown = null}
											class="block w-full px-4 py-2 text-left text-sm transition-colors {activeSubSection === subsection.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'}"
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
					class="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors {activeSection === 'publish' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
				>
					<svelte:component this={quickPublishLink.icon} class="h-4 w-4" />
					{quickPublishLink.name}
				</a>
			</div>
		</div>
	</div>
</nav>

<!-- Click outside to close dropdown -->
<svelte:window onclick={(e) => {
	if (openDropdown && !e.target.closest('button')) {
		openDropdown = null;
	}
}} />
