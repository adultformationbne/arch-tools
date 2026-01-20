<script lang="ts">
	import { User, Settings, LogOut, Menu, X } from '$lib/icons';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	let { session, modules = [], userProfile = null } = $props<{
		session: any;
		modules?: string[];
		userProfile?: any;
	}>();

	const moduleSet = $derived(new Set(modules ?? []));

	let mobileMenuOpen = $state(false);

	function hasModule(module: string) {
		return moduleSet.has(module);
	}

	function hasAnyModule(required: string[]) {
		return required.some((mod) => hasModule(mod));
	}

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}
</script>

<nav class="bg-white border-b border-gray-200">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-11 items-center justify-between">
			<!-- Logo -->
			<a href="/" class="flex items-center">
				<img src="/archmin-mark.png" alt="ArchTools" class="h-6" />
			</a>

			<!-- Desktop Navigation (centered) -->
			<div class="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center space-x-0.5">
				<a
					href="/"
					class="rounded-full px-3 py-1 text-xs font-medium transition-colors {$page.url.pathname === '/' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					title="Dashboard home"
				>
					Home
				</a>
				{#if hasAnyModule(['courses.manager', 'courses.admin'])}
					<a
						href="/admin/courses"
						class="rounded-full px-3 py-1 text-xs font-medium transition-colors {$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title="Course management"
					>
						Courses
					</a>
				{/if}
				{#if hasModule('courses.participant')}
					<a
						href="/courses"
						class="rounded-full px-3 py-1 text-xs font-medium transition-colors {$page.url.pathname.startsWith('/courses') && !$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title="My enrolled courses"
					>
						My Courses
					</a>
				{/if}
				{#if hasModule('dgr')}
					<a
						href="/dgr"
						class="rounded-full px-3 py-1 text-xs font-medium transition-colors {$page.url.pathname.startsWith('/dgr') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title="Daily Gospel management"
					>
						DGR
					</a>
				{/if}
			</div>

			<!-- Mobile Menu Button + Right Side Actions -->
			{#if session}
				<div class="flex items-center space-x-2">
					<!-- Mobile Menu Button -->
					<button
						onclick={toggleMobileMenu}
						class="md:hidden flex items-center justify-center w-7 h-7 rounded-full transition-colors text-gray-600 hover:bg-gray-100"
						aria-label="Toggle menu"
					>
						{#if mobileMenuOpen}
							<X class="h-4 w-4" />
						{:else}
							<Menu class="h-4 w-4" />
						{/if}
					</button>

					<!-- Desktop Actions -->
					<div class="hidden md:flex items-center space-x-1.5">
						{#if hasModule('platform.admin')}
							<a
								href="/settings"
								class="rounded-full p-1.5 transition-colors {$page.url.pathname.startsWith('/settings') ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}"
								title="Platform Admin"
							>
								<Settings class="h-4 w-4" />
							</a>
						{/if}
						{#if userProfile}
							<a
								href="/profile"
								class="transition-opacity hover:opacity-80"
								title="Profile Settings - {userProfile.full_name || userProfile.email}"
							>
								<UserAvatar user={userProfile} size="xs" />
							</a>
						{:else}
							<a
								href="/profile"
								class="flex h-7 w-7 items-center justify-center rounded-full transition-colors {$page.url.pathname === '/profile' ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
								title="Profile Settings"
							>
								<User class="h-4 w-4" />
							</a>
						{/if}
						<a
							href="/auth/logout"
							class="flex h-7 w-7 items-center justify-center rounded-full transition-colors text-gray-600 hover:bg-red-50 hover:text-red-600"
							title="Sign Out"
						>
							<LogOut class="h-4 w-4" />
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</nav>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
	<div class="md:hidden fixed top-11 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
		<div class="px-3 py-2 space-y-0.5">
			<!-- Mobile Navigation Links -->
			<a
				href="/"
				class="block px-3 py-1.5 rounded text-xs font-medium transition-colors {$page.url.pathname === '/' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
				onclick={closeMobileMenu}
			>
				Home
			</a>
			{#if hasAnyModule(['courses.manager', 'courses.admin'])}
				<a
					href="/admin/courses"
					class="block px-3 py-1.5 rounded text-xs font-medium transition-colors {$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					Courses
				</a>
			{/if}
			{#if hasModule('courses.participant')}
				<a
					href="/courses"
					class="block px-3 py-1.5 rounded text-xs font-medium transition-colors {$page.url.pathname.startsWith('/courses') && !$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					My Courses
				</a>
			{/if}
			{#if hasModule('dgr')}
				<a
					href="/dgr"
					class="block px-3 py-1.5 rounded text-xs font-medium transition-colors {$page.url.pathname.startsWith('/dgr') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					DGR
				</a>
			{/if}

			<!-- Mobile Actions -->
			<div class="border-t border-gray-200 pt-2 mt-2 space-y-0.5">
				{#if hasModule('platform.admin')}
					<a
						href="/settings"
						class="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors {$page.url.pathname.startsWith('/settings') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						onclick={closeMobileMenu}
					>
						<Settings class="h-4 w-4" />
						<span>Platform Admin</span>
					</a>
				{/if}
				<a
					href="/profile"
					class="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors {$page.url.pathname === '/profile' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					{#if userProfile}
						<UserAvatar user={userProfile} size="xs" />
						<span>{userProfile.full_name || userProfile.email}</span>
					{:else}
						<User class="h-4 w-4" />
						<span>Profile</span>
					{/if}
				</a>
				<a
					href="/auth/logout"
					class="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors text-red-600 hover:bg-red-50"
					onclick={closeMobileMenu}
				>
					<LogOut class="h-4 w-4" />
					<span>Sign Out</span>
				</a>
			</div>
		</div>
	</div>
{/if}
