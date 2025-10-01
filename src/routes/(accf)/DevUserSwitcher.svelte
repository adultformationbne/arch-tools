<script>
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { realDevUsers, getDevUser, setDevUser, isDevMode } from '$lib/utils/dev-user.js';

	// Only show in localhost development
	const isDev = browser && isDevMode();

	let isExpanded = $state(false);
	let currentUser = $state(null);

	// Use real users from Supabase database
	const devUsers = realDevUsers;

	// Load current user from localStorage
	if (browser) {
		const saved = getDevUser();
		if (saved) {
			currentUser = saved;
		} else {
			// Default to Jennifer Davis (student with reflections)
			currentUser = devUsers[1];
			setDevUser(currentUser);
		}
	}

	// Effect to set cookie when currentUser changes
	$effect(() => {
		if (browser && currentUser) {
			const userJson = JSON.stringify(currentUser);
			const encodedUser = encodeURIComponent(userJson);
			document.cookie = `dev-user=${encodedUser}; Path=/; SameSite=Lax`;
		}
	});

	const switchUser = (user) => {
		currentUser = user;
		if (browser) {
			setDevUser(user);
			// Cookie will be set by the effect
			// Reload page to reflect changes
			window.location.reload();
		}
		isExpanded = false;
	};

	const toggleExpanded = () => {
		isExpanded = !isExpanded;
	};

	// Get user role badge color
	const getRoleColor = (role) => {
		switch(role) {
			case 'accf_admin': return 'bg-red-100 text-red-700';
			case 'accf_student': return 'bg-blue-100 text-blue-700';
			case 'hub_coordinator': return 'bg-green-100 text-green-700';
			default: return 'bg-gray-100 text-gray-700';
		}
	};
</script>

{#if isDev}
	<div class="fixed top-0 left-0 right-0 z-50 bg-black border-b-2 border-gray-700 shadow-sm">
		<div class="px-4 py-2">
			<div class="flex items-center justify-between max-w-7xl mx-auto">
				<div class="flex items-center gap-3">
					<span class="text-sm font-bold text-white">🛠️ DEV MODE</span>
					<button
						onclick={toggleExpanded}
						class="flex items-center gap-2 px-3 py-1 bg-white rounded-md text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors"
					>
						<span>Current User: {currentUser?.name || 'None'}</span>
						<span class="text-xs px-2 py-0.5 rounded-full {getRoleColor(currentUser?.role)}">
							{currentUser?.role?.replace('accf_', '').replace('_', ' ') || 'none'}
						</span>
						<span class="text-lg {isExpanded ? 'rotate-180' : ''} transition-transform">⌄</span>
					</button>
				</div>
				<div class="text-xs text-gray-300">
					localhost only • auto-refresh on switch
				</div>
			</div>

			{#if isExpanded}
				<div class="mt-3 bg-white rounded-lg shadow-lg border border-gray-200 max-w-2xl">
					<div class="p-3">
						<h3 class="text-sm font-semibold text-gray-800 mb-3">Switch Development User</h3>
						<div class="space-y-1">
							{#each devUsers as user}
								<button
									onclick={() => switchUser(user)}
									class="w-full flex items-center justify-between p-3 rounded-md text-left hover:bg-gray-50 transition-colors"
									class:bg-blue-50={currentUser?.id === user.id}
									class:border-blue-200={currentUser?.id === user.id}
									class:border={currentUser?.id === user.id}
								>
									<div class="flex items-center gap-3">
										<div class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold">
											{user.name.split(' ').map(n => n[0]).join('')}
										</div>
										<div>
											<div class="font-medium text-gray-900">{user.name}</div>
											<div class="text-sm text-gray-600">{user.email}</div>
										</div>
									</div>
									<div class="flex items-center gap-2">
										{#if user.current_session}
											<span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
												Session {user.current_session}
											</span>
										{/if}
										{#if user.role === 'accf_student'}
											<span class="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded">
												Student
											</span>
										{/if}
										<span class="text-xs px-2 py-1 rounded {getRoleColor(user.role)}">
											{user.role.replace('accf_', '').replace('_', ' ')}
										</span>
									</div>
								</button>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Spacer to push content below the dev bar -->
	<div class="h-12"></div>
{/if}