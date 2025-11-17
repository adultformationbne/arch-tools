<script lang="ts">
	import { User, Settings, LogOut, Menu, X } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let { session, modules = [] } = $props<{
		session: any;
		modules?: string[];
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
		<div class="flex h-16 items-center justify-between">
			<!-- Logo -->
			<a href="/" class="flex items-center">
				<img src="/archmin-mark.png" alt="ArchTools" class="h-8" />
			</a>

			<!-- Desktop Navigation (centered) -->
			<div class="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center space-x-1">
				<a
					href="/"
					class="rounded-full px-4 py-2 text-sm font-medium transition-colors {$page.url.pathname === '/' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					title="Dashboard home"
				>
					Home
				</a>
				{#if hasAnyModule(['courses.manager', 'courses.admin'])}
					<a
						href="/admin/courses"
						class="rounded-full px-4 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title="Course management"
					>
						Courses
					</a>
				{/if}
				{#if hasModule('courses.participant')}
					<a
						href="/courses"
						class="rounded-full px-4 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith('/courses') && !$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title="My enrolled courses"
					>
						My Courses
					</a>
				{/if}
				{#if hasModule('editor')}
					<a
						href="/editor"
						class="rounded-full px-4 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith('/editor') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title="Content editor"
					>
						Editor
					</a>
				{/if}
				{#if hasModule('dgr')}
					<a
						href="/dgr"
						class="rounded-full px-4 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith('/dgr') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title="Daily Gospel management"
					>
						DGR
					</a>
				{/if}
			</div>

			<!-- Mobile Menu Button + Right Side Actions -->
			{#if session}
				<div class="flex items-center space-x-3">
					<!-- Mobile Menu Button -->
					<button
						onclick={toggleMobileMenu}
						class="md:hidden flex items-center justify-center w-9 h-9 rounded-full transition-colors text-gray-600 hover:bg-gray-100"
						aria-label="Toggle menu"
					>
						{#if mobileMenuOpen}
							<X class="h-5 w-5" />
						{:else}
							<Menu class="h-5 w-5" />
						{/if}
					</button>

					<!-- Desktop Actions -->
					<div class="hidden md:flex items-center space-x-3">
						{#if hasModule('users')}
							<a
								href="/users"
								class="rounded-full p-2 transition-colors {$page.url.pathname.startsWith('/users') ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}"
								title="User Management"
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
						<a
							href="/auth/logout"
							class="flex h-9 w-9 items-center justify-center rounded-full transition-colors text-gray-600 hover:bg-red-50 hover:text-red-600"
							title="Sign Out"
						>
							<LogOut class="h-5 w-5" />
						</a>
					</div>
				</div>
			{/if}
		</div>
	</div>
</nav>

<!-- Mobile Menu Overlay -->
{#if mobileMenuOpen}
	<div class="md:hidden fixed top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
		<div class="px-4 py-3 space-y-1">
			<!-- Mobile Navigation Links -->
			<a
				href="/"
				class="block px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname === '/' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
				onclick={closeMobileMenu}
			>
				Home
			</a>
			{#if hasAnyModule(['courses.manager', 'courses.admin'])}
				<a
					href="/admin/courses"
					class="block px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					Courses
				</a>
			{/if}
			{#if hasModule('courses.participant')}
				<a
					href="/courses"
					class="block px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/courses') && !$page.url.pathname.startsWith('/admin/courses') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					My Courses
				</a>
			{/if}
			{#if hasModule('editor')}
				<a
					href="/editor"
					class="block px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/editor') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					Editor
				</a>
			{/if}
			{#if hasModule('dgr')}
				<a
					href="/dgr"
					class="block px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/dgr') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					DGR
				</a>
			{/if}

			<!-- Mobile Actions -->
			<div class="border-t border-gray-200 pt-3 mt-3 space-y-1">
				{#if hasModule('users')}
					<a
						href="/users"
						class="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/users') ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						onclick={closeMobileMenu}
					>
						<Settings class="h-5 w-5" />
						<span>User Management</span>
					</a>
				{/if}
				<a
					href="/profile"
					class="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname === '/profile' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					onclick={closeMobileMenu}
				>
					<User class="h-5 w-5" />
					<span>Profile Settings</span>
				</a>
				<a
					href="/auth/logout"
					class="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-red-600 hover:bg-red-50"
					onclick={closeMobileMenu}
				>
					<LogOut class="h-5 w-5" />
					<span>Sign Out</span>
				</a>
			</div>
		</div>
	</div>
{/if}
