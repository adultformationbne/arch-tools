<script>
	import { Users, Settings } from '$lib/icons';

	let { activeSection = 'users', onNavigate } = $props();

	// Define the navigation structure
	const sections = [
		{
			id: 'users',
			name: 'User Management',
			icon: Users
		},
		{
			id: 'platform',
			name: 'Platform Settings',
			icon: Settings
		}
	];

	function handleSectionClick(section) {
		onNavigate?.(section.id);
	}
</script>

<nav class="bg-gray-50 border-b border-gray-200">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-14 items-center justify-center">
			<div class="flex items-center space-x-1">
				{#each sections as section}
					{@const Icon = section.icon}
					{@const isActive = activeSection === section.id}

					<button
						type="button"
						onclick={() => handleSectionClick(section)}
						class="flex items-center gap-2 rounded-full px-2 sm:px-4 py-2 text-sm font-semibold transition-colors {isActive
							? 'bg-gray-900 text-white'
							: 'text-gray-700 hover:bg-gray-100'}"
						title={section.name}
					>
						<Icon class="h-4 w-4" aria-hidden="true" />
						<span class="hidden sm:inline">{section.name}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
</nav>
