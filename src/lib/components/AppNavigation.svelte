<script lang="ts">
	import { User, Settings } from 'lucide-svelte';
	import { page } from '$app/stores';

	let { session, userRole = null } = $props<{
		session: any;
		userRole?: string | null;
	}>();

	// Define all possible routes with role requirements
	const allRoutes = [
		{ name: 'Home', path: '/', description: 'Dashboard home', roles: ['admin', 'editor', 'contributor', 'viewer', 'admin', 'courses_student', 'hub_coordinator'] },
		{ name: 'Courses', path: '/courses', description: 'Course management', roles: ['admin', 'student', 'hub_coordinator'] },
		{ name: 'Editor', path: '/editor', description: 'Main content editor', roles: ['admin', 'editor'] },
		{ name: 'DGR', path: '/dgr', description: 'DGR management', roles: ['admin'] },
	];

	// Filter routes based on user role
	let visibleRoutes = $derived(
		userRole
			? allRoutes.filter(route => route.roles.includes(userRole))
			: allRoutes // Show all if no role specified (for backward compatibility)
	);

	// Check if user is admin
	let isAdmin = $derived(userRole === 'admin');
</script>

<nav class="bg-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<a href="/" class="flex items-center">
				<img src="/archmin-mark.png" alt="ArchTools" class="h-8" />
			</a>

			<div class="absolute left-1/2 -translate-x-1/2 hidden items-center space-x-1 md:flex">
				{#each visibleRoutes as route}
					<a
						href={route.path}
						class="rounded-full px-4 py-2 text-sm font-medium transition-colors {$page.url.pathname === route.path ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title={route.description}
					>
						{route.name}
					</a>
				{/each}
			</div>

			{#if session}
				<div class="flex items-center space-x-3">
					{#if isAdmin}
						<a
							href="/admin/users"
							class="rounded-full p-2 transition-colors {$page.url.pathname.startsWith('/admin') ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}"
							title="Admin Settings"
						>
							<Settings class="h-5 w-5" />
						</a>
					{/if}
					<a
						href="/profile"
						class="flex h-9 w-9 items-center justify-center rounded-full transition-colors {$page.url.pathname === '/profile' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
						title="Profile Settings"
					>
						<User class="h-5 w-5" />
					</a>
				</div>
			{/if}
		</div>
	</div>
</nav>
