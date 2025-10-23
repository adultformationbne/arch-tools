<script lang="ts">
	import { User } from 'lucide-svelte';

	let { session, userRole = null } = $props<{
		session: any;
		userRole?: string | null;
	}>();

	// Define all possible routes with role requirements
	const allRoutes = [
		{ name: 'Home', path: '/', description: 'Dashboard home', roles: ['admin', 'editor', 'contributor', 'viewer', 'accf_admin', 'accf_student', 'hub_coordinator'] },
		{ name: 'Editor', path: '/editor', description: 'Main content editor', roles: ['admin', 'editor'] },
		{ name: 'DGR', path: '/dgr', description: 'DGR management', roles: ['admin'] },
		{ name: 'DGR Templates', path: '/dgr-templates', description: 'Email template management', roles: ['admin'] },
	];

	// Filter routes based on user role
	let visibleRoutes = $derived(
		userRole
			? allRoutes.filter(route => route.roles.includes(userRole))
			: allRoutes // Show all if no role specified (for backward compatibility)
	);
</script>

<nav class="border-b bg-white shadow-sm">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 justify-between">
			<div class="flex items-center space-x-8">
				<a href="/" class="text-xl font-semibold text-gray-900">Archdiocesan Ministry Tools</a>

				<div class="hidden items-center space-x-4 md:flex">
					{#each visibleRoutes as route}
						<a
							href={route.path}
							class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
							title={route.description}
						>
							{route.name}
						</a>
					{/each}
				</div>
			</div>

			{#if session}
				<div class="flex items-center space-x-4">
					<a
						href="/profile"
						class="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
						title="Profile Settings"
					>
						<User class="h-5 w-5" />
						<span>{session.user.email}</span>
					</a>
					<form method="post" action="/auth/logout">
						<button
							type="submit"
							class="rounded-md bg-gray-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
						>
							Logout
						</button>
					</form>
				</div>
			{/if}
		</div>

		<!-- Mobile menu -->
		<div class="space-y-1 pt-2 pb-3 md:hidden">
			{#each visibleRoutes as route}
				<a
					href={route.path}
					class="block rounded-md px-3 py-2 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
				>
					{route.name}
				</a>
			{/each}
		</div>
	</div>
</nav>
