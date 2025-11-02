<script lang="ts">
	import { User, Settings } from 'lucide-svelte';
	import { page } from '$app/stores';

	let { session, modules = [] } = $props<{
		session: any;
		modules?: string[];
	}>();

	const moduleSet = $derived(new Set(modules ?? []));

	function hasModule(module: string) {
		return moduleSet.has(module);
	}

	function hasAnyModule(required: string[]) {
		return required.some((mod) => hasModule(mod));
	}
</script>

<nav class="bg-white">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<a href="/" class="flex items-center">
				<img src="/archmin-mark.png" alt="ArchTools" class="h-8" />
			</a>

			<div class="absolute left-1/2 -translate-x-1/2 hidden items-center space-x-1 md:flex">
				<a
					href="/"
					class="rounded-full px-4 py-2 text-sm font-medium transition-colors {$page.url.pathname === '/' ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
					title="Dashboard home"
				>
					Home
				</a>
				{#if hasAnyModule(['courses.participant', 'courses.manager', 'courses.admin'])}
					<a
						href={hasAnyModule(['courses.manager', 'courses.admin']) ? '/courses' : '/my-courses'}
						class="rounded-full px-4 py-2 text-sm font-medium transition-colors {($page.url.pathname.startsWith('/courses') || $page.url.pathname.startsWith('/my-courses')) ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}"
						title={hasAnyModule(['courses.manager', 'courses.admin']) ? 'Course management' : 'My courses'}
					>
						Courses
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

			{#if session}
				<div class="flex items-center space-x-3">
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
				</div>
			{/if}
		</div>
	</div>
</nav>
